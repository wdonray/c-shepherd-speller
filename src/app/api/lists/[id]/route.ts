import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { getListById, updateList, deleteList } from '@/lib/lists-db'
import { UpdateWordListSchema } from '@/models/WordList'
import { reportError } from '@/lib/report-error'
import { noStore, noStoreJson } from '@/lib/no-store'

export const dynamic = 'force-dynamic'

/** GET /api/lists/[id] — get one of the caller's lists. */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (auth.response) return noStore(auth.response)
  const { id } = await params

  try {
    const list = await getListById(auth.user.id, id)
    if (!list) {
      return noStoreJson({ error: 'List not found' }, { status: 404 })
    }
    return noStoreJson({ list })
  } catch (error) {
    reportError(error, { location: 'GET /api/lists/[id]', extra: { status: 500 } })
    console.error('Error getting word list:', error)
    return noStoreJson({ error: 'Failed to get word list' }, { status: 500 })
  }
}

/** PUT /api/lists/[id] — update one of the caller's lists. */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (auth.response) return auth.response
  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    reportError(error, { location: 'PUT /api/lists/[id]', extra: { status: 400 } })
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateWordListSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid list data', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const list = await updateList(auth.user.id, id, parsed.data)
    return NextResponse.json({ list })
  } catch (error) {
    if (error instanceof Error && error.message === 'List not found') {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }
    reportError(error, { location: 'PUT /api/lists/[id]', extra: { status: 500 } })
    console.error('Error updating word list:', error)
    return NextResponse.json({ error: 'Failed to update word list' }, { status: 500 })
  }
}

/** DELETE /api/lists/[id] — delete one of the caller's lists. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (auth.response) return auth.response
  const { id } = await params

  try {
    await deleteList(auth.user.id, id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportError(error, { location: 'DELETE /api/lists/[id]', extra: { status: 500 } })
    console.error('Error deleting word list:', error)
    return NextResponse.json({ error: 'Failed to delete word list' }, { status: 500 })
  }
}
