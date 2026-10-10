import { NextRequest, NextResponse } from 'next/server'
import { requireSession } from '@/lib/require-auth'
import { getUserByEmail } from '@/lib/db-utils'
import { getListsByUser } from '@/lib/lists-db'
import { checkRateLimit, getClientIp, rateLimitedResponse } from '@/lib/antibot'
import { noStoreJson } from '@/lib/no-store'
import { reportError } from '@/lib/report-error'
import { CognitoAuthError, cognitoDeleteUser, cognitoVerifyPassword } from '@/lib/cognito-auth'
import {
  COGNITO_PROVIDERS,
  deleteAppUser,
  deleteAuthRecords,
  deleteUserLists,
  getAccountProviders,
} from '@/lib/account-deletion'

export const dynamic = 'force-dynamic'

/**
 * Describe the caller's account for the delete-confirmation UI: their email,
 * which providers they signed in with, how many word lists they own, and
 * whether deleting requires their password (Cognito email/password accounts).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireSession()
    if (auth.response) return auth.response

    const email = auth.session.user.email!
    const providers = await getAccountProviders(auth.session.user.id)
    const dbUser = await getUserByEmail(email)
    const lists = dbUser ? await getListsByUser(dbUser.id) : []

    return noStoreJson({
      email,
      providers,
      listCount: lists.length,
      requiresPassword: providers.some((provider) => COGNITO_PROVIDERS.includes(provider)),
    })
  } catch (error) {
    reportError(error, { location: 'GET /api/account' })
    return noStoreJson({ error: 'Failed to load account details' }, { status: 500 })
  }
}

/**
 * Permanently delete the caller's account and all of their data.
 *
 * The caller must type their own email address to confirm. Cognito
 * email/password accounts must also re-enter their password: it verifies
 * their identity and yields the access token needed to delete the Cognito
 * user itself (the self-service DeleteUser API needs no IAM permissions).
 *
 * Order: verify identity first (no mutations), then app data (lists, user
 * record), then next-auth adapter records, then the Cognito user last. Every
 * step is idempotent, so a failed deletion can be retried while signed in.
 */
export async function DELETE(request: NextRequest) {
  try {
    const rateLimit = checkRateLimit(`account-delete:${getClientIp(request)}`, 5, 10 * 60 * 1000)
    if (!rateLimit.allowed) return rateLimitedResponse()

    const auth = await requireSession()
    if (auth.response) return auth.response

    const sessionEmail = auth.session.user.email!.toLowerCase()
    const sub = auth.session.user.id
    const body = (await request.json()) as { email?: unknown; password?: unknown }
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!email || email !== sessionEmail) {
      return NextResponse.json({ error: 'Email does not match your account', code: 'email-mismatch' }, { status: 400 })
    }

    const providers = await getAccountProviders(sub)
    const requiresPassword = providers.some((provider) => COGNITO_PROVIDERS.includes(provider))

    let accessToken: string | undefined
    if (requiresPassword) {
      const password = typeof body.password === 'string' ? body.password : ''
      if (!password) {
        return NextResponse.json({ error: 'Password is required', code: 'password-required' }, { status: 400 })
      }
      try {
        accessToken = await cognitoVerifyPassword(email, password)
      } catch (error) {
        if (error instanceof CognitoAuthError && error.code === 'invalid-credentials') {
          return NextResponse.json({ error: error.message, code: 'invalid-credentials' }, { status: 401 })
        }
        throw error
      }
    }

    const dbUser = await getUserByEmail(email)
    if (dbUser) {
      await deleteUserLists(dbUser.id)
      await deleteAppUser(dbUser.id)
    }
    await deleteAuthRecords(sub)
    if (accessToken) {
      await cognitoDeleteUser(accessToken)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    reportError(error, { location: 'DELETE /api/account' })
    return NextResponse.json({ error: 'Account deletion failed. Try again.', code: 'server-error' }, { status: 500 })
  }
}
