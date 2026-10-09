import { NextRequest, NextResponse } from 'next/server'
import { updateUser, getUserById } from '@/lib/db-utils'
import { UpdateUserBody } from '@/types/User'
import { requireOwnership } from '@/lib/require-auth'
import { reportError } from '@/lib/report-error'

const IMAGE_DATA_URL_PATTERN = /^data:image\/(jpeg|png|webp);base64,/
const IMAGE_MAX_LENGTH = 140_000

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const auth = await requireOwnership(id)
    if (auth.response) return auth.response

    const body = await request.json()
    const { name, gradeLevel, subject, schoolName, classroomSize, preferredName, image } = body

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const updateData: UpdateUserBody = {}
    if (name !== undefined) updateData.name = name
    if (gradeLevel !== undefined) updateData.gradeLevel = gradeLevel
    if (subject !== undefined) updateData.subject = subject
    if (schoolName !== undefined) updateData.schoolName = schoolName
    if (classroomSize !== undefined) updateData.classroomSize = classroomSize
    if (preferredName !== undefined) updateData.preferredName = preferredName
    if (image !== undefined) {
      if (
        typeof image !== 'string' ||
        image.length > IMAGE_MAX_LENGTH ||
        (image !== '' && !IMAGE_DATA_URL_PATTERN.test(image))
      ) {
        return NextResponse.json({ error: 'Invalid profile image' }, { status: 400 })
      }
      updateData.image = image
    }

    const updatedUser = await updateUser(id, updateData)
    return NextResponse.json({ message: 'User updated successfully', user: updatedUser }, { status: 200 })
  } catch (error: unknown) {
    reportError(error, { location: 'PUT /api/users/[id]', extra: { status: 500 } })
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const auth = await requireOwnership(id)
    if (auth.response) return auth.response

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    const user = await getUserById(id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error: unknown) {
    reportError(error, { location: 'GET /api/users/[id]', extra: { status: 500 } })
    console.error('Error getting user:', error)
    return NextResponse.json({ error: 'Failed to get user' }, { status: 500 })
  }
}
