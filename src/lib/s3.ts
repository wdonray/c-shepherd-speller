/**
 * S3 + voice-metadata DynamoDB access for voice recording sync.
 *
 * Server-only. Uses the dedicated `patternspell-voice` IAM credentials
 * (VOICE_AWS_ACCESS_KEY_ID / VOICE_AWS_SECRET_ACCESS_KEY), separate from the
 * app's main DynamoDB credentials: voice audio is the most sensitive data
 * class in the system, so it gets its own keys and blast radius. The metadata
 * table is accessed with the same dedicated credentials, since the app's
 * main IAM user is not granted access to it.
 *
 * Environment is read at call time (not import time) so tests can stub it.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb'
import { VOICE_RECORDINGS_BUCKET_NAME } from '@/models/VoiceRecording'

/** Presigned URL lifetime: long enough for a slow upload, short enough to limit exposure. */
export const VOICE_URL_EXPIRY_SECONDS = 900

/** S3 key prefix under which one teacher's recordings live. */
export function voiceUserPrefix(dbUserId: string): string {
  return `voice-recordings/${dbUserId}/`
}

function voiceAwsConfig(): { region: string; credentials: { accessKeyId: string; secretAccessKey: string } } {
  const accessKeyId = process.env.VOICE_AWS_ACCESS_KEY_ID
  const secretAccessKey = process.env.VOICE_AWS_SECRET_ACCESS_KEY
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'Voice sync is not configured: VOICE_AWS_ACCESS_KEY_ID and VOICE_AWS_SECRET_ACCESS_KEY are required'
    )
  }
  return {
    region: process.env.VOICE_AWS_REGION || process.env.AUTH_DYNAMODB_REGION || 'us-east-1',
    credentials: { accessKeyId, secretAccessKey },
  }
}

let s3Client: S3Client | null = null
/** Test-only hook to reset the cached client between tests. */
export function __resetS3ClientForTests(): void {
  s3Client = null
}

export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client(voiceAwsConfig())
  }
  return s3Client
}

let voiceDocClient: DynamoDBDocumentClient | null = null
/** Test-only hook to reset the cached client between tests. */
export function __resetVoiceDocClientForTests(): void {
  voiceDocClient = null
}

/**
 * DynamoDB document client scoped to the voice IAM credentials. Honors
 * DYNAMODB_ENDPOINT so `npm run create-tables` + local dev work end to end
 * for the metadata table.
 */
export function getVoiceDocClient(): DynamoDBDocumentClient {
  if (!voiceDocClient) {
    const config = voiceAwsConfig()
    const client = new DynamoDBClient(
      process.env.DYNAMODB_ENDPOINT ? { ...config, endpoint: process.env.DYNAMODB_ENDPOINT } : config
    )
    voiceDocClient = DynamoDBDocumentClient.from(client, {
      marshallOptions: { removeUndefinedValues: true },
    })
  }
  return voiceDocClient
}

/**
 * Presigned PUT URL for uploading one recording, scoped to the exact object
 * key with pinned content type and length. The client PUTs audio bytes
 * directly to S3; they never pass through the Lambda.
 */
export async function getPresignedPutUrl(s3Key: string, contentType: string, contentLength: number): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: VOICE_RECORDINGS_BUCKET_NAME,
    Key: s3Key,
    ContentType: contentType,
    ContentLength: contentLength,
  })
  return getSignedUrl(getS3Client(), command, { expiresIn: VOICE_URL_EXPIRY_SECONDS })
}

/** Presigned GET URL for downloading one recording. */
export async function getPresignedGetUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: VOICE_RECORDINGS_BUCKET_NAME,
    Key: s3Key,
  })
  return getSignedUrl(getS3Client(), command, { expiresIn: VOICE_URL_EXPIRY_SECONDS })
}

function isNotFoundError(error: unknown): boolean {
  return error instanceof Error && (error.name === 'NotFound' || error.name === 'NoSuchKey')
}

/** True when the object exists. */
export async function s3ObjectExists(s3Key: string): Promise<boolean> {
  try {
    await getS3Client().send(new HeadObjectCommand({ Bucket: VOICE_RECORDINGS_BUCKET_NAME, Key: s3Key }))
    return true
  } catch (error) {
    if (isNotFoundError(error)) return false
    throw error
  }
}

/** Delete one object. A missing object is a no-op (idempotent). */
export async function deleteS3Object(s3Key: string): Promise<void> {
  try {
    await getS3Client().send(new DeleteObjectCommand({ Bucket: VOICE_RECORDINGS_BUCKET_NAME, Key: s3Key }))
  } catch (error) {
    if (isNotFoundError(error)) return
    throw error
  }
}

/** Every object key under one teacher's prefix (paginated). */
export async function listUserS3Keys(dbUserId: string): Promise<string[]> {
  const keys: string[] = []
  let continuationToken: string | undefined
  do {
    const result = await getS3Client().send(
      new ListObjectsV2Command({
        Bucket: VOICE_RECORDINGS_BUCKET_NAME,
        Prefix: voiceUserPrefix(dbUserId),
        ContinuationToken: continuationToken,
      })
    )
    for (const obj of result.Contents ?? []) {
      if (obj.Key) keys.push(obj.Key)
    }
    continuationToken = result.NextContinuationToken
  } while (continuationToken)
  return keys
}

/** Batch-delete keys (1000 per request). Missing keys are no-ops. */
export async function deleteS3Objects(s3Keys: string[]): Promise<void> {
  for (let i = 0; i < s3Keys.length; i += 1000) {
    const chunk = s3Keys.slice(i, i + 1000)
    await getS3Client().send(
      new DeleteObjectsCommand({
        Bucket: VOICE_RECORDINGS_BUCKET_NAME,
        Delete: { Objects: chunk.map((Key) => ({ Key })) },
      })
    )
  }
}
