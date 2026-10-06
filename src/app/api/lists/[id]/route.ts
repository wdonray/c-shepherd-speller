import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { getListById, updateList, deleteList } from '@/lib/lists-db'
import { UpdateWordListSchema } from '@/models/WordList'

/** GET /api/lists/[id] — get one of the caller's lists. */
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  try {
    const list = await getListById(auth.user.id, params.id)
    if (!list) {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }
    return NextResponse.json({ list })
  } catch (error) {
    console.error('Error getting word list:', error)
    return NextResponse.json({ error: 'Failed to get word list' }, { status: 500 })
  }
}

/** PUT /api/lists/[id] — update one of the caller's lists. */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = UpdateWordListSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid list data', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const list = await updateList(auth.user.id, params.id, parsed.data)
    return NextResponse.json({ list })
  } catch (error) {
    if (error instanceof Error && error.message === 'List not found') {
      return NextResponse.json({ error: 'List not found' }, { status: 404 })
    }
    console.error('Error updating word list:', error)
    return NextResponse.json({ error: 'Failed to update word list' }, { status: 500 })
  }
}

/** DELETE /api/lists/[id] — delete one of the caller's lists. */
export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  try {
    await deleteList(auth.user.id, params.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting word list:', error)
    return NextResponse.json({ error: 'Failed to delete word list' }, { status: 500 })
  }
}
