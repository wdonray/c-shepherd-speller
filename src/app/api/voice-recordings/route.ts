/**
 * Voice recording sync API.
 *
 * All routes require a signed-in session resolved to the caller's database
 * user record (401/403 otherwise). Every operation is scoped to the caller's
 * own recordings: the S3 key prefix and DynamoDB partition are derived
 * server-side from the authenticated user, so a caller can never address
 * another teacher's audio.
 *
 * Uploads go directly from the browser to S3 via presigned URLs; audio bytes
 * never pass through the Lambda (which caps payloads at ~6 MB).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { QueryCommand, PutCommand, GetCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb'
import { requireUser } from '@/lib/require-auth'
import { noStore, noStoreJson } from '@/lib/no-store'
import { reportError } from '@/lib/report-error'
import {
  VOICE_RECORDINGS_TABLE_NAME,
  VOICE_STORAGE_QUOTA_BYTES,
  VOICE_MAX_RECORDING_BYTES,
  VOICE_MIME_ALLOWLIST,
  voiceRecordKeys,
  voiceS3Key,
  type VoiceRecordingItem,
} from '@/models/VoiceRecording'
import { getVoiceDocClient, getPresignedPutUrl, s3ObjectExists, deleteS3Object } from '@/lib/s3'

export const dynamic = 'force-dynamic'

const TextSchema = z.string().trim().min(1).max(100)

const BeginUploadSchema = z.object({
  text: TextSchema,
  mimeType: z.enum(VOICE_MIME_ALLOWLIST),
  byteSize: z.number().int().min(1).max(VOICE_MAX_RECORDING_BYTES),
  recordedAt: z.number().int().positive(),
})

const ConfirmSchema = z.object({ text: TextSchema })

const DeleteSchema = z.object({ text: TextSchema })

/** Incomplete uploads older than this are swept as orphans. */
const ORPHAN_UPLOAD_MS = 24 * 60 * 60 * 1000

async function queryUserItems(dbUserId: string): Promise<VoiceRecordingItem[]> {
  const result = await getVoiceDocClient().send(
    new QueryCommand({
      TableName: VOICE_RECORDINGS_TABLE_NAME,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': `USER#${dbUserId}` },
    })
  )
  return (result.Items ?? []) as VoiceRecordingItem[]
}

/**
 * Delete stale incomplete uploads: a client that died between begin-upload
 * and confirm leaves a metadata row (and possibly an S3 object) behind.
 * Runs on every begin-upload so no cron is needed.
 */
async function sweepOrphanUploads(dbUserId: string): Promise<void> {
  const cutoff = Date.now() - ORPHAN_UPLOAD_MS
  const items = await queryUserItems(dbUserId)
  const orphans = items.filter((item) => !item.uploadComplete && item.updatedAt < cutoff)
  for (const orphan of orphans) {
    try {
      await deleteS3Object(orphan.s3Key)
      await getVoiceDocClient().send(
        new DeleteCommand({
          TableName: VOICE_RECORDINGS_TABLE_NAME,
          Key: { PK: orphan.PK, SK: orphan.SK },
        })
      )
    } catch (error) {
      // Best-effort: the next upload sweeps again. Never fail the upload.
      reportError(error, { location: 'sweepOrphanUploads' })
    }
  }
}

/** GET /api/voice-recordings — the caller's synced recording index. */
export async function GET() {
  const auth = await requireUser()
  if (auth.response) return noStore(auth.response)

  try {
    const items = await queryUserItems(auth.user.id)
    const recordings = items
      .filter((item) => item.uploadComplete)
      .map(({ text, mimeType, byteSize, recordedAt, updatedAt }) => ({
        text,
        mimeType,
        byteSize,
        recordedAt,
        updatedAt,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt)
    return noStoreJson({ recordings })
  } catch (error) {
    reportError(error, { location: 'GET /api/voice-recordings' })
    return noStoreJson({ error: 'Failed to list voice recordings' }, { status: 500 })
  }
}

/** POST /api/voice-recordings — begin an upload; returns a presigned PUT URL. */
export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return noStore(auth.response)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return noStoreJson({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = BeginUploadSchema.safeParse(body)
  if (!parsed.success) {
    return noStoreJson({ error: 'Invalid upload request' }, { status: 400 })
  }
  const { text, mimeType, byteSize, recordedAt } = parsed.data

  try {
    const keys = voiceRecordKeys(auth.user.id, text)
    // Quota counts current usage excluding the item being replaced, so a
    // re-record near the limit is not falsely rejected.
    const items = await queryUserItems(auth.user.id)
    const usage = items.reduce((sum, item) => sum + (item.SK === keys.SK ? 0 : item.byteSize), 0)
    if (usage + byteSize > VOICE_STORAGE_QUOTA_BYTES) {
      return noStoreJson(
        {
          error: 'Your voice storage is full. Delete some recordings to make room.',
          usage,
          quota: VOICE_STORAGE_QUOTA_BYTES,
        },
        { status: 413 }
      )
    }

    const s3Key = voiceS3Key(auth.user.id, text, mimeType)
    const now = Date.now()
    const item: VoiceRecordingItem = {
      ...keys,
      text: text.trim(),
      s3Key,
      mimeType,
      byteSize,
      recordedAt,
      updatedAt: now,
      uploadComplete: false,
    }
    await getVoiceDocClient().send(new PutCommand({ TableName: VOICE_RECORDINGS_TABLE_NAME, Item: item }))
    await sweepOrphanUploads(auth.user.id)

    const uploadUrl = await getPresignedPutUrl(s3Key, mimeType, byteSize)
    return noStoreJson({ uploadUrl, s3Key, expiresIn: 900 })
  } catch (error) {
    reportError(error, { location: 'POST /api/voice-recordings' })
    return noStoreJson({ error: 'Failed to start voice upload' }, { status: 500 })
  }
}

/** PATCH /api/voice-recordings — confirm the S3 PUT landed. */
export async function PATCH(request: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return noStore(auth.response)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return noStoreJson({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = ConfirmSchema.safeParse(body)
  if (!parsed.success) {
    return noStoreJson({ error: 'Invalid confirm request' }, { status: 400 })
  }
  const { text } = parsed.data

  try {
    const keys = voiceRecordKeys(auth.user.id, text)
    const existing = await getVoiceDocClient().send(
      new GetCommand({ TableName: VOICE_RECORDINGS_TABLE_NAME, Key: keys })
    )
    const item = existing.Item as VoiceRecordingItem | undefined
    if (!item) {
      return noStoreJson({ error: 'No such upload' }, { status: 404 })
    }
    // The PUT may have been lost; the client retries the whole flow then.
    if (!(await s3ObjectExists(item.s3Key))) {
      return noStoreJson({ error: 'Upload not found. Try again.' }, { status: 409 })
    }
    // Already confirmed (e.g. the first PATCH response was lost): succeed
    // without re-uploading and return the original server timestamp.
    if (item.uploadComplete) {
      return noStoreJson({ ok: true, updatedAt: item.updatedAt })
    }
    const updatedAt = Date.now()
    await getVoiceDocClient().send(
      new UpdateCommand({
        TableName: VOICE_RECORDINGS_TABLE_NAME,
        Key: keys,
        UpdateExpression: 'SET uploadComplete = :complete, updatedAt = :now',
        ExpressionAttributeValues: { ':complete': true, ':now': updatedAt },
      })
    )
    return noStoreJson({ ok: true, updatedAt })
  } catch (error) {
    reportError(error, { location: 'PATCH /api/voice-recordings' })
    return noStoreJson({ error: 'Failed to confirm voice upload' }, { status: 500 })
  }
}

/** DELETE /api/voice-recordings — remove the recording (idempotent). */
export async function DELETE(request: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return noStore(auth.response)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return noStoreJson({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = DeleteSchema.safeParse(body)
  if (!parsed.success) {
    return noStoreJson({ error: 'Invalid delete request' }, { status: 400 })
  }
  const { text } = parsed.data

  try {
    const keys = voiceRecordKeys(auth.user.id, text)
    const existing = await getVoiceDocClient().send(
      new GetCommand({ TableName: VOICE_RECORDINGS_TABLE_NAME, Key: keys })
    )
    const item = existing.Item as VoiceRecordingItem | undefined
    // Deleting what is already gone is a no-op.
    if (item) {
      await deleteS3Object(item.s3Key)
      await getVoiceDocClient().send(new DeleteCommand({ TableName: VOICE_RECORDINGS_TABLE_NAME, Key: keys }))
    }
    return noStoreJson({ ok: true })
  } catch (error) {
    reportError(error, { location: 'DELETE /api/voice-recordings' })
    return noStoreJson({ error: 'Failed to delete voice recording' }, { status: 500 })
  }
}
