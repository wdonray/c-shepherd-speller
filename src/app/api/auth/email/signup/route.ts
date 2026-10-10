import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cognitoSignUp } from '@/lib/cognito-auth'
import { getUserByEmail } from '@/lib/db-utils'
import { emailAuthErrorResponse, requireEmailAuth } from '@/lib/email-auth-api'
import { checkRateLimit, getClientIp, rateLimitedResponse, verifyTurnstileToken } from '@/lib/antibot'

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(256),
  // Honeypot: real users never see or fill this field.
  website: z.string().max(200).optional(),
  turnstileToken: z.string().max(2048).optional(),
})

export async function POST(request: Request) {
  const notConfigured = requireEmailAuth()
  if (notConfigured) return notConfigured

  // Cheap abuse gates first, before Cognito or DynamoDB are touched.
  const ip = getClientIp(request)
  if (!checkRateLimit(`signup:${ip}`, 10, 10 * 60 * 1000).allowed) {
    return rateLimitedResponse()
  }

  const parsed = signupSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'invalid-input' }, { status: 400 })
  }
  if (parsed.data.website) {
    return NextResponse.json({ ok: false, code: 'invalid-input' }, { status: 400 })
  }

  const turnstile = await verifyTurnstileToken(parsed.data.turnstileToken, ip)
  if (!turnstile.ok) {
    if (turnstile.reason === 'unconfigured') {
      return NextResponse.json({ ok: false, code: 'verification-unavailable' }, { status: 503 })
    }
    return NextResponse.json({ ok: false, code: 'verification-failed' }, { status: 403 })
  }

  try {
    // Someone who signed in with Google (or email) already has an app-table
    // record for this email. Tell them up front instead of creating a second
    // Cognito user that would "sort of merge" later.
    const existing = await getUserByEmail(parsed.data.email)
    if (existing) {
      return NextResponse.json({ ok: false, code: 'email-in-use' }, { status: 409 })
    }
    const { userConfirmed } = await cognitoSignUp(parsed.data.name, parsed.data.email, parsed.data.password)
    return NextResponse.json({ ok: true, userConfirmed })
  } catch (error) {
    return emailAuthErrorResponse(error, 'POST /api/auth/email/signup')
  }
}
