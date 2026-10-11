/**
 * Sends "Report an issue / Request a feature" form submissions to Donray
 * through Amazon SES (us-east-1).
 *
 * Server only: never import this from a client component. The feedback page
 * posts to /api/feedback, which calls sendFeedbackEmail.
 *
 * Sandbox vs production: while the AWS account is in the SES sandbox, every
 * recipient must be a verified SES identity, so the mail goes to
 * FEEDBACK_TO_EMAIL (Donray's own address, verified as an identity). After
 * production access is granted, the same code keeps working with no change.
 */
import { SESClient, type SESClientConfig, SendEmailCommand } from '@aws-sdk/client-ses'
import type { FeedbackType } from '@/models/Feedback'

/** Minimal surface of the SDK client, so tests can inject a mock. */
export type SesClient = Pick<SESClient, 'send'>

export interface FeedbackEmailInput {
  type: FeedbackType
  subject: string
  details: string
  reporterEmail: string
  reporterName?: string | null
  appVersion: string
}

const DEFAULT_TO_EMAIL = 'donrayxwilliams@gmail.com'
const DEFAULT_FROM_EMAIL = 'PatternSpell <no-reply@patternspell.org>'

function sesRegion(): string {
  return process.env.FEEDBACK_SES_REGION || process.env.AUTH_DYNAMODB_REGION || 'us-east-1'
}

function createClient(): SESClient {
  const config: SESClientConfig = { region: sesRegion() }
  const accessKeyId = process.env.FEEDBACK_SES_ACCESS_KEY_ID
  const secretAccessKey = process.env.FEEDBACK_SES_SECRET_ACCESS_KEY
  if (accessKeyId && secretAccessKey) {
    config.credentials = { accessKeyId, secretAccessKey }
  }
  return new SESClient(config)
}

let cachedClient: SESClient | null = null

function getClient(): SESClient {
  if (!cachedClient) {
    cachedClient = createClient()
  }
  return cachedClient
}

/** Test-only reset for the cached client. */
export function resetFeedbackSesClient(): void {
  cachedClient = null
}

function typeLabel(type: FeedbackType): string {
  return type === 'issue' ? 'Issue report' : 'Feature request'
}

/**
 * Email the feedback to Donray. Reply-To is the reporter's address so he can
 * answer directly. Throws when SES rejects the send; callers map that to a
 * user-facing error.
 */
export async function sendFeedbackEmail(input: FeedbackEmailInput, client: SesClient = getClient()): Promise<void> {
  const to = process.env.FEEDBACK_TO_EMAIL || DEFAULT_TO_EMAIL
  const from = process.env.FEEDBACK_FROM_EMAIL || DEFAULT_FROM_EMAIL
  const reporter = input.reporterName ? `${input.reporterName} <${input.reporterEmail}>` : input.reporterEmail
  const subject = `[PatternSpell feedback] ${typeLabel(input.type)}: ${input.subject}`
  const body = [
    'A PatternSpell user sent feedback from the app.',
    '',
    `Type: ${typeLabel(input.type)}`,
    `From: ${reporter}`,
    `App version: ${input.appVersion}`,
    '',
    'Details:',
    input.details,
  ].join('\n')

  await client.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [to] },
      ReplyToAddresses: [input.reporterEmail],
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Text: { Data: body, Charset: 'UTF-8' } },
      },
    })
  )
}
