/**
 * Server-side Microsoft Edge read-aloud neural TTS.
 *
 * SERVER ONLY: imports node:crypto and the ws package, so it must never be
 * imported from a client component. Used by GET /api/tts, which proxies
 * synthesis for signed-in teachers.
 *
 * The endpoint is unofficial and free (no key, no sign-up); Microsoft can
 * change or restrict it without notice. Every failure mode throws
 * EdgeTtsError so the API route can 502 and the client can fall back to the
 * device's built-in voices.
 */

import { createHash, randomUUID } from 'node:crypto'
import type { Agent } from 'node:http'
import WebSocket from 'ws'

export class EdgeTtsError extends Error {
  readonly code: 'timeout' | 'connection' | 'no-audio'
  constructor(code: EdgeTtsError['code'], message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'EdgeTtsError'
    this.code = code
  }
}

/** Neural voice used for read-aloud. Jenny is the natural US English voice. */
export const EDGE_TTS_VOICE = 'en-US-JennyNeural'

/** Longest text the proxy will synthesize in one request (abuse guard). */
export const MAX_TTS_TEXT_LENGTH = 500

/** Default budget for connect plus synthesis before the client falls back. */
export const DEFAULT_SYNTHESIS_TIMEOUT_MS = 20000

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const WSS_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
// Microsoft's Sec-MS-GEC check expects "1-<chromium version>". Track the
// release named by the public edge-tts client library; if it goes stale the
// endpoint starts rejecting and the client falls back to device voices.
const SEC_MS_GEC_VERSION = '1-143.0.3650.75'
const WSS_ORIGIN = 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold'
const WSS_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0'

// BigInt() calls (not literals): the tsconfig target is ES2017.
const WINDOWS_EPOCH_OFFSET_SECONDS = BigInt(11644473600)
const FIVE_MINUTES_SECONDS = BigInt(300)
const TICKS_PER_SECOND = BigInt(10000000)

/**
 * Build the Sec-MS-GEC auth token: the current Unix time plus the Windows
 * epoch offset, rounded down to 5-minute intervals and scaled to
 * 100-nanosecond ticks, concatenated with the trusted client token and
 * SHA-256 hashed. BigInt math is required: the tick value (~1.3e17) exceeds
 * Number.MAX_SAFE_INTEGER.
 */
export function secMsGecToken(nowMs: number = Date.now()): string {
  const unixSeconds = BigInt(Math.floor(nowMs / 1000))
  const rounded = ((unixSeconds + WINDOWS_EPOCH_OFFSET_SECONDS) / FIVE_MINUTES_SECONDS) * FIVE_MINUTES_SECONDS
  const ticks = rounded * TICKS_PER_SECOND
  return createHash('sha256').update(`${ticks}${TRUSTED_CLIENT_TOKEN}`).digest('hex').toUpperCase()
}

/** WebSocket URL for one synthesis turn. The connection id must be unique per connection. */
export function buildTtsUrl(connectionId: string, nowMs: number = Date.now()): string {
  const params = new URLSearchParams({
    TrustedClientToken: TRUSTED_CLIENT_TOKEN,
    'Sec-MS-GEC': secMsGecToken(nowMs),
    'Sec-MS-GEC-Version': SEC_MS_GEC_VERSION,
    ConnectionId: connectionId,
  })
  return `${WSS_URL}?${params.toString()}`
}

/**
 * Strip characters the service rejects (control characters other than tab
 * and newline) and XML-escape the rest so the text is safe inside SSML.
 */
export function escapeSsmlText(text: string): string {
  const cleaned = text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
  return cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * SSML for one synthesis turn. Prosody runs slightly slower for young
 * learners, matching the built-in voice rate.
 */
export function buildSsml(text: string, voice: string = EDGE_TTS_VOICE): string {
  return (
    `<speak version='1.0' xmlns='http://www.w3.org/2001/XMLSchema' xml:lang='en-US'>` +
    `<voice xml:lang='en-US' name='${voice}'><prosody rate='-10%'>${escapeSsmlText(text)}</prosody></voice></speak>`
  )
}

/** JavaScript-style UTC date string used in the protocol message headers. */
export function ttsDateString(date: Date = new Date()): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const pad = (n: number): string => String(n).padStart(2, '0')
  return (
    `${days[date.getUTCDay()]} ${months[date.getUTCMonth()]} ${pad(date.getUTCDate())} ` +
    `${date.getUTCFullYear()} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} ` +
    `GMT+0000 (Coordinated Universal Time)`
  )
}

/** The speech.config message: MP3 output, no boundary metadata needed. */
export function buildConfigMessage(date: string): string {
  return (
    `X-Timestamp:${date}\r\n` +
    `Content-Type:application/json; charset=utf-8\r\n` +
    `Path:speech.config\r\n\r\n` +
    `{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`
  )
}

/**
 * The SSML request message. The trailing "Z" on the timestamp mirrors the
 * quirk in Microsoft's own Edge client; the service expects it.
 */
export function buildSsmlMessage(requestId: string, date: string, ssml: string): string {
  return `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${date}Z\r\nPath:ssml\r\n\r\n${ssml}`
}

/**
 * Extract MP3 bytes from a binary WebSocket frame. Binary frames are ASCII
 * headers, a blank line, then raw audio. Returns null when the frame is not
 * an audio frame (or has no header terminator).
 */
export function parseAudioFrame(data: Buffer): Buffer | null {
  const headerEnd = data.indexOf('\r\n\r\n')
  if (headerEnd === -1) return null
  const header = data.subarray(0, headerEnd).toString('ascii')
  if (!header.includes('Path:audio')) return null
  return data.subarray(headerEnd + 4)
}

export interface SynthesizeOptions {
  voice?: string
  /** Total budget for connect plus synthesis. The caller falls back when it fires. */
  timeoutMs?: number
  connectionId?: string
  /** HTTP agent for the WebSocket (e.g. a proxy agent in proxied networks). */
  agent?: Agent
}

function toBuffer(data: WebSocket.RawData): Buffer {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  return Buffer.concat(data as Buffer[])
}

/**
 * Synthesize text to MP3 via the Edge read-aloud endpoint. Resolves with the
 * complete audio once the turn.end frame arrives. Throws EdgeTtsError on
 * timeout, connection failure, a close before turn.end, or a turn with no
 * audio.
 */
export function synthesizeEdgeTts(text: string, options: SynthesizeOptions = {}): Promise<Buffer> {
  const {
    voice = EDGE_TTS_VOICE,
    timeoutMs = DEFAULT_SYNTHESIS_TIMEOUT_MS,
    connectionId = randomUUID().replace(/-/g, ''),
    agent,
  } = options

  return new Promise<Buffer>((resolve, reject) => {
    let settled = false
    const chunks: Buffer[] = []
    const finish = (fn: () => void): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn()
    }

    const ws = new WebSocket(buildTtsUrl(connectionId), {
      headers: {
        Origin: WSS_ORIGIN,
        'User-Agent': WSS_USER_AGENT,
        Pragma: 'no-cache',
        'Cache-Control': 'no-cache',
      },
      // ws ignores undefined options, so this stays direct unless a proxy
      // agent is passed.
      agent,
    })

    const timer = setTimeout(() => {
      ws.close()
      finish(() => reject(new EdgeTtsError('timeout', `Edge TTS timed out after ${timeoutMs}ms`)))
    }, timeoutMs)

    ws.on('open', () => {
      const date = ttsDateString()
      ws.send(buildConfigMessage(date))
      ws.send(buildSsmlMessage(connectionId, date, buildSsml(text, voice)))
    })

    ws.on('message', (data: WebSocket.RawData) => {
      const bytes = toBuffer(data)
      // Audio frames are identified by their header first, so MP3 payload
      // bytes can never be misread as a control message.
      const frameAudio = parseAudioFrame(bytes)
      if (frameAudio) {
        if (frameAudio.length > 0) chunks.push(frameAudio)
        return
      }
      if (bytes.toString('utf8').includes('Path:turn.end')) {
        const audio = chunks.length > 0 ? Buffer.concat(chunks) : null
        ws.close()
        finish(() => {
          if (audio) resolve(audio)
          else reject(new EdgeTtsError('no-audio', 'Edge TTS returned no audio'))
        })
      }
      // turn.start and metadata frames carry no audio; ignore them.
    })

    ws.on('error', (error: Error) => {
      finish(() => reject(new EdgeTtsError('connection', 'Edge TTS connection failed', { cause: error })))
    })

    ws.on('close', () => {
      finish(() => reject(new EdgeTtsError('connection', 'Edge TTS closed before synthesis finished')))
    })
  })
}
