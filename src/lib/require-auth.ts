import { getServerSession } from 'next-auth/next'
import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { authOptions } from './auth'
import { getUserByEmail } from './db-utils'

type AuthResult = { session: Session; response: null } | { session: null; response: NextResponse }

function unauthorized(): AuthResult {
  return { session: null, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

function forbidden(): AuthResult {
  return { session: null, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
}

/** Require a valid signed-in session (401 otherwise). */
export async function requireSession(): Promise<AuthResult> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return unauthorized()
  }
  return { session, response: null }
}

/**
 * Case-insensitive email comparison for ownership checks.
 */
export function isSelfEmail(session: Session, email: string): boolean {
  return email.toLowerCase() === session.user.email!.toLowerCase()
}

/**
 * Require a session AND that the [id] route param is the caller's own app
 * user record (403 otherwise). Ownership is resolved via the caller's email,
 * which is how the frontend addresses users (GET /api/users?email=).
 */
export async function requireOwnership(id: string): Promise<AuthResult> {
  const auth = await requireSession()
  if (auth.response) return auth
  const user = await getUserByEmail(auth.session.user.email!)
  if (!user || user.id !== id) {
    return forbidden()
  }
  return auth
}
