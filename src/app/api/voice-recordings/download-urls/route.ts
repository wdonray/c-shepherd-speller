/**
 * Batch presigned download URLs for voice recording sync.
 *
 * POST /api/voice-recordings/download-urls
 * Body: { texts: string[] } (1-100). Returns { urls: { [text]: presignedGetUrl } }.
 * Texts with no completed upload are simply absent from the response.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { BatchGetCommand } from '@aws-sdk/lib-dynamodb'
import { requireUser } from '@/lib/require-auth'
import { noStore, noStoreJson } from '@/lib/no-store'
import { reportError } from '@/lib/report-error'
import { VOICE_RECORDINGS_TABLE_NAME, voiceRecordKeys, type VoiceRecordingItem } from '@/models/VoiceRecording'
import { getVoiceDocClient, getPresignedGetUrl } from '@/lib/s3'

export const dynamic = 'force-dynamic'

const DownloadUrlsSchema = z.object({
  texts: z.array(z.string().trim().min(1).max(100)).min(1).max(100),
})

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return noStore(auth.response)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return noStoreJson({ error: 'Invalid JSON' }, { status: 400 })
  }
  const parsed = DownloadUrlsSchema.safeParse(body)
  if (!parsed.success) {
    return noStoreJson({ error: 'Invalid download request' }, { status: 400 })
  }

  try {
    const keys = parsed.data.texts.map((text) => voiceRecordKeys(auth.user.id, text))
    const result = await getVoiceDocClient().send(
      new BatchGetCommand({
        RequestItems: { [VOICE_RECORDINGS_TABLE_NAME]: { Keys: keys } },
      })
    )
    const items = (result.Responses?.[VOICE_RECORDINGS_TABLE_NAME] ?? []) as VoiceRecordingItem[]
    const urls: Record<string, string> = {}
    for (const item of items) {
      if (!item.uploadComplete) continue
      urls[item.text] = await getPresignedGetUrl(item.s3Key)
    }
    return noStoreJson({ urls })
  } catch (error) {
    reportError(error, { location: 'POST /api/voice-recordings/download-urls' })
    return noStoreJson({ error: 'Failed to prepare voice downloads' }, { status: 500 })
  }
}
