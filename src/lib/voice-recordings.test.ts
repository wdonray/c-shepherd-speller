import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  __awaitRequestForTests,
  __openDatabaseForTests,
  deleteRecording,
  getRecording,
  hasRecording,
  isAudioCaptureSupported,
  isRecordingStorageSupported,
  recordingToBlob,
  saveRecording,
  startRecording,
} from './voice-recordings'

class FakeMediaRecorder {
  static instances: FakeMediaRecorder[] = []
  stream: unknown
  mimeType = ''
  state: 'inactive' | 'recording' = 'inactive'
  stoppedCount = 0
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onerror: (() => void) | null = null
  onstop: (() => void) | null = null

  constructor(stream: unknown) {
    this.stream = stream
    FakeMediaRecorder.instances.push(this)
  }

  start(): void {
    this.state = 'recording'
  }

  stop(): void {
    this.stoppedCount += 1
    this.state = 'inactive'
    this.onstop?.()
  }
}

const getUserMedia = vi.fn()

function resetDatabase(): Promise<void> {
  return new Promise((resolve) => {
    const request = indexedDB.deleteDatabase('patternspell')
    request.onsuccess = () => resolve()
    request.onerror = () => resolve()
    request.onblocked = () => resolve()
  })
}

beforeEach(async () => {
  FakeMediaRecorder.instances.length = 0
  getUserMedia.mockReset()
  vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  Object.defineProperty(window.navigator, 'mediaDevices', {
    value: { getUserMedia },
    configurable: true,
  })
  await resetDatabase()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('support checks', () => {
  it('reports storage support when IndexedDB exists', () => {
    expect(isRecordingStorageSupported()).toBe(true)
  })

  it('reports no storage support when IndexedDB is missing', () => {
    vi.stubGlobal('indexedDB', undefined)
    expect(isRecordingStorageSupported()).toBe(false)
  })

  it('reports capture support when MediaRecorder and getUserMedia exist', () => {
    expect(isAudioCaptureSupported()).toBe(true)
  })

  it('reports no capture support when MediaRecorder is missing', () => {
    vi.stubGlobal('MediaRecorder', undefined)
    expect(isAudioCaptureSupported()).toBe(false)
  })

  it('reports no capture support when navigator is missing', () => {
    vi.stubGlobal('navigator', undefined)
    expect(isAudioCaptureSupported()).toBe(false)
  })

  it('reports no capture support when mediaDevices is missing', () => {
    vi.stubGlobal('navigator', {})
    expect(isAudioCaptureSupported()).toBe(false)
  })

  it('reports no capture support when getUserMedia is not a function', () => {
    vi.stubGlobal('navigator', { mediaDevices: {} })
    expect(isAudioCaptureSupported()).toBe(false)
  })
})

describe('recordings store', () => {
  it('returns null when no recording exists', async () => {
    await expect(getRecording('cake')).resolves.toBeNull()
    await expect(hasRecording('cake')).resolves.toBe(false)
  })

  it('saves and reads back a recording', async () => {
    const audio = new Blob(['hello'], { type: 'audio/webm;codecs=opus' })
    const saved = await saveRecording('cake', audio)
    expect(saved.text).toBe('cake')
    expect(saved.mimeType).toBe('audio/webm;codecs=opus')
    expect(Array.from(new Uint8Array(saved.audio))).toEqual([104, 101, 108, 108, 111])
    expect(saved.recordedAt).toBeLessThanOrEqual(Date.now())

    const loaded = await getRecording('cake')
    expect(loaded?.text).toBe('cake')
    expect(Array.from(new Uint8Array(loaded?.audio ?? []))).toEqual([104, 101, 108, 108, 111])
    await expect(hasRecording('cake')).resolves.toBe(true)
  })

  it('defaults the mime type to audio/webm when the blob has none', async () => {
    const saved = await saveRecording('cake', new Blob(['x']))
    expect(saved.mimeType).toBe('audio/webm')
  })

  it('replaces an existing recording for the same text', async () => {
    await saveRecording('cake', new Blob(['one']))
    await saveRecording('cake', new Blob(['longer-audio']))
    const loaded = await getRecording('cake')
    expect(new Uint8Array(loaded?.audio ?? []).length).toBe('longer-audio'.length)
  })

  it('rebuilds a playable blob from a stored recording', async () => {
    const saved = await saveRecording('cake', new Blob(['hello'], { type: 'audio/webm' }))
    const blob = recordingToBlob(saved)
    expect(blob.type).toBe('audio/webm')
    expect(blob.size).toBe(5)
  })

  it('deletes a recording', async () => {
    await saveRecording('cake', new Blob(['x']))
    await deleteRecording('cake')
    await expect(hasRecording('cake')).resolves.toBe(false)
  })

  it('normalizes keys by trimming whitespace', async () => {
    const saved = await saveRecording('  padded  ', new Blob(['x']))
    expect(saved.text).toBe('padded')
    await expect(hasRecording('padded')).resolves.toBe(true)
    await expect(hasRecording('  padded ')).resolves.toBe(true)
    expect((await getRecording('padded '))?.text).toBe('padded')
    await deleteRecording(' padded  ')
    await expect(hasRecording('padded')).resolves.toBe(false)
  })

  it('deleting a missing recording still resolves', async () => {
    await expect(deleteRecording('never-recorded')).resolves.toBeUndefined()
  })

  it('rejects when the database cannot be opened', async () => {
    const open = vi.spyOn(indexedDB, 'open').mockImplementationOnce(
      () =>
        ({
          onupgradeneeded: null,
          onsuccess: null,
          onerror: null,
        }) as unknown as IDBOpenDBRequest
    )
    try {
      const promise = getRecording('cake')
      const request = open.mock.results[0].value as unknown as {
        onerror: ((event: Event) => void) | null
      }
      request.onerror?.({} as Event)
      await expect(promise).rejects.toThrow('Could not open the voice recording database')
    } finally {
      open.mockRestore()
    }
  })

  it('skips creating the store when it already exists', async () => {
    await saveRecording('cake', new Blob(['x']))
    // Opening with a newer version re-runs onupgradeneeded with the store present.
    const db = await __openDatabaseForTests(2)
    expect(db.objectStoreNames.contains('voice-recordings')).toBe(true)
    db.close()
  })

  it('rejects when a request fails', async () => {
    const db = await __openDatabaseForTests(1)
    try {
      const tx = db.transaction('voice-recordings', 'readwrite')
      const request = tx
        .objectStore('voice-recordings')
        .put({ text: 'x', audio: new ArrayBuffer(1), mimeType: 'audio/webm', recordedAt: 1 })
      const promise = __awaitRequestForTests(request, 'Could not save the voice recording')
      tx.abort()
      await expect(promise).rejects.toThrow('Could not save the voice recording')
    } finally {
      db.close()
    }
  })

  it('closes the database when the key is invalid', async () => {
    await expect(getRecording({} as unknown as string)).rejects.toThrow()
    // The leaked-connection check: a fresh open must still work.
    await expect(getRecording('cake')).resolves.toBeNull()
  })
})

describe('startRecording', () => {
  function trackStopped() {
    const stopped: unknown[] = []
    const stream = {
      getTracks: () => [{ stop: () => stopped.push('track') }],
    }
    getUserMedia.mockResolvedValue(stream)
    return stopped
  }

  it('captures audio chunks and resolves them on stop', async () => {
    const stopped = trackStopped()
    const session = await startRecording()
    const recorder = FakeMediaRecorder.instances[0]
    expect(recorder.state).toBe('recording')

    recorder.mimeType = 'audio/webm;codecs=opus'
    recorder.ondataavailable?.({ data: new Blob(['chunk-1']) })
    recorder.ondataavailable?.({ data: new Blob([]) })
    recorder.ondataavailable?.({ data: new Blob(['chunk-2']) })

    const audio = await session.stop()
    expect(audio.type).toBe('audio/webm;codecs=opus')
    expect(await audio.text()).toBe('chunk-1chunk-2')
    expect(stopped).toHaveLength(1)
  })

  it('falls back to audio/webm when the recorder reports no mime type', async () => {
    trackStopped()
    const session = await startRecording()
    const audio = await session.stop()
    expect(audio.type).toBe('audio/webm')
  })

  it('rejects stop when the recorder errors', async () => {
    trackStopped()
    const session = await startRecording()
    FakeMediaRecorder.instances[0].onerror?.()
    await expect(session.stop()).rejects.toThrow('Recording failed')
  })

  it('rejects when microphone access is denied', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    await expect(startRecording()).rejects.toThrow('denied')
  })

  it('cancel stops an active recorder without saving', async () => {
    const stopped = trackStopped()
    const session = await startRecording()
    const recorder = FakeMediaRecorder.instances[0]
    session.cancel()
    expect(recorder.stoppedCount).toBe(1)
    expect(stopped).toHaveLength(1)
  })

  it('cancel on an already-stopped recorder only stops tracks', async () => {
    const stopped = trackStopped()
    const session = await startRecording()
    const recorder = FakeMediaRecorder.instances[0]
    await session.stop()
    session.cancel()
    expect(recorder.stoppedCount).toBe(1)
    expect(stopped).toHaveLength(2)
  })
})
