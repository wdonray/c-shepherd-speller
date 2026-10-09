import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { createList, getListsByUser } from '@/lib/lists-db'
import { CreateWordListSchema } from '@/models/WordList'
import { reportError } from '@/lib/report-error'

/** GET /api/lists — list all of the caller's word lists. */
export async function GET() {
  const auth = await requireUser()
  if (auth.response) return auth.response

  try {
    const lists = await getListsByUser(auth.user.id)
    return NextResponse.json({ lists })
  } catch (error) {
    reportError(error, { location: 'GET /api/lists', extra: { status: 500 } })
    console.error('Error listing word lists:', error)
    return NextResponse.json({ error: 'Failed to list word lists' }, { status: 500 })
  }
}

/** POST /api/lists — create a new word list. */
export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    reportError(error, { location: 'POST /api/lists', extra: { status: 400 } })
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateWordListSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid list data', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const list = await createList(auth.user.id, parsed.data)
    return NextResponse.json({ list }, { status: 201 })
  } catch (error) {
    reportError(error, { location: 'POST /api/lists', extra: { status: 500 } })
    console.error('Error creating word list:', error)
    return NextResponse.json({ error: 'Failed to create word list' }, { status: 500 })
  }
}
