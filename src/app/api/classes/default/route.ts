import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { getUserById } from '@/lib/db-utils'
import { getClassesByUser } from '@/lib/classes-db'
import { resolveDefaultClassId } from '@/models/Class'
import { reportError } from '@/lib/report-error'
import { noStore, noStoreJson } from '@/lib/no-store'

export const dynamic = 'force-dynamic'

/**
 * GET /api/classes/default — the teacher's effective default classroom.
 *
 * Resolves the explicit default, falling back to the single class when the
 * teacher has exactly one (issue #263). Returns null when there is no
 * default, meaning new lists start with "No class".
 */
export async function GET() {
  const auth = await requireUser()
  if (auth.response) return noStore(auth.response)

  try {
    const [user, classes] = await Promise.all([getUserById(auth.user.id), getClassesByUser(auth.user.id)])
    if (!user) {
      // The caller is authenticated, so a missing user record means the
      // read failed (getUserById swallows DB errors as undefined). Falling
      // through would silently drop an explicit default and let a new list
      // start with the wrong classroom.
      reportError(new Error('User record not found for authenticated user'), {
        location: 'GET /api/classes/default',
        extra: { status: 500 },
      })
      return noStoreJson({ error: 'Failed to resolve default class' }, { status: 500 })
    }
    return noStoreJson({ defaultClassId: resolveDefaultClassId(user, classes) })
  } catch (error) {
    reportError(error, { location: 'GET /api/classes/default', extra: { status: 500 } })
    console.error('Error resolving default class:', error)
    return noStoreJson({ error: 'Failed to resolve default class' }, { status: 500 })
  }
}
