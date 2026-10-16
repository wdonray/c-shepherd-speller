import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

const { s3Send, S3Client, docSend, DynamoDBClient, DynamoDBDocumentClient, getSignedUrl, FakeCommand } = vi.hoisted(
  () => {
    const s3Send = vi.fn()
    class S3Client {
      send = s3Send
      config: unknown
      constructor(config: unknown) {
        this.config = config
      }
    }
    class FakeCommand {
      input: unknown
      constructor(input: unknown) {
        this.input = input
      }
    }
    const docSend = vi.fn()
    const DynamoDBClient = vi.fn(function (this: { config: unknown }, config: unknown) {
      this.config = config
    })
    const DynamoDBDocumentClient = { from: vi.fn(() => ({ send: docSend })) }
    const getSignedUrl = vi.fn(async (_client: unknown, command: { input: { Key: string } }) => {
      return `https://signed.example/${command.input.Key}`
    })
    return { s3Send, S3Client, docSend, DynamoDBClient, DynamoDBDocumentClient, getSignedUrl, FakeCommand }
  }
)

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client,
  PutObjectCommand: FakeCommand,
  GetObjectCommand: FakeCommand,
  HeadObjectCommand: FakeCommand,
  DeleteObjectCommand: FakeCommand,
  DeleteObjectsCommand: FakeCommand,
  ListObjectsV2Command: FakeCommand,
}))
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl }))
vi.mock('@aws-sdk/client-dynamodb', () => ({ DynamoDBClient }))
vi.mock('@aws-sdk/lib-dynamodb', () => ({ DynamoDBDocumentClient }))

import {
  VOICE_URL_EXPIRY_SECONDS,
  voiceUserPrefix,
  getS3Client,
  getVoiceDocClient,
  getPresignedPutUrl,
  getPresignedGetUrl,
  s3ObjectExists,
  deleteS3Object,
  listUserS3Keys,
  deleteS3Objects,
  __resetS3ClientForTests,
  __resetVoiceDocClientForTests,
} from './s3'

function namedError(name: string): Error {
  const error = new Error(name)
  error.name = name
  return error
}

describe('s3 voice access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetS3ClientForTests()
    __resetVoiceDocClientForTests()
    vi.stubEnv('VOICE_AWS_ACCESS_KEY_ID', 'test-key')
    vi.stubEnv('VOICE_AWS_SECRET_ACCESS_KEY', 'test-secret')
    vi.stubEnv('VOICE_AWS_REGION', '')
    vi.stubEnv('AUTH_DYNAMODB_REGION', '')
    delete process.env.DYNAMODB_ENDPOINT
  })

  it('exposes the URL expiry and user prefix', () => {
    expect(VOICE_URL_EXPIRY_SECONDS).toBe(900)
    expect(voiceUserPrefix('u1')).toBe('voice-recordings/u1/')
  })

  it('creates the S3 client with the voice credentials and default region', () => {
    const client = getS3Client() as unknown as { config: { region: string } }
    expect(client.config.region).toBe('us-east-1')
    expect(getS3Client()).toBe(getS3Client())
  })

  it('prefers VOICE_AWS_REGION, then AUTH_DYNAMODB_REGION', () => {
    vi.stubEnv('AUTH_DYNAMODB_REGION', 'eu-west-1')
    expect((getS3Client() as unknown as { config: { region: string } }).config.region).toBe('eu-west-1')
    __resetS3ClientForTests()
    vi.stubEnv('VOICE_AWS_REGION', 'ap-south-1')
    expect((getS3Client() as unknown as { config: { region: string } }).config.region).toBe('ap-south-1')
  })

  it('throws a clear error when the voice credentials are missing', () => {
    vi.stubEnv('VOICE_AWS_ACCESS_KEY_ID', '')
    expect(() => getS3Client()).toThrow('VOICE_AWS_ACCESS_KEY_ID')
    vi.stubEnv('VOICE_AWS_ACCESS_KEY_ID', 'test-key')
    vi.stubEnv('VOICE_AWS_SECRET_ACCESS_KEY', '')
    __resetS3ClientForTests()
    expect(() => getS3Client()).toThrow('VOICE_AWS_SECRET_ACCESS_KEY')
  })

  it('builds the voice DynamoDB client with the voice credentials', () => {
    getVoiceDocClient()
    expect(DynamoDBClient).toHaveBeenCalled()
    expect(DynamoDBDocumentClient.from).toHaveBeenCalled()
    expect(getVoiceDocClient()).toBe(getVoiceDocClient())
  })

  it('points the voice DynamoDB client at DYNAMODB_ENDPOINT for local dev', () => {
    process.env.DYNAMODB_ENDPOINT = 'http://localhost:8000'
    getVoiceDocClient()
    const config = (DynamoDBClient as unknown as Mock).mock.calls[0][0] as { endpoint?: string }
    expect(config.endpoint).toBe('http://localhost:8000')
  })

  it('signs PUT urls scoped to the key with pinned content type and length', async () => {
    const url = await getPresignedPutUrl('voice-recordings/u1/abc.webm', 'audio/webm', 1234)
    expect(url).toContain('abc.webm')
    expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.anything(), { expiresIn: 900 })
    const command = (getSignedUrl as unknown as { mock: { calls: [unknown, { input: Record<string, unknown> }][] } })
      .mock.calls[0][1]
    expect(command.input.ContentType).toBe('audio/webm')
    expect(command.input.ContentLength).toBe(1234)
  })

  it('signs GET urls scoped to the key', async () => {
    const url = await getPresignedGetUrl('voice-recordings/u1/abc.webm')
    expect(url).toContain('abc.webm')
  })

  it('reports object existence', async () => {
    s3Send.mockResolvedValue({})
    expect(await s3ObjectExists('k')).toBe(true)
  })

  it('reports false for missing objects', async () => {
    s3Send.mockRejectedValueOnce(namedError('NotFound'))
    expect(await s3ObjectExists('k')).toBe(false)
    s3Send.mockRejectedValueOnce(namedError('NoSuchKey'))
    expect(await s3ObjectExists('k')).toBe(false)
  })

  it('rethows unexpected HeadObject failures', async () => {
    s3Send.mockRejectedValueOnce(new Error('boom'))
    await expect(s3ObjectExists('k')).rejects.toThrow('boom')
  })

  it('deletes objects and ignores missing ones', async () => {
    s3Send.mockResolvedValue({})
    await deleteS3Object('k')
    expect(s3Send).toHaveBeenCalledTimes(1)
    s3Send.mockRejectedValueOnce(namedError('NoSuchKey'))
    await deleteS3Object('k')
  })

  it('rethows unexpected delete failures', async () => {
    s3Send.mockRejectedValueOnce(new Error('boom'))
    await expect(deleteS3Object('k')).rejects.toThrow('boom')
  })

  it('lists a user keys across pages', async () => {
    s3Send
      .mockResolvedValueOnce({
        Contents: [{ Key: 'voice-recordings/u1/a.webm' }, {}, { Key: 'voice-recordings/u1/b.webm' }],
        NextContinuationToken: 'tok',
      })
      .mockResolvedValueOnce({ Contents: [{ Key: 'voice-recordings/u1/c.webm' }] })
    const keys = await listUserS3Keys('u1')
    expect(keys).toEqual(['voice-recordings/u1/a.webm', 'voice-recordings/u1/b.webm', 'voice-recordings/u1/c.webm'])
    const command = (s3Send as unknown as { mock: { calls: { input: Record<string, unknown> }[][] } }).mock.calls[0][0]
      .input
    expect(command.Prefix).toBe('voice-recordings/u1/')
  })

  it('skips listing entries without a key and empty pages', async () => {
    s3Send.mockResolvedValue({ Contents: [{ Key: 'a' }, {}] })
    expect(await listUserS3Keys('u1')).toEqual(['a'])
    s3Send.mockResolvedValue({})
    expect(await listUserS3Keys('u1')).toEqual([])
  })

  it('batch-deletes in chunks of 1000', async () => {
    s3Send.mockResolvedValue({})
    await deleteS3Objects([])
    expect(s3Send).not.toHaveBeenCalled()
    await deleteS3Objects(['a', 'b'])
    expect(s3Send).toHaveBeenCalledTimes(1)
    const keys = Array.from({ length: 1001 }, (_, i) => `k${i}`)
    await deleteS3Objects(keys)
    expect(s3Send).toHaveBeenCalledTimes(3)
  })
})
