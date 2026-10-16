/**
 * Cross-device sync engine for voice recordings.
 *
 * When the teacher is signed in, recordings are kept in sync with their
 * cloud storage (S3 + DynamoDB metadata) so they are available on all their
 * devices. The local IndexedDB copy is always the source of truth for
 * playback.
 *
 * THE IRON RULE: sync is best-effort and never breaks recording. Every
 * function here degrades to local-only behavior on any failure: no throws
 * escape, no user-facing errors, no blocking the UI. Failures are reported
 * quietly via reportError and retried with backoff.
 *
 * Conflict resolution: last-write-wins, ordered by the server's `updatedAt`
 * (stamped at upload-confirm time). Device clocks are not trusted, so the
 * client `recordedAt` is display metadata only.
 */

import { getSession } from 'next-auth/react'
import {
  getRecording,
  getAllRecordings,
  putRecording,
  deleteRecording,
  markRecordingSynced,
  enqueueSyncOp,
  getDueSyncOps,
  deleteSyncOp,
  updateSyncOpRetry,
  type VoiceRecording,
} from './voice-recordings'
import { getUserByEmail } from './spelling-api'
import { reportError } from './report-error'

/** Retry backoff for queued operations: 1m, 5m, 15m, 1h (capped). */
const RETRY_DELAYS_MS = [60_000, 5 * 60_000, 15 * 60_000, 60 * 60_000]

/** How long a direct-to-S3 PUT may take before it is abandoned and retried. */
const S3_PUT_TIMEOUT_MS = 60_000

/** Batch size for download URL requests (the API caps at 100 texts). */
const DOWNLOAD_BATCH_SIZE = 100

/** Guard against overlapping sync passes (a known real-world bug source). */
let syncInFlight = false

/** Test-only hook to reset the already-running guard. */
export function __resetSyncGuardForTests(): void {
  syncInFlight = false
}

/** Thrown when the teacher's cloud storage quota is full (HTTP 413). */
export class QuotaExceededError extends Error {
  constructor() {
    super('Voice storage quota exceeded')
    this.name = 'QuotaExceededError'
  }
}

/**
 * Thrown when a local recording can never pass begin-upload validation
 * (e.g. zero bytes of audio). Retrying is pointless: report once and drop
 * the queued op instead of retrying with backoff forever.
 */
export class UnsyncableRecordingError extends Error {
  constructor(detail: string) {
    super(`Voice recording cannot be uploaded: ${detail}`)
    this.name = 'UnsyncableRecordingError'
  }
}

interface RemoteRecording {
  text: string
  mimeType: string
  byteSize: number
  recordedAt: number
  updatedAt: number
}

/** True when this device's copy belongs to the signed-in teacher (or nobody yet). */
function isMine(local: VoiceRecording, userId: string): boolean {
  return local.userId === null || local.userId === userId
}

async function getRemoteIndex(): Promise<RemoteRecording[]> {
  const res = await fetch('/api/voice-recordings')
  if (!res.ok) throw new Error(`Voice sync list failed with ${res.status}`)
  const data = (await res.json()) as { recordings?: RemoteRecording[] }
  return data.recordings ?? []
}

/**
 * Upload one local recording: begin (presigned PUT) -> PUT bytes to S3 ->
 * confirm. Returns the server's `updatedAt`, the conflict-resolution clock.
 */
async function uploadSingle(recording: VoiceRecording): Promise<number> {
  const byteSize = recording.audio.byteLength
  if (!Number.isInteger(byteSize) || byteSize < 1) {
    // Empty audio can never pass begin-upload validation (min 1 byte); the
    // sync engine treats this as permanent, not retryable.
    throw new UnsyncableRecordingError(`byteSize=${String(byteSize)}`)
  }
  const beginRes = await fetch('/api/voice-recordings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: recording.text,
      mimeType: recording.mimeType,
      byteSize,
      recordedAt: recording.recordedAt,
    }),
  })
  if (beginRes.status === 413) throw new QuotaExceededError()
  if (!beginRes.ok) {
    // The server names the failing fields in the 400 body; carry them (and
    // the sent metadata) into the Sentry report so the cause is visible.
    const detail = await beginRes
      .json()
      .then((data: unknown) => JSON.stringify((data as { details?: unknown })?.details ?? null))
      .catch(() => 'unreadable')
    throw new Error(
      `Voice upload begin failed with ${beginRes.status} ` +
        `(mimeType=${recording.mimeType} byteSize=${byteSize} textLength=${recording.text.length} details=${detail})`
    )
  }
  const { uploadUrl } = (await beginRes.json()) as { uploadUrl: string }

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': recording.mimeType },
    body: recording.audio,
    signal: AbortSignal.timeout(S3_PUT_TIMEOUT_MS),
  })
  if (!putRes.ok) throw new Error(`Voice S3 upload failed with ${putRes.status}`)

  const confirmRes = await fetch('/api/voice-recordings', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: recording.text }),
  })
  if (!confirmRes.ok) throw new Error(`Voice upload confirm failed with ${confirmRes.status}`)
  const { updatedAt } = (await confirmRes.json()) as { updatedAt: number }
  return updatedAt
}

async function deleteRemoteRecording(text: string): Promise<void> {
  const res = await fetch('/api/voice-recordings', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) throw new Error(`Voice remote delete failed with ${res.status}`)
}

async function downloadBatch(
  texts: string[],
  userId: string,
  remoteByText: Map<string, RemoteRecording>
): Promise<void> {
  const res = await fetch('/api/voice-recordings/download-urls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ texts }),
  })
  if (!res.ok) throw new Error(`Voice download URLs failed with ${res.status}`)
  const { urls } = (await res.json()) as { urls: Record<string, string> }
  for (const [text, url] of Object.entries(urls)) {
    const remote = remoteByText.get(text)
    if (!remote) continue
    const audioRes = await fetch(url)
    if (!audioRes.ok) throw new Error(`Voice download failed with ${audioRes.status}`)
    const blob = await audioRes.blob()
    // Store the cloud version verbatim: the server's updatedAt becomes the
    // local syncedAt so later comparisons stay on the server clock.
    await putRecording({
      text: remote.text,
      audio: await blob.arrayBuffer(),
      mimeType: remote.mimeType,
      recordedAt: remote.recordedAt,
      userId,
      syncedAt: remote.updatedAt,
    })
  }
}

function retryDelay(attempts: number): number {
  return RETRY_DELAYS_MS[Math.min(attempts, RETRY_DELAYS_MS.length - 1)]
}

async function drainQueue(userId: string): Promise<void> {
  const ops = await getDueSyncOps()
  for (const op of ops) {
    if (op.id === undefined) continue
    try {
      if (op.op === 'upload') {
        const local = await getRecording(op.text)
        if (!local || !isMine(local, userId) || local.syncedAt !== null) {
          // Gone, someone else's, or already synced by the main pass.
          await deleteSyncOp(op.id)
          continue
        }
        const updatedAt = await uploadSingle(local)
        await markRecordingSynced(local.text, userId, updatedAt)
      } else {
        await deleteRemoteRecording(op.text)
      }
      await deleteSyncOp(op.id)
    } catch (error) {
      if (error instanceof QuotaExceededError || error instanceof UnsyncableRecordingError) {
        // Retrying cannot help: the quota needs the teacher to delete
        // something, and an unsyncable recording can never validate.
        reportError(error, { location: 'voice-sync.drainQueue' })
        await deleteSyncOp(op.id)
        continue
      }
      reportError(error, { location: 'voice-sync.drainQueue' })
      const attempts = op.attempts + 1
      await updateSyncOpRetry(op.id, attempts, Date.now() + retryDelay(attempts))
    }
  }
}

/**
 * Full sync pass: upload unsynced locals, download newer remotes, propagate
 * deletes, then drain the retry queue. Never throws.
 */
export async function syncNow(options?: { userId?: string }): Promise<void> {
  if (syncInFlight) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  syncInFlight = true
  try {
    const session = await getSession().catch(() => null)
    const email = session?.user?.email
    if (!email) return
    const userId =
      options?.userId ??
      (await getUserByEmail(email)
        .then((u) => u.id)
        .catch(() => null))
    if (!userId) return

    const remote = await getRemoteIndex()
    const remoteByText = new Map(remote.map((r) => [r.text, r]))

    // 1. Upload: locals never synced (re-records reset syncedAt).
    let quotaFull = false
    for (const local of await getAllRecordings()) {
      if (quotaFull) break
      if (!isMine(local, userId) || local.syncedAt !== null) continue
      try {
        const updatedAt = await uploadSingle(local)
        await markRecordingSynced(local.text, userId, updatedAt)
      } catch (error) {
        if (error instanceof QuotaExceededError) {
          reportError(error, { location: 'voice-sync.syncNow' })
          quotaFull = true
          continue
        }
        if (error instanceof UnsyncableRecordingError) {
          // Retrying cannot help: report once, do not enqueue.
          reportError(error, { location: 'voice-sync.syncNow' })
          continue
        }
        reportError(error, { location: 'voice-sync.syncNow' })
        await enqueueSyncOp('upload', local.text)
      }
    }

    // Re-read locals: uploads above changed syncedAt.
    const locals = await getAllRecordings()
    const localByText = new Map(locals.map((r) => [r.text, r]))

    // 2. Download: missing locally, or the cloud version is newer
    // (server updatedAt vs server stamped syncedAt: one clock).
    const toDownload: string[] = []
    for (const item of remote) {
      const local = localByText.get(item.text)
      if (!local) {
        toDownload.push(item.text)
      } else if (isMine(local, userId) && local.syncedAt !== null && item.updatedAt > local.syncedAt) {
        toDownload.push(item.text)
      }
    }
    for (let i = 0; i < toDownload.length; i += DOWNLOAD_BATCH_SIZE) {
      await downloadBatch(toDownload.slice(i, i + DOWNLOAD_BATCH_SIZE), userId, remoteByText)
    }

    // 3. Delete propagation (no tombstones): a previously synced local that
    // is gone from the cloud was deleted on another device.
    for (const local of localByText.values()) {
      if (!isMine(local, userId) || local.syncedAt === null) continue
      if (!remoteByText.has(local.text)) {
        await deleteRecording(local.text)
      }
    }

    // 4. Drain the retry queue.
    await drainQueue(userId)
  } catch (error) {
    // The iron rule: sync never breaks the app.
    reportError(error, { location: 'voice-sync.syncNow' })
  } finally {
    syncInFlight = false
  }
}

export type NotifyResult = 'synced' | 'queued' | 'quota-full' | 'skipped'

/**
 * Called after a local save. Tries the upload immediately so a second device
 * sees the recording quickly; enqueues on failure. Never throws.
 */
export async function notifyRecordingSaved(recording: VoiceRecording): Promise<NotifyResult> {
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await enqueueSyncOp('upload', recording.text)
      return 'queued'
    }
    const session = await getSession().catch(() => null)
    const email = session?.user?.email
    if (!email) return 'skipped'
    const user = await getUserByEmail(email).catch(() => null)
    if (!user || !isMine(recording, user.id)) return 'skipped'
    const updatedAt = await uploadSingle(recording)
    await markRecordingSynced(recording.text, user.id, updatedAt)
    return 'synced'
  } catch (error) {
    if (error instanceof QuotaExceededError) return 'quota-full'
    if (error instanceof UnsyncableRecordingError) {
      // Retrying cannot help: report once, do not enqueue.
      reportError(error, { location: 'voice-sync.notifyRecordingSaved' })
      return 'skipped'
    }
    reportError(error, { location: 'voice-sync.notifyRecordingSaved' })
    try {
      await enqueueSyncOp('upload', recording.text)
    } catch {
      // Queue write failed; the next full pass will pick it up via syncedAt.
    }
    return 'queued'
  }
}

/**
 * Called after a local delete. Deletes the cloud copy too (or enqueues).
 * Never throws.
 */
export async function notifyRecordingDeleted(text: string): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      await enqueueSyncOp('delete', text)
      return
    }
    const session = await getSession().catch(() => null)
    if (!session?.user?.email) return
    await deleteRemoteRecording(text)
  } catch (error) {
    reportError(error, { location: 'voice-sync.notifyRecordingDeleted' })
    try {
      await enqueueSyncOp('delete', text)
    } catch {
      // The next full pass's delete propagation covers stragglers.
    }
  }
}
