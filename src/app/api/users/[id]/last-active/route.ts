import { NextRequest, NextResponse } from 'next/server'
import { updateUserLastActive } from '@/lib/db-utils'
import { requireOwnership } from '@/lib/require-auth'
import { reportError } from '@/lib/report-error'

export async function PUT(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const auth = await requireOwnership(id)
    if (auth.response) return auth.response

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const updatedUser = await updateUserLastActive(id)

    if (!updatedUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({
      message: 'User last active timestamp updated successfully',
      user: updatedUser,
    })
  } catch (error: unknown) {
    reportError(error, { location: 'PUT /api/users/[id]/last-active', extra: { status: 500 } })
    console.error('Error updating user last active:', error)
    return NextResponse.json({ error: 'Failed to update user last active' }, { status: 500 })
  }
}
