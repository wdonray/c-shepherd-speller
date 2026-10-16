/**
 * Teacher-recorded read-aloud audio.
 *
 * Recordings are captured with the device microphone and stored per device
 * in IndexedDB, keyed by the trimmed text that was recorded. When the
 * teacher is signed in, recordings also sync to the teacher's cloud storage
 * (see voice-sync.ts) so they are available on all their devices; sync is
 * best-effort and the local copy is always the source of truth for playback.
 * When the teacher taps a read-aloud button, speak() plays the recording for
 * that trimmed text when one exists, instead of the neural or built-in voice.
 *
 * Audio is stored as an ArrayBuffer (plus its MIME type) rather than a Blob:
 * ArrayBuffers round-trip through structured clone on every IndexedDB
 * implementation, while Blob support varies.
 */

export interface VoiceRecording {
  /** The trimmed text that was recorded (this is the IndexedDB key). */
  text: string
  audio: ArrayBuffer
  mimeType: string
  recordedAt: number
  /**
   * The database user ID that owns this recording, or null until the first
   * sync attributes it. Lets two teachers sharing one browser keep their
   * recordings separate once sync runs.
   */
  userId: string | null
  /**
   * Server timestamp of the last successful cloud confirmation, or null when
   * never synced (or re-recorded since). Compared against the server's
   * `updatedAt` for conflict resolution; both are server-clock.
   */
  syncedAt: number | null
}

/** One pending cloud operation for a recording. */
export interface SyncQueueOp {
  id?: number
  op: 'upload' | 'delete'
  text: string
  attempts: number
  nextRetryAt: number
}

export interface RecordingSession {
  /** Stop recording and resolve with the captured audio. */
  stop: () => Promise<Blob>
  /** Abandon the recording without saving anything. */
  cancel: () => void
  /** The live microphone stream, for visualizations. Set by startRecording. */
  stream?: MediaStream
}

const DB_NAME = 'patternspell'
const STORE_NAME = 'voice-recordings'
const QUEUE_STORE_NAME = 'voice-sync-queue'
const DB_VERSION = 2

/** True when recordings can be stored on this device. */
export function isRecordingStorageSupported(): boolean {
  return typeof indexedDB !== 'undefined'
}

/** True when the device can capture microphone audio. */
export function isAudioCaptureSupported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    typeof navigator.mediaDevices?.getUserMedia === 'function'
  )
}

/** Rebuild a playable Blob from a stored recording. */
export function recordingToBlob(recording: VoiceRecording): Blob {
  return new Blob([recording.audio], { type: recording.mimeType })
}

function openDatabase(version: number = DB_VERSION): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, version)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'text' })
      } else {
        // Backfill sync fields on pre-sync records. Idempotent: records
        // already carrying the fields are skipped, so re-running this on a
        // later upgrade is harmless.
        const store = request.transaction!.objectStore(STORE_NAME)
        const cursorRequest = store.openCursor()
        cursorRequest.onsuccess = () => {
          const cursor = cursorRequest.result
          if (cursor) {
            const value = cursor.value as Partial<VoiceRecording>
            if (value.userId === undefined || value.syncedAt === undefined) {
              cursor.update({ ...value, userId: value.userId ?? null, syncedAt: value.syncedAt ?? null })
            }
            cursor.continue()
          }
        }
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE_NAME)) {
        db.createObjectStore(QUEUE_STORE_NAME, { keyPath: 'id', autoIncrement: true })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('Could not open the voice recording database'))
  })
}

/** Test-only hook for covering the already-created store path. */
export function __openDatabaseForTests(version: number): Promise<IDBDatabase> {
  return openDatabase(version)
}

/** Resolve an IndexedDB request, rejecting with errorMessage on failure. */
function awaitRequest<T>(request: IDBRequest<T>, errorMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error(errorMessage))
  })
}

/** Test-only hook for driving the shared request wiring. */
export function __awaitRequestForTests<T>(request: IDBRequest<T>, errorMessage: string): Promise<T> {
  return awaitRequest(request, errorMessage)
}

/** The recording for text (keyed by trimmed text), or null when the teacher never recorded it. */
export async function getRecording(text: string): Promise<VoiceRecording | null> {
  const db = await openDatabase()
  try {
    const result = await awaitRequest<VoiceRecording | undefined>(
      db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(text.trim()),
      'Could not read the voice recording'
    )
    return result ?? null
  } finally {
    db.close()
  }
}

/** True when a recording exists for the trimmed text. */
export async function hasRecording(text: string): Promise<boolean> {
  return (await getRecording(text)) !== null
}

/** Save (or replace) the recording for text, keyed by trimmed text. */
export async function saveRecording(text: string, audio: Blob): Promise<VoiceRecording> {
  const db = await openDatabase()
  try {
    const trimmed = text.trim()
    // A re-record keeps the owner's attribution but must be re-uploaded:
    // new audio invalidates the previous sync state.
    const existing = await awaitRequest<VoiceRecording | undefined>(
      db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(trimmed),
      'Could not read the voice recording'
    )
    const recording: VoiceRecording = {
      text: trimmed,
      audio: await audio.arrayBuffer(),
      mimeType: audio.type || 'audio/webm',
      recordedAt: Date.now(),
      userId: existing?.userId ?? null,
      syncedAt: null,
    }
    await awaitRequest(
      db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(recording),
      'Could not save the voice recording'
    )
    return recording
  } finally {
    db.close()
  }
}

/**
 * Write a recording exactly as given (no timestamp or attribution changes).
 * Used by the sync engine when storing a version downloaded from the cloud.
 */
export async function putRecording(recording: VoiceRecording): Promise<void> {
  const db = await openDatabase()
  try {
    await awaitRequest(
      db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(recording),
      'Could not save the voice recording'
    )
  } finally {
    db.close()
  }
}

/** Every recording on this device. */
export async function getAllRecordings(): Promise<VoiceRecording[]> {
  const db = await openDatabase()
  try {
    return await awaitRequest<VoiceRecording[]>(
      db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).getAll(),
      'Could not read the voice recordings'
    )
  } finally {
    db.close()
  }
}

/**
 * Mark a recording as successfully synced: attribute it to the teacher and
 * stamp the server's confirmation time (the conflict-resolution clock).
 * No-op when the recording no longer exists.
 */
export async function markRecordingSynced(text: string, userId: string, syncedAt: number): Promise<void> {
  const db = await openDatabase()
  try {
    const store = db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME)
    const existing = await awaitRequest<VoiceRecording | undefined>(
      store.get(text.trim()),
      'Could not read the voice recording'
    )
    if (!existing) return
    await awaitRequest(store.put({ ...existing, userId, syncedAt }), 'Could not save the voice recording')
  } finally {
    db.close()
  }
}

/**
 * Queue a cloud operation for retry. Deduplicated: an identical pending op
 * for the same text is kept as-is (its backoff stands).
 */
export async function enqueueSyncOp(op: 'upload' | 'delete', text: string): Promise<void> {
  const db = await openDatabase()
  try {
    const store = db.transaction(QUEUE_STORE_NAME, 'readwrite').objectStore(QUEUE_STORE_NAME)
    const existing = await awaitRequest<SyncQueueOp[]>(store.getAll(), 'Could not read the voice sync queue')
    if (existing.some((item) => item.op === op && item.text === text.trim())) return
    await awaitRequest(
      store.add({ op, text: text.trim(), attempts: 0, nextRetryAt: Date.now() } as SyncQueueOp),
      'Could not queue the voice sync operation'
    )
  } finally {
    db.close()
  }
}

/** Queued operations whose backoff has elapsed, oldest first. */
export async function getDueSyncOps(now: number = Date.now()): Promise<SyncQueueOp[]> {
  const db = await openDatabase()
  try {
    const ops = await awaitRequest<SyncQueueOp[]>(
      db.transaction(QUEUE_STORE_NAME, 'readonly').objectStore(QUEUE_STORE_NAME).getAll(),
      'Could not read the voice sync queue'
    )
    return ops.filter((op) => op.nextRetryAt <= now).sort((a, b) => a.nextRetryAt - b.nextRetryAt)
  } finally {
    db.close()
  }
}

/** Remove a queued operation (it succeeded or became unnecessary). */
export async function deleteSyncOp(id: number): Promise<void> {
  const db = await openDatabase()
  try {
    await awaitRequest(
      db.transaction(QUEUE_STORE_NAME, 'readwrite').objectStore(QUEUE_STORE_NAME).delete(id),
      'Could not update the voice sync queue'
    )
  } finally {
    db.close()
  }
}

/** Record a failed attempt and schedule the next retry. */
export async function updateSyncOpRetry(id: number, attempts: number, nextRetryAt: number): Promise<void> {
  const db = await openDatabase()
  try {
    const store = db.transaction(QUEUE_STORE_NAME, 'readwrite').objectStore(QUEUE_STORE_NAME)
    const existing = await awaitRequest<SyncQueueOp | undefined>(store.get(id), 'Could not read the voice sync queue')
    if (!existing) return
    await awaitRequest(store.put({ ...existing, attempts, nextRetryAt }), 'Could not update the voice sync queue')
  } finally {
    db.close()
  }
}

/** Delete the recording for text (keyed by trimmed text). Resolves even when none exists. */
export async function deleteRecording(text: string): Promise<void> {
  const db = await openDatabase()
  try {
    await awaitRequest(
      db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(text.trim()),
      'Could not delete the voice recording'
    )
  } finally {
    db.close()
  }
}

/**
 * How long to wait for the browser to answer a microphone permission
 * request before treating it as stuck. The getUserMedia promise is supposed
 * to settle once the teacher answers the permission prompt, but browsers
 * can leave it pending forever when the prompt cannot be shown (a
 * previously dismissed prompt is one known trigger). The timeout turns that
 * dead end into a TimeoutError the caller can explain, instead of a UI that
 * hangs forever.
 */
export const MICROPHONE_REQUEST_TIMEOUT_MS = 15000

/**
 * Ask the browser for microphone access, rejecting with a TimeoutError when
 * the browser never answers within `timeoutMs`.
 *
 * Call this directly from a user gesture (a button click). Browsers only
 * show the permission prompt for requests made in a gesture; requests made
 * from effects or promise callbacks are silently dropped, with no prompt
 * and no rejection.
 *
 * When the wait is abandoned (timeout or `signal` abort) but the browser
 * grants access afterwards, the late stream's tracks are stopped at once so
 * the microphone indicator does not linger.
 */
export function requestMicrophoneStream(timeoutMs: number, signal?: AbortSignal): Promise<MediaStream> {
  return new Promise<MediaStream>((resolve, reject) => {
    let done = false
    const settle = (outcome: { stream?: MediaStream; error?: unknown }): void => {
      if (done) {
        // The wait was already abandoned; release a late-arriving stream.
        outcome.stream?.getTracks().forEach((track) => track.stop())
        return
      }
      done = true
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
      if (outcome.error !== undefined) reject(outcome.error)
      else resolve(outcome.stream as MediaStream)
    }
    const timer = setTimeout(() => {
      settle({ error: new DOMException('Microphone request timed out', 'TimeoutError') })
    }, timeoutMs)
    const onAbort = (): void => {
      settle({ error: new DOMException('Microphone request was cancelled', 'AbortError') })
    }
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => settle({ stream }))
      .catch((error: unknown) => settle({ error }))
  })
}

/** An in-flight microphone permission request the UI can await and cancel. */
export interface MicrophoneRequest {
  /** Resolves with the microphone stream once the browser grants access. */
  promise: Promise<MediaStream>
  /** Abandon the wait; a late-arriving stream is stopped on arrival. */
  cancel: () => void
}

/**
 * Start a cancellable microphone permission request. The caller must invoke
 * this directly from a user gesture (see requestMicrophoneStream) and hand
 * the returned request to the UI that awaits the answer.
 */
export function requestMicrophoneAccess(timeoutMs: number): MicrophoneRequest {
  const controller = new AbortController()
  return {
    promise: requestMicrophoneStream(timeoutMs, controller.signal),
    cancel: () => controller.abort(),
  }
}

/**
 * Start capturing microphone audio. Recording begins immediately; the
 * teacher taps stop when done. Rejects when microphone access is denied.
 *
 * Pass a pre-authorized stream (from requestMicrophoneStream) to record
 * from an already-granted permission without asking the browser twice.
 */
export async function startRecording(existingStream?: MediaStream): Promise<RecordingSession> {
  const stream = existingStream ?? (await navigator.mediaDevices.getUserMedia({ audio: true }))
  const stopTracks = (): void => {
    for (const track of stream.getTracks()) track.stop()
  }
  const recorder = new MediaRecorder(stream)
  const chunks: Blob[] = []
  let failed: Error | null = null
  recorder.ondataavailable = (event: BlobEvent) => {
    if (event.data.size > 0) chunks.push(event.data)
  }
  recorder.onerror = () => {
    failed = new Error('Recording failed')
  }
  recorder.start()
  return {
    stream,
    stop: () =>
      new Promise<Blob>((resolve, reject) => {
        recorder.onstop = () => {
          stopTracks()
          if (failed) reject(failed)
          else resolve(new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }))
        }
        recorder.stop()
      }),
    cancel: () => {
      stopTracks()
      if (recorder.state !== 'inactive') recorder.stop()
    },
  }
}
