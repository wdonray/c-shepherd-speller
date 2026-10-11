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
import { SESClient, type SESClientConfig, SendEmailCommand, SendRawEmailCommand } from '@aws-sdk/client-ses'
import { randomBytes } from 'node:crypto'
import type { FeedbackType } from '@/models/Feedback'

/** Minimal surface of the SDK client, so tests can inject a mock. */
export type SesClient = Pick<SESClient, 'send'>

/** One image attachment, already validated by the API route. */
export interface FeedbackAttachment {
  filename: string
  contentType: string
  data: Buffer
}

export interface FeedbackEmailInput {
  type: FeedbackType
  subject: string
  details: string
  reporterEmail: string
  reporterName?: string | null
  appVersion: string
  attachment?: FeedbackAttachment
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
 * Strip carriage returns and line feeds from values that end up in email
 * headers (subject, Reply-To). A newline in a header value would inject
 * extra headers and turn the form into a spam relay; the SES API is
 * structured, but this keeps the delivered message clean either way.
 */
function sanitizeHeaderField(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim()
}

/**
 * Strip anything that could break a MIME header line out of a filename
 * (path segments, quotes, CR/LF). Filenames come from the user's machine,
 * so treat them as hostile.
 */
function sanitizeAttachmentFilename(filename: string): string {
  return filename
    .replace(/[\r\n"\\]/g, '')
    .replace(/^.*[/\\]/, '')
    .slice(0, 100)
}

/** RFC 2047-encode a header value so non-ASCII subjects survive raw sending. */
function encodeHeaderField(value: string): string {
  return `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`
}

/** Wrap base64 at 76 characters per line, as MIME requires. */
function foldBase64(base64: string): string {
  return base64.replace(/(.{1,76})/g, '$1\r\n')
}

interface RawMessageParts {
  from: string
  to: string
  replyTo: string
  subject: string
  text: string
  attachment: FeedbackAttachment
}

/** Build a multipart/mixed message: the text body plus one image attachment. */
function buildRawMessage(parts: RawMessageParts): Buffer {
  const boundary = `patternspell-feedback-${randomBytes(16).toString('hex')}`
  const filename = sanitizeAttachmentFilename(parts.attachment.filename)
  const lines = [
    `From: ${parts.from}`,
    `To: ${parts.to}`,
    `Reply-To: ${parts.replyTo}`,
    `Subject: ${encodeHeaderField(parts.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    foldBase64(Buffer.from(parts.text, 'utf8').toString('base64')),
    `--${boundary}`,
    `Content-Type: ${parts.attachment.contentType}; name="${filename}"`,
    'Content-Transfer-Encoding: base64',
    `Content-Disposition: attachment; filename="${filename}"`,
    '',
    foldBase64(parts.attachment.data.toString('base64')),
    `--${boundary}--`,
    '',
  ]
  return Buffer.from(lines.join('\r\n'), 'utf8')
}

/**
 * Email the feedback to Donray. Reply-To is the reporter's address so he can
 * answer directly. When an attachment is present the message goes out as a
 * raw MIME email (SendEmailCommand cannot carry attachments). Throws when
 * SES rejects the send; callers map that to a user-facing error.
 */
export async function sendFeedbackEmail(input: FeedbackEmailInput, client: SesClient = getClient()): Promise<void> {
  const to = process.env.FEEDBACK_TO_EMAIL || DEFAULT_TO_EMAIL
  const from = process.env.FEEDBACK_FROM_EMAIL || DEFAULT_FROM_EMAIL
  const reporterEmail = sanitizeHeaderField(input.reporterEmail)
  const reporter = input.reporterName ? `${sanitizeHeaderField(input.reporterName)} <${reporterEmail}>` : reporterEmail
  const subject = sanitizeHeaderField(`[PatternSpell feedback] ${typeLabel(input.type)}: ${input.subject}`)
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

  if (input.attachment) {
    const raw = buildRawMessage({
      from,
      to,
      replyTo: reporterEmail,
      subject,
      text: body,
      attachment: input.attachment,
    })
    await client.send(new SendRawEmailCommand({ RawMessage: { Data: raw } }))
    return
  }

  await client.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [to] },
      ReplyToAddresses: [reporterEmail],
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: { Text: { Data: body, Charset: 'UTF-8' } },
      },
    })
  )
}
