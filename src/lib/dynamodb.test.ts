import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('dynamodb connection manager', () => {
  beforeEach(() => {
    vi.resetModules()
    // Fail fast when no credentials are configured (skips IMDS lookup).
    vi.stubEnv('AWS_EC2_METADATA_DISABLED', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('defaults the region to us-east-1', async () => {
    const { client } = await import('./dynamodb')
    expect(await client.config.region()).toBe('us-east-1')
  })

  it('honors AUTH_DYNAMODB_REGION', async () => {
    vi.stubEnv('AUTH_DYNAMODB_REGION', 'eu-west-1')
    const { client } = await import('./dynamodb')
    expect(await client.config.region()).toBe('eu-west-1')
  })

  it('has no static credentials when env vars are absent', async () => {
    const { client } = await import('./dynamodb')
    await expect(client.config.credentials()).rejects.toThrow()
  })

  it('sets credentials when both env vars are present', async () => {
    vi.stubEnv('AUTH_DYNAMODB_ID', 'test-key')
    vi.stubEnv('AUTH_DYNAMODB_SECRET', 'test-secret')
    const { client } = await import('./dynamodb')
    await expect(client.config.credentials()).resolves.toMatchObject({
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    })
  })

  it('has no static credentials when only one env var is present', async () => {
    vi.stubEnv('AUTH_DYNAMODB_ID', 'test-key')
    const { client } = await import('./dynamodb')
    await expect(client.config.credentials()).rejects.toThrow()
  })

  it('sets a custom endpoint for local development', async () => {
    vi.stubEnv('DYNAMODB_ENDPOINT', 'http://localhost:8000')
    const { client } = await import('./dynamodb')
    const endpointProvider = client.config.endpoint
    const endpoint = await endpointProvider!()
    const host = typeof endpoint === 'string' ? endpoint : endpoint.hostname
    expect(host).toContain('localhost')
  })

  it('omits the endpoint by default', async () => {
    const { client } = await import('./dynamodb')
    expect(client.config.endpoint).toBeUndefined()
  })

  it('exports the document client as default and named', async () => {
    const mod = await import('./dynamodb')
    expect(mod.default).toBe(mod.docClient)
    expect(typeof mod.docClient.send).toBe('function')
  })
})
