import { NextRequest, NextResponse } from 'next/server'
import { createUser, getUserByEmail } from '@/lib/db-utils'
import { requireSession, isSelfEmail } from '@/lib/require-auth'
import { reportError } from '@/lib/report-error'

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSession()
    if (auth.response) return auth.response

    const body = await request.json()
    const { email, name, words = [], sounds = [], spelling = [] } = body

    if (!email || !name) {
      return NextResponse.json({ error: 'Email and name are required' }, { status: 400 })
    }

    // Callers may only create a record for their own email
    if (!isSelfEmail(auth.session, email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await createUser({
      email,
      name,
      words,
      sounds,
      spelling,
    })

    return NextResponse.json({ message: 'User created successfully', user }, { status: 201 })
  } catch (error: unknown) {
    reportError(error, { location: 'POST /api/users', extra: { status: 500 } })
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    const auth = await requireSession()
    if (auth.response) return auth.response

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 })
    }

    // Callers may only look up their own record
    if (!isSelfEmail(auth.session, email)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await getUserByEmail(email)

    if (!user) {
      return NextResponse.json({ user: {} })
    }

    return NextResponse.json({ user })
  } catch (error: unknown) {
    reportError(error, { location: 'GET /api/users', extra: { status: 500 } })
    console.error('Error getting user:', error)
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 })
  }
}
