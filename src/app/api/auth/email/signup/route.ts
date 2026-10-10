import { NextResponse } from 'next/server'
import { z } from 'zod'
import { cognitoSignUp } from '@/lib/cognito-auth'
import { getUserByEmail } from '@/lib/db-utils'
import { emailAuthErrorResponse, requireEmailAuth } from '@/lib/email-auth-api'

const signupSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(8).max(256),
})

export async function POST(request: Request) {
  const notConfigured = requireEmailAuth()
  if (notConfigured) return notConfigured

  const parsed = signupSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: 'invalid-input' }, { status: 400 })
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
