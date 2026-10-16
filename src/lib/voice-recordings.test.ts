import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  __awaitRequestForTests,
  __openDatabaseForTests,
  deleteRecording,
  deleteSyncOp,
  enqueueSyncOp,
  getAllRecordings,
  getDueSyncOps,
  getRecording,
  hasRecording,
  isAudioCaptureSupported,
  isRecordingStorageSupported,
  markRecordingSynced,
  putRecording,
  recordingToBlob,
  requestMicrophoneAccess,
  requestMicrophoneStream,
  saveRecording,
  startRecording,
  updateSyncOpRetry,
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

describe('requestMicrophoneStream', () => {
  function fakeStream() {
    const stop = vi.fn()
    const stream = { getTracks: () => [{ stop }] } as unknown as MediaStream
    return { stream, stop }
  }

  it('resolves with the granted stream', async () => {
    const { stream } = fakeStream()
    getUserMedia.mockResolvedValue(stream)
    await expect(requestMicrophoneStream(15000)).resolves.toBe(stream)
    expect(getUserMedia).toHaveBeenCalledWith({ audio: true })
  })

  it('rejects with the browser error when access is denied', async () => {
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))
    await expect(requestMicrophoneStream(15000)).rejects.toMatchObject({ name: 'NotAllowedError' })
  })

  it('rejects with TimeoutError when the browser never answers', async () => {
    vi.useFakeTimers()
    try {
      let resolveGum!: (stream: MediaStream) => void
      getUserMedia.mockReturnValue(new Promise((resolve) => (resolveGum = resolve)))
      const promise = requestMicrophoneStream(15000)
      const assertion = expect(promise).rejects.toMatchObject({ name: 'TimeoutError' })
      await vi.advanceTimersByTimeAsync(15000)
      await assertion
      // A late grant after the timeout is released immediately.
      vi.useRealTimers()
      const { stream, stop } = fakeStream()
      resolveGum(stream)
      await Promise.resolve()
      await Promise.resolve()
      expect(stop).toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('aborts the wait when the signal fires', async () => {
    const controller = new AbortController()
    let rejectGum!: (error: unknown) => void
    getUserMedia.mockReturnValue(new Promise((_resolve, reject) => (rejectGum = reject)))
    const promise = requestMicrophoneStream(15000, controller.signal)
    const assertion = expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await assertion
    // A late rejection after the abort needs no stream cleanup.
    rejectGum(new DOMException('denied', 'NotAllowedError'))
    await Promise.resolve()
    await Promise.resolve()
    expect(true).toBe(true)
  })

  it('stops a late-arriving stream after the abort', async () => {
    const controller = new AbortController()
    let resolveGum!: (stream: MediaStream) => void
    getUserMedia.mockReturnValue(new Promise((resolve) => (resolveGum = resolve)))
    const promise = requestMicrophoneStream(15000, controller.signal)
    controller.abort()
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
    const { stream, stop } = fakeStream()
    resolveGum(stream)
    await Promise.resolve()
    await Promise.resolve()
    expect(stop).toHaveBeenCalled()
  })

  it('rejects immediately without asking when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(requestMicrophoneStream(15000, controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    })
    expect(getUserMedia).not.toHaveBeenCalled()
  })
})

describe('requestMicrophoneAccess', () => {
  it('returns a cancellable in-flight request', async () => {
    getUserMedia.mockReturnValue(new Promise(() => {}))
    const request = requestMicrophoneAccess(15000)
    const assertion = expect(request.promise).rejects.toMatchObject({ name: 'AbortError' })
    request.cancel()
    await assertion
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

  it('records from a pre-authorized stream without asking again', async () => {
    const stopped: unknown[] = []
    const stream = {
      getTracks: () => [{ stop: () => stopped.push('track') }],
    } as unknown as MediaStream
    const session = await startRecording(stream)
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(FakeMediaRecorder.instances[0].stream).toBe(stream)
    await session.stop()
    expect(stopped).toHaveLength(1)
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

describe('sync fields (v2)', () => {
  it('stores new recordings unattributed and unsynced', async () => {
    const saved = await saveRecording('cake', new Blob(['x'], { type: 'audio/webm' }))
    expect(saved.userId).toBeNull()
    expect(saved.syncedAt).toBeNull()
  })

  it('preserves attribution across re-records but resets sync state', async () => {
    await saveRecording('cake', new Blob(['x'], { type: 'audio/webm' }))
    await markRecordingSynced('cake', 'u1', 999)
    const rerecorded = await saveRecording('cake', new Blob(['y'], { type: 'audio/webm' }))
    expect(rerecorded.userId).toBe('u1')
    expect(rerecorded.syncedAt).toBeNull()
  })

  it('migrates v1 records without losing audio', async () => {
    // Build a v1 database directly, bypassing the v2 open path.
    const db = await __openDatabaseForTests(1)
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('voice-recordings', 'readwrite')
      const store = tx.objectStore('voice-recordings')
      store.put({
        text: 'cake',
        audio: new Uint8Array([1, 2, 3]).buffer,
        mimeType: 'audio/webm',
        recordedAt: 100,
      })
      // A record that already carries sync fields is left untouched.
      store.put({
        text: 'bake',
        audio: new Uint8Array([4]).buffer,
        mimeType: 'audio/webm',
        recordedAt: 100,
        userId: 'u1',
        syncedAt: 200,
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(new Error('seed failed'))
    })
    db.close()
    // Opening at v2 runs the migration.
    const migrated = await getRecording('cake')
    expect(migrated?.userId).toBeNull()
    expect(migrated?.syncedAt).toBeNull()
    expect(Array.from(new Uint8Array(migrated!.audio))).toEqual([1, 2, 3])
    const untouched = await getRecording('bake')
    expect(untouched?.userId).toBe('u1')
    expect(untouched?.syncedAt).toBe(200)
  })

  it('migrating an empty v1 database is a no-op', async () => {
    const db = await __openDatabaseForTests(1)
    db.close()
    // Opening at v2 runs the migration over zero records.
    await saveRecording('cake', new Blob(['x'], { type: 'audio/webm' }))
    await expect(hasRecording('cake')).resolves.toBe(true)
  })

  it('lists every recording', async () => {
    await saveRecording('cake', new Blob(['x'], { type: 'audio/webm' }))
    await saveRecording('bake', new Blob(['y'], { type: 'audio/webm' }))
    const all = await getAllRecordings()
    expect(all.map((r) => r.text).sort()).toEqual(['bake', 'cake'])
  })

  it('writes a recording verbatim with putRecording', async () => {
    await putRecording({
      text: 'cake',
      audio: new Uint8Array([9]).buffer,
      mimeType: 'audio/webm',
      recordedAt: 100,
      userId: 'u1',
      syncedAt: 200,
    })
    const loaded = await getRecording('cake')
    expect(loaded?.userId).toBe('u1')
    expect(loaded?.syncedAt).toBe(200)
    expect(loaded?.recordedAt).toBe(100)
  })

  it('marks recordings synced with the server timestamp', async () => {
    await saveRecording('cake', new Blob(['x'], { type: 'audio/webm' }))
    await markRecordingSynced('cake', 'u1', 999)
    const loaded = await getRecording('cake')
    expect(loaded?.userId).toBe('u1')
    expect(loaded?.syncedAt).toBe(999)
  })

  it('markRecordingSynced is a no-op when the recording is gone', async () => {
    await expect(markRecordingSynced('ghost', 'u1', 1)).resolves.toBeUndefined()
  })
})

describe('sync queue', () => {
  it('enqueues and returns due operations oldest first', async () => {
    await enqueueSyncOp('upload', 'cake')
    await enqueueSyncOp('delete', 'bake')
    const due = await getDueSyncOps(Date.now() + 1000)
    expect(due.map((op) => op.text)).toEqual(['cake', 'bake'])
    expect(due[0].op).toBe('upload')
    expect(due[0].attempts).toBe(0)
  })

  it('dedupes identical pending operations', async () => {
    await enqueueSyncOp('upload', 'cake')
    await enqueueSyncOp('upload', 'cake')
    await enqueueSyncOp('delete', 'cake')
    const due = await getDueSyncOps(Date.now() + 1000)
    expect(due).toHaveLength(2)
  })

  it('hides operations whose backoff has not elapsed', async () => {
    await enqueueSyncOp('upload', 'cake')
    expect(await getDueSyncOps(0)).toHaveLength(0)
  })

  it('deletes queue entries', async () => {
    await enqueueSyncOp('upload', 'cake')
    const [op] = await getDueSyncOps(Date.now() + 1000)
    await deleteSyncOp(op.id!)
    expect(await getDueSyncOps(Date.now() + 1000)).toHaveLength(0)
  })

  it('updates retry state', async () => {
    await enqueueSyncOp('upload', 'cake')
    const [op] = await getDueSyncOps(Date.now() + 1000)
    const nextRetryAt = Date.now() + 60_000
    await updateSyncOpRetry(op.id!, 2, nextRetryAt)
    expect(await getDueSyncOps(Date.now() + 1000)).toHaveLength(0)
    const [updated] = await getDueSyncOps(nextRetryAt + 1000)
    expect(updated.attempts).toBe(2)
  })

  it('updateSyncOpRetry is a no-op for a missing entry', async () => {
    await expect(updateSyncOpRetry(12345, 1, Date.now())).resolves.toBeUndefined()
  })
})
