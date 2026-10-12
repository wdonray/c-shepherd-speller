import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NeuralTtsError, __resetNeuralTtsForTests, playAudioBlob, speakWithNeuralVoice } from './neural-tts'

class FakeAudio {
  static instances: FakeAudio[] = []
  static nextPlayBehavior: 'resolve' | 'reject' = 'resolve'
  src: string
  paused = false
  playBehavior: 'resolve' | 'reject' = FakeAudio.nextPlayBehavior
  private listeners = new Map<string, Array<() => void>>()

  constructor(src: string) {
    this.src = src
    FakeAudio.instances.push(this)
  }

  addEventListener(event: string, handler: () => void): void {
    const list = this.listeners.get(event) ?? []
    list.push(handler)
    this.listeners.set(event, list)
  }

  removeEventListener(event: string, handler: () => void): void {
    const list = this.listeners.get(event) ?? []
    this.listeners.set(
      event,
      list.filter((h) => h !== handler)
    )
  }

  play(): Promise<void> {
    return this.playBehavior === 'resolve' ? Promise.resolve() : Promise.reject(new Error('play failed'))
  }

  pause(): void {
    this.paused = true
  }

  emit(event: string): void {
    for (const handler of [...(this.listeners.get(event) ?? [])]) handler()
  }
}

const fetchMock = vi.fn()
let createdUrls: string[] = []
let revokedUrls: string[] = []

function okResponse(blob: Blob): Response {
  return { ok: true, status: 200, blob: async () => blob } as Response
}

beforeEach(() => {
  __resetNeuralTtsForTests()
  FakeAudio.instances.length = 0
  createdUrls = []
  revokedUrls = []
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('Audio', FakeAudio)
  Object.defineProperty(URL, 'createObjectURL', {
    value: (blob: Blob): string => {
      const url = `blob:fake-${createdUrls.length}-${blob.size}`
      createdUrls.push(url)
      return url
    },
    configurable: true,
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    value: (url: string): void => {
      revokedUrls.push(url)
    },
    configurable: true,
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  const urlRecord = URL as unknown as Record<string, unknown>
  delete urlRecord.createObjectURL
  delete urlRecord.revokeObjectURL
})

describe('speakWithNeuralVoice', () => {
  it('fetches audio and plays it to the end', async () => {
    fetchMock.mockResolvedValue(okResponse(new Blob(['audio-bytes'], { type: 'audio/mpeg' })))
    const controller = new AbortController()

    const promise = speakWithNeuralVoice('hello world', controller.signal)
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1))
    const audio = FakeAudio.instances[0]
    expect(fetchMock).toHaveBeenCalledWith('/api/tts?text=hello%20world', { signal: controller.signal })
    expect(audio.src).toBe(createdUrls[0])

    audio.emit('ended')
    await expect(promise).resolves.toBeUndefined()
    expect(revokedUrls).toEqual([createdUrls[0]])
  })

  it('serves repeated text from the cache without refetching', async () => {
    fetchMock.mockResolvedValue(okResponse(new Blob(['x'])))

    const first = speakWithNeuralVoice('cake', new AbortController().signal)
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1))
    FakeAudio.instances[0].emit('ended')
    await first

    const second = speakWithNeuralVoice('cake', new AbortController().signal)
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(2))
    FakeAudio.instances[1].emit('ended')
    await second

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('evicts the oldest cached entry past the cap', async () => {
    fetchMock.mockImplementation(async () => okResponse(new Blob(['x'])))

    for (let i = 0; i < 51; i++) {
      const promise = speakWithNeuralVoice(`word-${i}`, new AbortController().signal)
      await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(i + 1))
      FakeAudio.instances[i].emit('ended')
      await promise
    }
    expect(fetchMock).toHaveBeenCalledTimes(51)

    // word-1 is still cached; word-0 was evicted.
    const cached = speakWithNeuralVoice('word-1', new AbortController().signal)
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(52))
    FakeAudio.instances[51].emit('ended')
    await cached
    expect(fetchMock).toHaveBeenCalledTimes(51)

    const evicted = speakWithNeuralVoice('word-0', new AbortController().signal)
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(53))
    FakeAudio.instances[52].emit('ended')
    await evicted
    expect(fetchMock).toHaveBeenCalledTimes(52)
  })

  it('throws unavailable when the fetch fails', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'))
    await expect(speakWithNeuralVoice('hi', new AbortController().signal)).rejects.toMatchObject({
      name: 'NeuralTtsError',
      code: 'unavailable',
    })
    expect(FakeAudio.instances).toHaveLength(0)
  })

  it('throws rate-limited on a 429 response', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 429 } as Response)
    await expect(speakWithNeuralVoice('hi', new AbortController().signal)).rejects.toMatchObject({
      code: 'rate-limited',
    })
  })

  it('throws unavailable on other error statuses', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 } as Response)
    await expect(speakWithNeuralVoice('hi', new AbortController().signal)).rejects.toMatchObject({
      code: 'unavailable',
    })
  })

  it('throws aborted when the signal fires before playback starts', async () => {
    fetchMock.mockResolvedValue(okResponse(new Blob(['x'])))
    const controller = new AbortController()
    controller.abort()
    await expect(speakWithNeuralVoice('hi', controller.signal)).rejects.toMatchObject({ code: 'aborted' })
    expect(FakeAudio.instances).toHaveLength(0)
  })
})

describe('playAudioBlob', () => {
  it('rejects aborted when constructed with an already-aborted signal', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(playAudioBlob(new Blob(['x']), controller.signal)).rejects.toMatchObject({ code: 'aborted' })
    expect(FakeAudio.instances[0].paused).toBe(true)
    expect(revokedUrls).toHaveLength(1)
  })

  it('stops playback and rejects aborted when the signal fires mid-play', async () => {
    const controller = new AbortController()
    const promise = playAudioBlob(new Blob(['x']), controller.signal)
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1))
    controller.abort()
    await expect(promise).rejects.toMatchObject({ code: 'aborted' })
    expect(FakeAudio.instances[0].paused).toBe(true)
  })

  it('ignores late events after abort', async () => {
    const controller = new AbortController()
    const promise = playAudioBlob(new Blob(['x']), controller.signal)
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1))
    const audio = FakeAudio.instances[0]
    controller.abort()
    audio.emit('ended')
    await expect(promise).rejects.toMatchObject({ code: 'aborted' })
  })

  it('rejects playback when the audio element errors', async () => {
    const promise = playAudioBlob(new Blob(['x']), new AbortController().signal)
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1))
    FakeAudio.instances[0].emit('error')
    await expect(promise).rejects.toMatchObject({ code: 'playback' })
    expect(revokedUrls).toHaveLength(1)
  })

  it('rejects playback when play() rejects', async () => {
    FakeAudio.nextPlayBehavior = 'reject'
    try {
      await expect(playAudioBlob(new Blob(['x']), new AbortController().signal)).rejects.toMatchObject({
        code: 'playback',
      })
    } finally {
      FakeAudio.nextPlayBehavior = 'resolve'
    }
    expect(revokedUrls).toHaveLength(1)
  })
})
