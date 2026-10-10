import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cognitoConfirmSignUp } from '@/lib/cognito-auth'
import { emailAuthErrorResponse, requireEmailAuth } from '@/lib/email-auth-api'

const verifySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  code: z.string().trim().min(1).max(20),
})

export async function POST(request: Request) {
  const notConfigured = requireEmailAuth()
  if (notConfigured) return notConfigured

  const parsed = verifySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'invalid-input' }, { status: 400 })
  }

  try {
    await cognitoConfirmSignUp(parsed.data.email, parsed.data.code)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return emailAuthErrorResponse(error, 'POST /api/auth/email/verify')
  }
}
