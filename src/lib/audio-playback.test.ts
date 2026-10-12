import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { AudioPlaybackError, playAudioBlob } from './audio-playback'

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

let createdUrls: string[] = []
let revokedUrls: string[] = []

beforeEach(() => {
  FakeAudio.instances.length = 0
  FakeAudio.nextPlayBehavior = 'resolve'
  createdUrls = []
  revokedUrls = []
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

describe('AudioPlaybackError', () => {
  it('carries the code and name', () => {
    const error = new AudioPlaybackError('aborted', 'stopped')
    expect(error.code).toBe('aborted')
    expect(error.name).toBe('AudioPlaybackError')
    expect(error).toBeInstanceOf(Error)
  })
})

describe('playAudioBlob', () => {
  it('resolves when playback ends', async () => {
    const promise = playAudioBlob(new Blob(['x']), new AbortController().signal)
    await vi.waitFor(() => expect(FakeAudio.instances).toHaveLength(1))
    FakeAudio.instances[0].emit('ended')
    await expect(promise).resolves.toBeUndefined()
    expect(revokedUrls).toHaveLength(1)
  })

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
