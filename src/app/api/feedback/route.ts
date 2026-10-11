import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireSession } from '@/lib/require-auth'
import { checkRateLimit, getClientIp, rateLimitedResponse, verifyTurnstileToken } from '@/lib/antibot'
import { FeedbackSchema } from '@/models/Feedback'
import { sendFeedbackEmail } from '@/lib/feedback-email'
import { reportError } from '@/lib/report-error'
import { version } from '../../../../package.json'

export const dynamic = 'force-dynamic'

/** Five feedback messages per user per hour. Generous for humans, useless for bots. */
const FEEDBACK_RATE_LIMIT = 5
const FEEDBACK_RATE_WINDOW_MS = 60 * 60 * 1000

/**
 * Twenty feedback messages per IP per hour. Backstops the per-user limit
 * against a bot farm rotating through many accounts from one address.
 */
const FEEDBACK_IP_RATE_LIMIT = 20
const FEEDBACK_IP_RATE_WINDOW_MS = 60 * 60 * 1000

const feedbackBodySchema = FeedbackSchema.extend({
  // Honeypot: real users never see or fill this field.
  website: z.string().max(200).optional(),
  turnstileToken: z.string().max(2048).optional(),
})

/** POST /api/feedback — email the caller's feedback to Donray via SES. */
export async function POST(request: NextRequest) {
  const auth = await requireSession()
  if (auth.response) return auth.response

  // Cheap abuse gates first, before SES is touched.
  const ip = getClientIp(request)
  if (!checkRateLimit(`feedback-ip:${ip}`, FEEDBACK_IP_RATE_LIMIT, FEEDBACK_IP_RATE_WINDOW_MS).allowed) {
    return rateLimitedResponse()
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Could not read your message. Please try again.' }, { status: 400 })
  }

  const parsed = feedbackBodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Your message needs a subject and details. Please check both.' }, { status: 400 })
  }
  if (parsed.data.website) {
    return NextResponse.json({ error: 'Your message needs a subject and details. Please check both.' }, { status: 400 })
  }

  const turnstile = await verifyTurnstileToken(parsed.data.turnstileToken, ip)
  if (!turnstile.ok) {
    if (turnstile.reason === 'unconfigured') {
      return NextResponse.json(
        { error: 'Verification is unavailable right now. Please try again later.' },
        { status: 503 }
      )
    }
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 403 })
  }

  const email = auth.session.user.email!
  if (!checkRateLimit(`feedback:${email.toLowerCase()}`, FEEDBACK_RATE_LIMIT, FEEDBACK_RATE_WINDOW_MS).allowed) {
    return rateLimitedResponse()
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
