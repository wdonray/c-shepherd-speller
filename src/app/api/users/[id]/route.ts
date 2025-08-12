import { NextRequest, NextResponse } from 'next/server'
import { updateUser, getUserById } from '@/lib/db-utils'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, gradeLevel, subject, schoolName, classroomSize, preferredName } = body

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const updateData: any = {}
    if (name !== undefined) updateData.name = name
    if (gradeLevel !== undefined) updateData.gradeLevel = gradeLevel
    if (subject !== undefined) updateData.subject = subject
    if (schoolName !== undefined) updateData.schoolName = schoolName
    if (classroomSize !== undefined) updateData.classroomSize = classroomSize
    if (preferredName !== undefined) updateData.preferredName = preferredName

    const updatedUser = await updateUser(id, updateData)
    return NextResponse.json({ message: 'User updated successfully', user: updatedUser }, { status: 200 })
  } catch (error: unknown) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const user = await getUserById(id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error: unknown) {
    console.error('Error getting user:', error)
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 })
  }
}
