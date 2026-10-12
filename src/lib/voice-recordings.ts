/**
 * Teacher-recorded read-aloud audio.
 *
 * Recordings are captured with the device microphone and stored per device
 * in IndexedDB, keyed by the exact text that was recorded. They never leave
 * the browser: no upload, no sync, fully offline. When the teacher taps a
 * read-aloud button, speak() plays the recording for that exact text when
 * one exists, instead of the neural or built-in voice.
 *
 * Audio is stored as an ArrayBuffer (plus its MIME type) rather than a Blob:
 * ArrayBuffers round-trip through structured clone on every IndexedDB
 * implementation, while Blob support varies.
 */

export interface VoiceRecording {
  /** The exact text that was recorded (this is the IndexedDB key). */
  text: string
  audio: ArrayBuffer
  mimeType: string
  recordedAt: number
}

export interface RecordingSession {
  /** Stop recording and resolve with the captured audio. */
  stop: () => Promise<Blob>
  /** Abandon the recording without saving anything. */
  cancel: () => void
}

const DB_NAME = 'patternspell'
const STORE_NAME = 'voice-recordings'
const DB_VERSION = 1

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

/** The recording for text, or null when the teacher never recorded it. */
export async function getRecording(text: string): Promise<VoiceRecording | null> {
  const db = await openDatabase()
  try {
    const result = await awaitRequest<VoiceRecording | undefined>(
      db.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(text),
      'Could not read the voice recording'
    )
    return result ?? null
  } finally {
    db.close()
  }
}

/** True when a recording exists for the exact text. */
export async function hasRecording(text: string): Promise<boolean> {
  return (await getRecording(text)) !== null
}

/** Save (or replace) the recording for text. */
export async function saveRecording(text: string, audio: Blob): Promise<VoiceRecording> {
  const db = await openDatabase()
  try {
    const recording: VoiceRecording = {
      text,
      audio: await audio.arrayBuffer(),
      mimeType: audio.type || 'audio/webm',
      recordedAt: Date.now(),
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

/** Delete the recording for text. Resolves even when none exists. */
export async function deleteRecording(text: string): Promise<void> {
  const db = await openDatabase()
  try {
    await awaitRequest(
      db.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).delete(text),
      'Could not delete the voice recording'
    )
  } finally {
    db.close()
  }
}

/**
 * Start capturing microphone audio. Recording begins immediately; the
 * teacher taps stop when done. Rejects when microphone access is denied.
 */
export async function startRecording(): Promise<RecordingSession> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
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
