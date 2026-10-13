import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { createClass, getClassesByUser } from '@/lib/classes-db'
import { CreateClassSchema } from '@/models/Class'
import { reportError } from '@/lib/report-error'
import { noStore, noStoreJson } from '@/lib/no-store'

export const dynamic = 'force-dynamic'

/** GET /api/classes — list all of the caller's classes. */
export async function GET() {
  const auth = await requireUser()
  if (auth.response) return noStore(auth.response)

  try {
    const classes = await getClassesByUser(auth.user.id)
    return noStoreJson({ classes })
  } catch (error) {
    reportError(error, { location: 'GET /api/classes', extra: { status: 500 } })
    console.error('Error listing classes:', error)
    return noStoreJson({ error: 'Failed to list classes' }, { status: 500 })
  }
}

/** POST /api/classes — create a new class. */
export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    reportError(error, { location: 'POST /api/classes', extra: { status: 400 } })
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateClassSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid class data', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const cls = await createClass(auth.user.id, parsed.data)
    return NextResponse.json({ class: cls }, { status: 201 })
  } catch (error) {
    reportError(error, { location: 'POST /api/classes', extra: { status: 500 } })
    console.error('Error creating class:', error)
    return NextResponse.json({ error: 'Failed to create class' }, { status: 500 })
  }
}
