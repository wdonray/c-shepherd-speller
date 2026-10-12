import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  DEFAULT_SYNTHESIS_TIMEOUT_MS,
  EDGE_TTS_VOICE,
  EdgeTtsError,
  MAX_TTS_TEXT_LENGTH,
  buildConfigMessage,
  buildSsml,
  buildSsmlMessage,
  buildTtsUrl,
  escapeSsmlText,
  parseAudioFrame,
  secMsGecToken,
  synthesizeEdgeTts,
  ttsDateString,
} from './edge-tts'

interface FakeSocket {
  url: string
  options: unknown
  sent: string[]
  closed: boolean
  on(event: string, handler: (...args: unknown[]) => void): void
  send(data: string): void
  close(): void
  emit(event: string, ...args: unknown[]): void
}

const { createdSockets } = vi.hoisted(() => ({ createdSockets: [] as FakeSocket[] }))

vi.mock('ws', () => ({
  default: class implements FakeSocket {
    url: string
    options: unknown
    sent: string[] = []
    closed = false
    private handlers = new Map<string, Array<(...args: unknown[]) => void>>()

    constructor(url: string, options?: unknown) {
      this.url = url
      this.options = options
      createdSockets.push(this)
    }

    on(event: string, handler: (...args: unknown[]) => void): void {
      const list = this.handlers.get(event) ?? []
      list.push(handler)
      this.handlers.set(event, list)
    }

    send(data: string): void {
      this.sent.push(data)
    }

    close(): void {
      this.closed = true
    }

    emit(event: string, ...args: unknown[]): void {
      for (const handler of this.handlers.get(event) ?? []) handler(...args)
    }
  },
}))

beforeEach(() => {
  createdSockets.length = 0
})

afterEach(() => {
  vi.useRealTimers()
})

function audioFrame(payload: number[]): Buffer {
  const header = Buffer.from('X-RequestId:abc\r\nContent-Type:audio/mpeg\r\nPath:audio\r\n\r\n', 'ascii')
  return Buffer.concat([header, Buffer.from(payload)])
}

describe('secMsGecToken', () => {
  it('returns a 64-character uppercase hex token', () => {
    const token = secMsGecToken(1760000000000)
    expect(token).toMatch(/^[0-9A-F]{64}$/)
  })

  it('is deterministic for the same timestamp', () => {
    expect(secMsGecToken(1760000000000)).toBe(secMsGecToken(1760000000123))
  })

  it('changes across a 5-minute boundary', () => {
    expect(secMsGecToken(1760000000000)).not.toBe(secMsGecToken(1760000000000 + 300000))
  })

  it('defaults to the current time', () => {
    expect(secMsGecToken()).toMatch(/^[0-9A-F]{64}$/)
  })
})

describe('buildTtsUrl', () => {
  it('includes the auth params and connection id', () => {
    const url = buildTtsUrl('conn123', 1760000000000)
    expect(url).toContain('wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?')
    expect(url).toContain('TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4')
    expect(url).toContain('Sec-MS-GEC-Version=1-')
    expect(url).toContain('ConnectionId=conn123')
    expect(url).toMatch(/Sec-MS-GEC=[0-9A-F]{64}/)
  })
})

describe('escapeSsmlText', () => {
  it('escapes XML special characters', () => {
    expect(escapeSsmlText(`a&b<c>"d'e`)).toBe('a&amp;b&lt;c&gt;&quot;d&apos;e')
  })

  it('replaces rejected control characters with spaces', () => {
    expect(escapeSsmlText('a\x01b\x0cc\x0ed')).toBe('a b c d')
  })

  it('keeps tab, newline, and carriage return', () => {
    expect(escapeSsmlText('a\tb\nc\rd')).toBe('a\tb\nc\rd')
  })
})

describe('buildSsml', () => {
  it('wraps escaped text in a voice element with slower prosody', () => {
    const ssml = buildSsml('cake & pie', 'en-US-AriaNeural')
    expect(ssml).toContain(`name='en-US-AriaNeural'`)
    expect(ssml).toContain(`<prosody rate='-10%'>cake &amp; pie</prosody>`)
  })

  it('defaults to the Jenny neural voice', () => {
    expect(buildSsml('hello')).toContain(`name='${EDGE_TTS_VOICE}'`)
  })
})

describe('ttsDateString', () => {
  it('formats a JavaScript-style UTC date string', () => {
    expect(ttsDateString(new Date('2026-10-12T15:31:05Z'))).toBe(
      'Mon Oct 12 2026 15:31:05 GMT+0000 (Coordinated Universal Time)'
    )
  })

  it('defaults to now', () => {
    expect(ttsDateString()).toMatch(/GMT\+0000 \(Coordinated Universal Time\)$/)
  })
})

describe('protocol messages', () => {
  it('builds the speech.config message', () => {
    const message = buildConfigMessage('the-date')
    expect(message).toContain('X-Timestamp:the-date\r\n')
    expect(message).toContain('Path:speech.config\r\n\r\n')
    expect(message).toContain('audio-24khz-48kbitrate-mono-mp3')
  })

  it('builds the SSML request message', () => {
    const message = buildSsmlMessage('req-1', 'the-date', '<speak/>')
    expect(message).toContain('X-RequestId:req-1\r\n')
    expect(message).toContain('Path:ssml\r\n\r\n<speak/>')
  })
})

describe('parseAudioFrame', () => {
  it('extracts the audio payload after the header', () => {
    expect(parseAudioFrame(audioFrame([1, 2, 3]))).toEqual(Buffer.from([1, 2, 3]))
  })

  it('returns null for non-audio frames', () => {
    const frame = Buffer.concat([Buffer.from('X-RequestId:abc\r\nPath:response\r\n\r\n', 'ascii'), Buffer.from([9, 9])])
    expect(parseAudioFrame(frame)).toBeNull()
  })

  it('returns null when there is no header terminator', () => {
    expect(parseAudioFrame(Buffer.from([1, 2, 3]))).toBeNull()
  })
})

describe('synthesizeEdgeTts', () => {
  it('sends config and SSML on open and resolves with concatenated audio on turn.end', async () => {
    const promise = synthesizeEdgeTts('hello')
    const socket = createdSockets[0]
    expect(socket.url).toContain('wss://speech.platform.bing.com')

    socket.emit('open')
    expect(socket.sent).toHaveLength(2)
    expect(socket.sent[0]).toContain('Path:speech.config')
    expect(socket.sent[1]).toContain('Path:ssml')
    expect(socket.sent[1]).toContain('hello')

    socket.emit('message', audioFrame([1, 2, 3]))
    socket.emit('message', audioFrame([4, 5]))
    // Non-audio text frames are ignored.
    socket.emit('message', Buffer.from('X-RequestId:x\r\nPath:response\r\n\r\n{}', 'utf8'))
    // Non-audio binary frames are ignored.
    socket.emit('message', Buffer.from('not-a-frame'))
    socket.emit('message', Buffer.from('X-RequestId:x\r\nPath:turn.end\r\n\r\n', 'utf8'))

    await expect(promise).resolves.toEqual(Buffer.from([1, 2, 3, 4, 5]))
    expect(socket.closed).toBe(true)

    // A late close after success is a no-op.
    socket.emit('close')
    await expect(promise).resolves.toEqual(Buffer.from([1, 2, 3, 4, 5]))
  })

  it('accepts ArrayBuffer and Buffer[] message payloads', async () => {
    const promise = synthesizeEdgeTts('hi')
    const socket = createdSockets[0]
    socket.emit('open')

    const header = Buffer.from('X-RequestId:x\r\nPath:audio\r\n\r\n', 'ascii')
    const framed = Buffer.concat([header, Buffer.from([7])])
    // Constructed with this realm's ArrayBuffer so instanceof matches.
    const asArrayBuffer = new ArrayBuffer(framed.length)
    new Uint8Array(asArrayBuffer).set(framed)
    socket.emit('message', asArrayBuffer)
    socket.emit('message', [header, Buffer.from([8])])
    socket.emit('message', Buffer.from('Path:turn.end', 'utf8'))

    await expect(promise).resolves.toEqual(Buffer.from([7, 8]))
  })

  it('rejects with no-audio when the turn has no audio frames', async () => {
    const promise = synthesizeEdgeTts('hello', { connectionId: 'c1', voice: 'en-US-AriaNeural', timeoutMs: 5000 })
    const socket = createdSockets[0]
    socket.emit('open')
    // An audio frame with an empty payload does not count.
    socket.emit('message', audioFrame([]))
    socket.emit('message', Buffer.from('Path:turn.end', 'utf8'))

    await expect(promise).rejects.toMatchObject({ name: 'EdgeTtsError', code: 'no-audio' })
    expect(socket.closed).toBe(true)
  })

  it('rejects with connection when the socket errors', async () => {
    const promise = synthesizeEdgeTts('hello')
    createdSockets[0].emit('error', new Error('boom'))
    await expect(promise).rejects.toMatchObject({ name: 'EdgeTtsError', code: 'connection' })
  })

  it('rejects with connection when the socket closes before turn.end', async () => {
    const promise = synthesizeEdgeTts('hello')
    const socket = createdSockets[0]
    socket.emit('open')
    socket.emit('close')
    await expect(promise).rejects.toMatchObject({ name: 'EdgeTtsError', code: 'connection' })
  })

  it('rejects with timeout when the service never responds', async () => {
    vi.useFakeTimers()
    try {
      const promise = synthesizeEdgeTts('hello', { timeoutMs: 5000 })
      const assertion = expect(promise).rejects.toMatchObject({ name: 'EdgeTtsError', code: 'timeout' })
      await vi.advanceTimersByTimeAsync(5000)
      await assertion
      expect(createdSockets[0].closed).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('passes a proxy agent through to the WebSocket', async () => {
    const agent = { proxy: true } as unknown as import('node:http').Agent
    const promise = synthesizeEdgeTts('hello', { agent, connectionId: 'c9' })
    const socket = createdSockets[0]
    expect(socket.options).toMatchObject({ agent })
    socket.emit('open')
    socket.emit('message', Buffer.from('Path:turn.end', 'utf8'))
    await expect(promise).rejects.toMatchObject({ code: 'no-audio' })
  })

  it('exposes the voice, length cap, and timeout constants', () => {
    expect(EDGE_TTS_VOICE).toBe('en-US-JennyNeural')
    expect(MAX_TTS_TEXT_LENGTH).toBe(500)
    expect(DEFAULT_SYNTHESIS_TIMEOUT_MS).toBe(20000)
  })
})
