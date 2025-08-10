import { NextRequest, NextResponse } from 'next/server'
import { updateUserLastActive } from '@/lib/db-utils'

export async function PUT(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

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
    console.error('Error updating user last active:', error)
    return NextResponse.json({ error: 'Failed to update user last active' }, { status: 500 })
  }
}
