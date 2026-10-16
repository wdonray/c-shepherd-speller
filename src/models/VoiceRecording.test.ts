import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  VOICE_RECORDINGS_TABLE_NAME,
  VOICE_RECORDINGS_BUCKET_NAME,
  VOICE_STORAGE_QUOTA_BYTES,
  VOICE_MAX_RECORDING_BYTES,
  VOICE_MIME_ALLOWLIST,
  normalizeVoiceText,
  voiceTextHash,
  voiceS3Key,
  voiceRecordKeys,
} from './VoiceRecording'

describe('VoiceRecording model', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('defaults the table and bucket names', () => {
    expect(VOICE_RECORDINGS_TABLE_NAME).toBe('patternspell-voice-recordings')
    expect(VOICE_RECORDINGS_BUCKET_NAME).toBe('patternspell-voice-recordings')
  })

  it('reads the table and bucket names from the environment', async () => {
    vi.stubEnv('VOICE_RECORDINGS_TABLE', 'custom-voice-table')
    vi.stubEnv('VOICE_RECORDINGS_BUCKET', 'custom-voice-bucket')
    const mod = await import('./VoiceRecording')
    expect(mod.VOICE_RECORDINGS_TABLE_NAME).toBe('custom-voice-table')
    expect(mod.VOICE_RECORDINGS_BUCKET_NAME).toBe('custom-voice-bucket')
  })

  it('sets a 100 MB quota and a 2 MB per-recording cap', () => {
    expect(VOICE_STORAGE_QUOTA_BYTES).toBe(100 * 1024 * 1024)
    expect(VOICE_MAX_RECORDING_BYTES).toBe(2_000_000)
  })

  it('allowlists the recorder-produced MIME types', () => {
    expect([...VOICE_MIME_ALLOWLIST]).toEqual(['audio/webm', 'audio/mp4', 'audio/ogg'])
  })

  it('normalizes text by trimming and lowercasing', () => {
    expect(normalizeVoiceText('  Cake ')).toBe('cake')
    expect(normalizeVoiceText('AE')).toBe('ae')
  })

  it('hashes the normalized text deterministically', () => {
    expect(voiceTextHash('cake')).toBe(voiceTextHash('  CAKE '))
    expect(voiceTextHash('cake')).toHaveLength(64)
    expect(voiceTextHash('cake')).not.toBe(voiceTextHash('bake'))
  })

  it('derives S3 keys under the user prefix with the right extension', () => {
    const key = voiceS3Key('user-1', 'cake', 'audio/webm')
    expect(key).toBe(`voice-recordings/user-1/${voiceTextHash('cake')}.webm`)
    expect(voiceS3Key('user-1', 'cake', 'audio/mp4')).toMatch(/\.m4a$/)
    expect(voiceS3Key('user-1', 'cake', 'audio/ogg')).toMatch(/\.ogg$/)
    expect(voiceS3Key('user-1', 'cake', 'audio/unknown')).toMatch(/\.webm$/)
  })

  it('derives DynamoDB keys with the USER#/VOICE# convention', () => {
    expect(voiceRecordKeys('user-1', 'cake')).toEqual({
      PK: 'USER#user-1',
      SK: `VOICE#${voiceTextHash('cake')}`,
    })
  })
})
