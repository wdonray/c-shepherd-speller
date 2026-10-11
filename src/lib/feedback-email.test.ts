import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@aws-sdk/client-ses')

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses'
import { sendFeedbackEmail, resetFeedbackSesClient } from './feedback-email'

const MockSESClient = vi.mocked(SESClient)
const MockSendEmailCommand = vi.mocked(SendEmailCommand)

const ENV_KEYS = [
  'FEEDBACK_TO_EMAIL',
  'FEEDBACK_FROM_EMAIL',
  'FEEDBACK_SES_REGION',
  'AUTH_DYNAMODB_REGION',
  'FEEDBACK_SES_ACCESS_KEY_ID',
  'FEEDBACK_SES_SECRET_ACCESS_KEY',
]

const baseInput = {
  type: 'issue' as const,
  subject: 'Print button is broken',
  details: 'Clicking print on the list page does nothing at all.',
  reporterEmail: 'teacher@example.com',
  appVersion: '0.33.5',
}

function lastCommandInput(): Record<string, unknown> {
  return MockSendEmailCommand.mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>
}

function lastClientConfig(): Record<string, unknown> {
  return MockSESClient.mock.calls.at(-1)?.[0] as unknown as Record<string, unknown>
}

describe('sendFeedbackEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetFeedbackSesClient()
    for (const key of ENV_KEYS) delete process.env[key]
  })

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key]
  })

  it('sends to Donray from the PatternSpell address with the expected content', async () => {
    await sendFeedbackEmail(baseInput)

    const input = lastCommandInput()
    expect(input.Source).toBe('PatternSpell <no-reply@patternspell.org>')
    expect(input.Destination).toEqual({ ToAddresses: ['donrayxwilliams@gmail.com'] })
    expect(input.ReplyToAddresses).toEqual(['teacher@example.com'])
    const message = input.Message as { Subject: { Data: string }; Body: { Text: { Data: string } } }
    expect(message.Subject.Data).toBe('[PatternSpell feedback] Issue report: Print button is broken')
    expect(message.Body.Text.Data).toContain('From: teacher@example.com')
    expect(message.Body.Text.Data).toContain('App version: 0.33.5')
    expect(message.Body.Text.Data).toContain('Clicking print on the list page does nothing at all.')
    expect(lastClientConfig().region).toBe('us-east-1')
  })

  it('labels feature requests and includes the reporter name', async () => {
    await sendFeedbackEmail({ ...baseInput, type: 'feature', reporterName: 'Chaley Williams' })

    const input = lastCommandInput()
    const message = input.Message as { Subject: { Data: string }; Body: { Text: { Data: string } } }
    expect(message.Subject.Data).toBe('[PatternSpell feedback] Feature request: Print button is broken')
    expect(message.Body.Text.Data).toContain('From: Chaley Williams <teacher@example.com>')
  })

  it('honors FEEDBACK_TO_EMAIL and FEEDBACK_FROM_EMAIL overrides', async () => {
    process.env.FEEDBACK_TO_EMAIL = 'other@example.com'
    process.env.FEEDBACK_FROM_EMAIL = 'App <app@example.com>'

    await sendFeedbackEmail(baseInput)

    const input = lastCommandInput()
    expect(input.Destination).toEqual({ ToAddresses: ['other@example.com'] })
    expect(input.Source).toBe('App <app@example.com>')
  })

  it('honors FEEDBACK_SES_REGION', async () => {
    process.env.FEEDBACK_SES_REGION = 'us-west-2'

    await sendFeedbackEmail(baseInput)

    expect(lastClientConfig().region).toBe('us-west-2')
  })

  it('falls back to AUTH_DYNAMODB_REGION when FEEDBACK_SES_REGION is unset', async () => {
    process.env.AUTH_DYNAMODB_REGION = 'eu-west-1'

    await sendFeedbackEmail(baseInput)

    expect(lastClientConfig().region).toBe('eu-west-1')
  })

  it('passes explicit credentials when both are set', async () => {
    process.env.FEEDBACK_SES_ACCESS_KEY_ID = 'AKID'
    process.env.FEEDBACK_SES_SECRET_ACCESS_KEY = 'SECRET'

    await sendFeedbackEmail(baseInput)

    expect(lastClientConfig().credentials).toEqual({ accessKeyId: 'AKID', secretAccessKey: 'SECRET' })
  })

  it('omits credentials when only one of the pair is set', async () => {
    process.env.FEEDBACK_SES_ACCESS_KEY_ID = 'AKID'

    await sendFeedbackEmail(baseInput)

    expect(lastClientConfig().credentials).toBeUndefined()
  })

  it('reuses the cached client across calls', async () => {
    await sendFeedbackEmail(baseInput)
    await sendFeedbackEmail(baseInput)

    expect(MockSESClient).toHaveBeenCalledTimes(1)
  })

  it('propagates SES send failures', async () => {
    const failingClient = { send: vi.fn().mockRejectedValue(new Error('MessageRejected')) }

    await expect(sendFeedbackEmail(baseInput, failingClient)).rejects.toThrow('MessageRejected')
    expect(failingClient.send).toHaveBeenCalledTimes(1)
  })

  it('uses an injected client instead of creating one', async () => {
    const injected = { send: vi.fn().mockResolvedValue({}) }

    await sendFeedbackEmail(baseInput, injected)

    expect(injected.send).toHaveBeenCalledTimes(1)
    expect(MockSESClient).not.toHaveBeenCalled()
  })
})
