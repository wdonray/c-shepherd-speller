import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cognitoResendConfirmationCode } from '@/lib/cognito-auth'
import { emailAuthErrorResponse, requireEmailAuth } from '@/lib/email-auth-api'

const resendSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
})

export async function POST(request: Request) {
  const notConfigured = requireEmailAuth()
  if (notConfigured) return notConfigured

  const parsed = resendSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'invalid-input' }, { status: 400 })
  }

  try {
    await cognitoResendConfirmationCode(parsed.data.email)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return emailAuthErrorResponse(error, 'POST /api/auth/email/verify/resend')
  }
}
