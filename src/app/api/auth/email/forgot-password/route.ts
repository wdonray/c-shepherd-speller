import { NextResponse } from 'next/server'
import { z } from 'zod'
import { CognitoAuthError, cognitoForgotPassword } from '@/lib/cognito-auth'
import { emailAuthErrorResponse, requireEmailAuth } from '@/lib/email-auth-api'
import { checkRateLimit, getClientIp, rateLimitedResponse } from '@/lib/antibot'

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
})

export async function POST(request: Request) {
  const notConfigured = requireEmailAuth()
  if (notConfigured) return notConfigured

  // Each request burns an SES email; keep bots from using us as a mail cannon.
  if (!checkRateLimit(`forgot:${getClientIp(request)}`, 10, 10 * 60 * 1000).allowed) {
    return rateLimitedResponse()
  }

  const parsed = forgotPasswordSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'invalid-input' }, { status: 400 })
  }

  try {
    await cognitoForgotPassword(parsed.data.email)
    return NextResponse.json({ ok: true })
  } catch (error) {
    // Never reveal whether the email is registered: an unknown address
    // looks exactly like a successful send.
    if (error instanceof CognitoAuthError && error.code === 'invalid-credentials') {
      return NextResponse.json({ ok: true })
    }
    return emailAuthErrorResponse(error, 'POST /api/auth/email/forgot-password')
  }
}
