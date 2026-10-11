import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/require-auth'
import { checkRateLimit, rateLimitedResponse } from '@/lib/antibot'
import { FeedbackSchema } from '@/models/Feedback'
import { sendFeedbackEmail } from '@/lib/feedback-email'
import { reportError } from '@/lib/report-error'
import { version } from '../../../../package.json'

export const dynamic = 'force-dynamic'

/** Five feedback messages per user per hour. Generous for humans, useless for bots. */
const FEEDBACK_RATE_LIMIT = 5
const FEEDBACK_RATE_WINDOW_MS = 60 * 60 * 1000

/** POST /api/feedback — email the caller's feedback to Donray via SES. */
export async function POST(request: NextRequest) {
  const auth = await requireSession()
  if (auth.response) return auth.response

  const email = auth.session.user.email!
  if (!checkRateLimit(`feedback:${email.toLowerCase()}`, FEEDBACK_RATE_LIMIT, FEEDBACK_RATE_WINDOW_MS).allowed) {
    return rateLimitedResponse()
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Could not read your message. Please try again.' }, { status: 400 })
  }

  const parsed = FeedbackSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Your message needs a subject and details. Please check both.' }, { status: 400 })
  }

  try {
    await sendFeedbackEmail({
      type: parsed.data.type,
      subject: parsed.data.subject,
      details: parsed.data.details,
      reporterEmail: email,
      reporterName: auth.session.user.name,
      appVersion: version,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportError(error, { location: 'POST /api/feedback' })
    return NextResponse.json({ error: 'Could not send your message. Please try again.' }, { status: 500 })
  }
}
