import { NextRequest, NextResponse } from 'next/server'
import { getUserSpellingData, updateUserSpellingData } from '@/lib/db-utils'

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const spellingData = await getUserSpellingData(id)

    if (!spellingData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ spellingData })
  } catch (error: unknown) {
    console.error('Error getting user spelling data:', error)
    return NextResponse.json({ error: 'Failed to get user spelling data' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { words, sounds, spelling } = body

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // At least one field must be provided
    if (words === undefined && sounds === undefined && spelling === undefined) {
      return NextResponse.json(
        {
          error: 'At least one field (words, sounds, or spelling) must be provided',
        },
        { status: 400 }
      )
    }

    const updatedUser = await updateUserSpellingData(id, {
      words,
      sounds,
      spelling,
    })

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      message: 'User spelling data updated successfully',
      user: updatedUser,
    })
  } catch (error: unknown) {
    console.error('Error updating user spelling data:', error)
    return NextResponse.json({ error: 'Failed to update user spelling data' }, { status: 500 })
  }
}
