import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cognitoResetPassword } from '@/lib/cognito-auth'
import { emailAuthErrorResponse, requireEmailAuth } from '@/lib/email-auth-api'
import { checkRateLimit, getClientIp, rateLimitedResponse } from '@/lib/antibot'

const resetPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  code: z.string().trim().min(1).max(20),
  newPassword: z.string().min(8).max(256),
})

export async function POST(request: Request) {
  const notConfigured = requireEmailAuth()
  if (notConfigured) return notConfigured

  // 6-digit codes are guessable; slow down brute force per IP.
  if (!checkRateLimit(`reset:${getClientIp(request)}`, 20, 10 * 60 * 1000).allowed) {
    return rateLimitedResponse()
  }

  const parsed = resetPasswordSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'invalid-input' }, { status: 400 })
  }

  try {
    await cognitoResetPassword(parsed.data.email, parsed.data.code, parsed.data.newPassword)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return emailAuthErrorResponse(error, 'POST /api/auth/email/reset-password')
  }
}
