/**
 * Emails Donray on every new PatternSpell signup, through Amazon SES
 * (us-east-1).
 *
 * Server only: never import this from a client component. It is called from
 * the NextAuth `createUser` event in `src/lib/auth.ts`.
 *
 * Mirrors the SES setup in `feedback-email.ts`: same region default, same
 * optional explicit credentials, same header sanitization. Kept as a
 * separate module with its own SIGNUP_* env vars so the signup notification
 * is configured independently of the feedback form.
 *
 * SES is the cheapest reliable option here: the repo already depends on
 * @aws-sdk/client-ses and sends the feedback form through it, so there is
 * no new vendor or account, and a handful of signup emails a day costs $0.
 *
 * A failed send throws; the caller (the createUser event) catches, reports,
 * and never lets a failed notification break signup.
 */
import { SESClient, type SESClientConfig, SendEmailCommand } from '@aws-sdk/client-ses'

/** Minimal surface of the SDK client, so tests can inject a mock. */
export type SesClient = Pick<SESClient, 'send'>

export interface SignupEmailInput {
  name?: string | null
  email?: string | null
  signedUpAt: Date
}

const DEFAULT_TO_EMAIL = 'donrayxwilliams@gmail.com'
const DEFAULT_FROM_EMAIL = 'PatternSpell <no-reply@patternspell.org>'

function sesRegion(): string {
  return process.env.SIGNUP_SES_REGION || process.env.AUTH_DYNAMODB_REGION || 'us-east-1'
}

function createClient(): SESClient {
  const config: SESClientConfig = { region: sesRegion() }
  const accessKeyId = process.env.SIGNUP_SES_ACCESS_KEY_ID
  const secretAccessKey = process.env.SIGNUP_SES_SECRET_ACCESS_KEY
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
export function resetSignupSesClient(): void {
  cachedClient = null
}

/**
 * Strip carriage returns and line feeds from values that end up in email
 * headers. A newline in a header value would inject extra headers and turn
 * the notification into a spam relay; the SES API is structured, but this
 * keeps the delivered message clean either way.
 */
function sanitizeHeaderField(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

/** e.g. "Oct 20, 2026, 12:50 AM" in Donray's timezone, next to the UTC stamp. */
function formatEastern(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

/**
 * Email Donray about the new signup. Throws when SES rejects the send; the
 * createUser event handler catches and reports so a failed notification
 * never breaks signup.
 */
export async function sendSignupEmail(input: SignupEmailInput, client: SesClient = getClient()): Promise<void> {
  const to = process.env.SIGNUP_TO_EMAIL || DEFAULT_TO_EMAIL
  const from = process.env.SIGNUP_FROM_EMAIL || DEFAULT_FROM_EMAIL
  const name = input.name ? sanitizeHeaderField(input.name) : ''
  const email = input.email ? sanitizeHeaderField(input.email) : ''
  const identity = [name, email].filter(Boolean).join(' ')
  const subject = sanitizeHeaderField(`[PatternSpell] New signup: ${identity}`)
  const body = [
    'Someone just signed up for PatternSpell.',
    '',
    `Name: ${name || '(not provided)'}`,
    `Email: ${email || '(not provided)'}`,
    `Signed up: ${input.signedUpAt.toISOString()} (${formatEastern(input.signedUpAt)} Eastern)`,
  ].join('\n')

  await client.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Text: { Data: body, Charset: 'UTF-8' } },
      },
    })
  )
}
