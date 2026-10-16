import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { getClassById, updateClass, deleteClass, getClassDeletionInfo } from '@/lib/classes-db'
import { getUserById, updateUserDefaultClassId } from '@/lib/db-utils'
import { UpdateClassSchema } from '@/models/Class'
import { reportError } from '@/lib/report-error'
import { noStore, noStoreJson } from '@/lib/no-store'

export const dynamic = 'force-dynamic'

/** GET /api/classes/[id] — get one of the caller's classes. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (auth.response) return noStore(auth.response)
  const { id } = await params

  try {
    const cls = await getClassById(auth.user.id, id)
    if (!cls) {
      return noStoreJson({ error: 'Class not found' }, { status: 404 })
    }
    return noStoreJson({ class: cls })
  } catch (error) {
    reportError(error, { location: 'GET /api/classes/[id]', extra: { status: 500 } })
    console.error('Error getting class:', error)
    return noStoreJson({ error: 'Failed to get class' }, { status: 500 })
  }
}

/** PUT /api/classes/[id] — update one of the caller's classes. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (auth.response) return auth.response
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    reportError(error, { location: 'PUT /api/classes/[id]', extra: { status: 400 } })
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateClassSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid class data', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const cls = await updateClass(auth.user.id, id, parsed.data)
    return NextResponse.json({ class: cls })
  } catch (error) {
    if (error instanceof Error && error.message === 'Class not found') {
      return NextResponse.json({ error: 'Class not found' }, { status: 404 })
    }
    reportError(error, { location: 'PUT /api/classes/[id]', extra: { status: 500 } })
    console.error('Error updating class:', error)
    return NextResponse.json({ error: 'Failed to update class' }, { status: 500 })
  }
}

/**
 * DELETE /api/classes/[id] — delete one of the caller's classes.
 *
 * Donray's decision (issue #309, 2026-10-15): deletion is blocked while the
 * classroom has saved rules, assigned lists, or students attached. Only an
 * empty, unassigned classroom can be deleted. Deleting the teacher's default
 * classroom also clears the default so it cannot dangle.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (auth.response) return auth.response
  const { id } = await params

  try {
    let deletion
    try {
      deletion = await getClassDeletionInfo(auth.user.id, id)
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Class not found')) {
        return NextResponse.json({ error: 'Class not found' }, { status: 404 })
      }
      throw error
    }
    if (!deletion.canDelete) {
      return NextResponse.json(
        {
          error: 'This classroom cannot be deleted while it has saved rules, assigned lists, or students.',
          blocked: true,
          deletion,
        },
        { status: 409 }
      )
    }
    // Clear the default first: a dangling defaultClassId would silently point
    // new lists at a classroom that no longer exists.
    const user = await getUserById(auth.user.id)
    const defaultCleared = user?.defaultClassId === id
    if (defaultCleared) {
      await updateUserDefaultClassId(auth.user.id, null)
    }
    await deleteClass(auth.user.id, id)
    return NextResponse.json({ ok: true, defaultCleared })
  } catch (error) {
    reportError(error, { location: 'DELETE /api/classes/[id]', extra: { status: 500 } })
    console.error('Error deleting class:', error)
    return NextResponse.json({ error: 'Failed to delete class' }, { status: 500 })
  }
}
