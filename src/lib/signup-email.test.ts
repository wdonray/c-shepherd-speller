import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@aws-sdk/client-ses')

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { sendSignupEmail, resetSignupSesClient } from './signup-email'

const MockSESClient = vi.mocked(SESClient)
const MockSendEmailCommand = vi.mocked(SendEmailCommand)

const ENV_KEYS = [
  'SIGNUP_TO_EMAIL',
  'SIGNUP_FROM_EMAIL',
  'SIGNUP_SES_REGION',
  'AUTH_DYNAMODB_REGION',
  'SIGNUP_SES_ACCESS_KEY_ID',
  'SIGNUP_SES_SECRET_ACCESS_KEY',
]

const SIGNED_UP_AT = new Date('2026-10-20T04:50:00.000Z')

const baseInput = {
  name: 'Chaley Williams',
  email: 'teacher@example.com',
  signedUpAt: SIGNED_UP_AT,
}

function lastCommandInput(): Record<string, unknown> {
  return MockSendEmailCommand.mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>
}

function lastClientConfig(): Record<string, unknown> {
  return MockSESClient.mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>
}

describe('sendSignupEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetSignupSesClient()
    for (const key of ENV_KEYS) delete process.env[key]
  })

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key]
  })

  it('emails Donray from the PatternSpell address with the signup details', async () => {
    await sendSignupEmail(baseInput)

    const input = lastCommandInput()
    expect(input.Source).toBe('PatternSpell <no-reply@patternspell.org>')
    expect(input.Destination).toEqual({ ToAddresses: ['donrayxwilliams@gmail.com'] })
    const message = input.Message as { Subject: { Data: string }; Body: { Text: { Data: string } } }
    expect(message.Subject.Data).toBe('[PatternSpell] New signup: Chaley Williams teacher@example.com')
    expect(message.Body.Text.Data).toContain('Someone just signed up for PatternSpell.')
    expect(message.Body.Text.Data).toContain('Name: Chaley Williams')
    expect(message.Body.Text.Data).toContain('Email: teacher@example.com')
    expect(message.Body.Text.Data).toContain('2026-10-20T04:50:00.000Z')
    expect(message.Body.Text.Data).toContain('Eastern')
    expect(lastClientConfig().region).toBe('us-east-1')
  })

  it('marks missing name and email as not provided', async () => {
    await sendSignupEmail({ name: null, email: null, signedUpAt: SIGNED_UP_AT })

    const input = lastCommandInput()
    const message = input.Message as { Subject: { Data: string }; Body: { Text: { Data: string } } }
    expect(message.Subject.Data).toBe('[PatternSpell] New signup:')
    expect(message.Body.Text.Data).toContain('Name: (not provided)')
    expect(message.Body.Text.Data).toContain('Email: (not provided)')
  })

  it('still identifies the signup when only the email is present', async () => {
    await sendSignupEmail({ name: undefined, email: 'teacher@example.com', signedUpAt: SIGNED_UP_AT })

    const input = lastCommandInput()
    const message = input.Message as { Subject: { Data: string }; Body: { Text: { Data: string } } }
    expect(message.Subject.Data).toBe('[PatternSpell] New signup: teacher@example.com')
    expect(message.Body.Text.Data).toContain('Name: (not provided)')
  })

  it('strips newlines from header-bound fields to block header injection', async () => {
    await sendSignupEmail({
      name: 'Chaley\r\nBcc: attacker@evil.example',
      email: 'teacher@example.com\r\n',
      signedUpAt: SIGNED_UP_AT,
    })

    const input = lastCommandInput()
    const message = input.Message as { Subject: { Data: string }; Body: { Text: { Data: string } } }
    expect(message.Subject.Data).toBe(
      '[PatternSpell] New signup: Chaley Bcc: attacker@evil.example teacher@example.com'
    )
    expect(message.Subject.Data).not.toContain('\r\n')
    expect(message.Body.Text.Data).toContain('Name: Chaley Bcc: attacker@evil.example')
  })

  it('honors SIGNUP_TO_EMAIL and SIGNUP_FROM_EMAIL overrides', async () => {
    process.env.SIGNUP_TO_EMAIL = 'other@example.com'
    process.env.SIGNUP_FROM_EMAIL = 'App <app@example.com>'

    await sendSignupEmail(baseInput)

    const input = lastCommandInput()
    expect(input.Destination).toEqual({ ToAddresses: ['other@example.com'] })
    expect(input.Source).toBe('App <app@example.com>')
  })

  it('honors SIGNUP_SES_REGION', async () => {
    process.env.SIGNUP_SES_REGION = 'us-west-2'

    await sendSignupEmail(baseInput)

    expect(lastClientConfig().region).toBe('us-west-2')
  })

  it('falls back to AUTH_DYNAMODB_REGION when SIGNUP_SES_REGION is unset', async () => {
    process.env.AUTH_DYNAMODB_REGION = 'eu-west-1'

    await sendSignupEmail(baseInput)

    expect(lastClientConfig().region).toBe('eu-west-1')
  })

  it('passes explicit credentials when both are set', async () => {
    process.env.SIGNUP_SES_ACCESS_KEY_ID = 'AKID'
    process.env.SIGNUP_SES_SECRET_ACCESS_KEY = 'SECRET'

    await sendSignupEmail(baseInput)

    expect(lastClientConfig().credentials).toEqual({ accessKeyId: 'AKID', secretAccessKey: 'SECRET' })
  })

  it('omits credentials when only one of the pair is set', async () => {
    process.env.SIGNUP_SES_ACCESS_KEY_ID = 'AKID'

    await sendSignupEmail(baseInput)

    expect(lastClientConfig().credentials).toBeUndefined()
  })

  it('reuses the cached client across calls', async () => {
    await sendSignupEmail(baseInput)
    await sendSignupEmail(baseInput)

    expect(MockSESClient).toHaveBeenCalledTimes(1)
  })

  it('propagates SES send failures', async () => {
    const failingClient = { send: vi.fn().mockRejectedValue(new Error('MessageRejected')) }

    await expect(sendSignupEmail(baseInput, failingClient)).rejects.toThrow('MessageRejected')
    expect(failingClient.send).toHaveBeenCalledTimes(1)
  })

  it('uses an injected client instead of creating one', async () => {
    const injected = { send: vi.fn().mockResolvedValue({}) }

    await sendSignupEmail(baseInput, injected)

    expect(injected.send).toHaveBeenCalledTimes(1)
    expect(MockSESClient).not.toHaveBeenCalled()
  })
})
