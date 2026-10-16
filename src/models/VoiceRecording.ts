/**
 * Voice recording metadata model (DynamoDB).
 *
 * Each item describes one teacher-recorded voice memo stored in S3. The audio
 * itself lives in the `patternspell-voice-recordings` bucket; this table is
 * what makes quota enforcement ("how many bytes does this teacher have") and
 * conflict resolution ("which version is newest") answerable in one query.
 *
 * Key scheme: PK `USER#<dbUserId>`, SK `VOICE#<sha256(trimmedLowerText)>`.
 * The S3 key mirrors the same derivation:
 * `voice-recordings/{dbUserId}/{sha256}.{ext}`.
 *
 * NOTE: this module uses node:crypto and is server-only. The browser client
 * never derives keys; it sends the word text and the API routes derive them.
 */

import { createHash } from 'node:crypto'

export const VOICE_RECORDINGS_TABLE_NAME = process.env.VOICE_RECORDINGS_TABLE || 'patternspell-voice-recordings'

export const VOICE_RECORDINGS_BUCKET_NAME = process.env.VOICE_RECORDINGS_BUCKET || 'patternspell-voice-recordings'

/**
 * Max audio stored per teacher. Holds ~2,000 typical word recordings
 * (20-60 KB each) or ~300 worst-case 60-second recordings. Shared with the
 * terms page copy; change both together.
 */
export const VOICE_STORAGE_QUOTA_BYTES = 100 * 1024 * 1024

/**
 * Max single recording the API accepts. Far above the ~350 KB realistic max
 * for a 60-second Opus recording; blocks abuse, not teachers.
 */
export const VOICE_MAX_RECORDING_BYTES = 2_000_000

/** MIME types the recorder produces and the API accepts. */
export const VOICE_MIME_ALLOWLIST = ['audio/webm', 'audio/mp4', 'audio/ogg'] as const

const MIME_EXTENSIONS: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
}

/** Normalize word text for key derivation: trimmed and lowercased. */
export function normalizeVoiceText(text: string): string {
  return text.trim().toLowerCase()
}

/**
 * SHA-256 hex of the normalized text. Keeps S3 keys and DynamoDB sort keys
 * free of slashes, unicode, and case collisions; the human-readable word
 * lives in the `text` attribute, not the key.
 */
export function voiceTextHash(text: string): string {
  return createHash('sha256').update(normalizeVoiceText(text), 'utf8').digest('hex')
}

/** S3 object key for a teacher's recording of a word. */
export function voiceS3Key(dbUserId: string, text: string, mimeType: string): string {
  const ext = MIME_EXTENSIONS[mimeType] ?? 'webm'
  return `voice-recordings/${dbUserId}/${voiceTextHash(text)}.${ext}`
}

/** DynamoDB keys for a teacher's recording of a word. */
export function voiceRecordKeys(dbUserId: string, text: string): { PK: string; SK: string } {
  return { PK: `USER#${dbUserId}`, SK: `VOICE#${voiceTextHash(text)}` }
}

export interface VoiceRecordingItem {
  PK: string
  SK: string
  /** Human-readable word: trimmed, original case. */
  text: string
  s3Key: string
  mimeType: string
  byteSize: number
  /**
   * Client-set at save time. Display metadata only; never the conflict
   * clock (device clocks cannot be trusted).
   */
  recordedAt: number
  /**
   * Server-set at upload-confirm time. The conflict-resolution clock:
   * last-write-wins compares `updatedAt`.
   */
  updatedAt: number
  /** False until the client confirms the S3 PUT landed (PATCH). */
  uploadComplete: boolean
}
