import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@aws-sdk/client-ses')

import { SESClient, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses'
import { sendFeedbackEmail, resetFeedbackSesClient } from './feedback-email'

const MockSESClient = vi.mocked(SESClient)
const MockSendEmailCommand = vi.mocked(SendEmailCommand)
const MockSendRawEmailCommand = vi.mocked(SendRawEmailCommand)

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

    expect(MockSendRawEmailCommand).not.toHaveBeenCalled()
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

  it('strips newlines from header-bound fields to block header injection', async () => {
    await sendFeedbackEmail({
      ...baseInput,
      subject: 'Broken\r\nBcc: attacker@evil.example',
      reporterEmail: 'teacher@example.com\r\n',
      reporterName: 'Chaley\r\nWilliams',
    })

    const input = lastCommandInput()
    expect(input.ReplyToAddresses).toEqual(['teacher@example.com'])
    const message = input.Message as { Subject: { Data: string }; Body: { Text: { Data: string } } }
    expect(message.Subject.Data).toBe('[PatternSpell feedback] Issue report: Broken Bcc: attacker@evil.example')
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

  it('sends attachments as a raw MIME email, not a plain email', async () => {
    await sendFeedbackEmail({
      ...baseInput,
      attachment: { filename: 'shot.png', contentType: 'image/png', data: Buffer.from('fake-png-bytes') },
    })

    expect(MockSendEmailCommand).not.toHaveBeenCalled()
    const input = MockSendRawEmailCommand.mock.calls.at(-1)?.[0] as unknown as {
      RawMessage: { Data: Buffer }
    }
    const raw = input.RawMessage.Data.toString('utf8')
    expect(raw).toContain('From: PatternSpell <no-reply@patternspell.org>')
    expect(raw).toContain('To: donrayxwilliams@gmail.com')
    expect(raw).toContain('Reply-To: teacher@example.com')
    expect(raw).toContain('MIME-Version: 1.0')
    expect(raw).toContain('Content-Type: multipart/mixed; boundary="patternspell-feedback-')
    expect(raw).toContain('Content-Type: text/plain; charset=UTF-8')
    expect(raw).toContain('Content-Type: image/png; name="shot.png"')
    expect(raw).toContain('Content-Disposition: attachment; filename="shot.png"')
    // The base64 bodies are folded at 76 chars per line; unfold to assert.
    const unfolded = raw.replace(/\r\n/g, '')
    expect(unfolded).toContain(Buffer.from('fake-png-bytes').toString('base64'))
    const expectedBody = [
      'A PatternSpell user sent feedback from the app.',
      '',
      'Type: Issue report',
      'From: teacher@example.com',
      'App version: 0.33.5',
      '',
      'Details:',
      'Clicking print on the list page does nothing at all.',
    ].join('\n')
    expect(unfolded).toContain(Buffer.from(expectedBody, 'utf8').toString('base64'))
  })

  it('RFC 2047-encodes the subject on raw sends', async () => {
    await sendFeedbackEmail({
      ...baseInput,
      subject: 'Café printer bréaks',
      attachment: { filename: 'shot.png', contentType: 'image/png', data: Buffer.from('x') },
    })

    const input = MockSendRawEmailCommand.mock.calls.at(-1)?.[0] as unknown as {
      RawMessage: { Data: Buffer }
    }
    const raw = input.RawMessage.Data.toString('utf8')
    const expected = `Subject: =?UTF-8?B?${Buffer.from('[PatternSpell feedback] Issue report: Café printer bréaks', 'utf8').toString('base64')}?=`
    expect(raw).toContain(expected)
  })

  it('sanitizes hostile attachment filenames', async () => {
    await sendFeedbackEmail({
      ...baseInput,
      attachment: { filename: 'a/b\\c"\r\n.png', contentType: 'image/png', data: Buffer.from('x') },
    })

    const input = MockSendRawEmailCommand.mock.calls.at(-1)?.[0] as unknown as {
      RawMessage: { Data: Buffer }
    }
    const raw = input.RawMessage.Data.toString('utf8')
    expect(raw).toContain('filename="bc.png"')
    expect(raw).not.toContain('\r\n.png')
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
