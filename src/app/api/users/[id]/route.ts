import { NextRequest, NextResponse } from 'next/server'
import { updateUser, updateUserDefaultClassId, getUserById } from '@/lib/db-utils'
import { getClassById } from '@/lib/classes-db'
import { UpdateUserBody } from '@/types/User'
import { requireOwnership } from '@/lib/require-auth'
import { reportError } from '@/lib/report-error'
import { noStore, noStoreJson } from '@/lib/no-store'
import { isYouTubeVideoId } from '@/lib/youtube'
import type { BlockedVideo } from '@/models/User'

export const dynamic = 'force-dynamic'

const IMAGE_DATA_URL_PATTERN = /^data:image\/(jpeg|png|webp);base64,/
const IMAGE_MAX_LENGTH = 140_000
const CLASS_ID_MAX_LENGTH = 100
const BLOCKED_VIDEO_TITLE_MAX_LENGTH = 200
const BLOCKED_VIDEO_CHANNEL_MAX_LENGTH = 100
/** Upper bound on the hidden-video list; a teacher hides a handful, not thousands. */
const BLOCKED_VIDEOS_MAX_COUNT = 200

/**
 * Validate and sanitize the teacher's hidden-video list (issue #443).
 * Entries are title/channel snapshots taken at block time; the list is
 * deduplicated by video ID (first wins) so repeats are harmless.
 */
function parseBlockedVideos(input: unknown): { ok: true; value: BlockedVideo[] } | { ok: false } {
  if (!Array.isArray(input) || input.length > BLOCKED_VIDEOS_MAX_COUNT) return { ok: false }
  const seen = new Set<string>()
  const value: BlockedVideo[] = []
  for (const entry of input) {
    if (typeof entry !== 'object' || entry === null) return { ok: false }
    const { videoId, title, channel } = entry as Record<string, unknown>
    if (typeof videoId !== 'string' || !isYouTubeVideoId(videoId)) return { ok: false }
    if (typeof title !== 'string' || !title.trim() || title.length > BLOCKED_VIDEO_TITLE_MAX_LENGTH) {
      return { ok: false }
    }
    if (channel !== undefined && (typeof channel !== 'string' || channel.length > BLOCKED_VIDEO_CHANNEL_MAX_LENGTH)) {
      return { ok: false }
    }
    if (seen.has(videoId)) continue
    seen.add(videoId)
    const cleanChannel = typeof channel === 'string' ? channel.trim() : ''
    value.push({ videoId, title: title.trim(), ...(cleanChannel ? { channel: cleanChannel } : {}) })
  }
  return { ok: true, value }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const auth = await requireOwnership(id)
    if (auth.response) return auth.response

    const body = await request.json()
    const {
      name,
      gradeLevel,
      subject,
      schoolName,
      classroomSize,
      preferredName,
      image,
      defaultClassId,
      blockedVideos,
    } = body

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
    if (defaultClassId !== undefined) {
      if (defaultClassId !== null) {
        if (
          typeof defaultClassId !== 'string' ||
          defaultClassId.length < 1 ||
          defaultClassId.length > CLASS_ID_MAX_LENGTH
        ) {
          return NextResponse.json({ error: 'Invalid default class' }, { status: 400 })
        }
        // The default must be one of the teacher's own classes.
        const cls = await getClassById(id, defaultClassId)
        if (!cls) {
          return NextResponse.json({ error: 'Class not found' }, { status: 404 })
        }
        updateData.defaultClassId = defaultClassId
      } else {
        updateData.defaultClassId = null
      }
    }
    if (blockedVideos !== undefined) {
      const parsed = parseBlockedVideos(blockedVideos)
      if (!parsed.ok) {
        return NextResponse.json({ error: 'Invalid hidden videos' }, { status: 400 })
      }
      updateData.blockedVideos = parsed.value
    }

    // A default-class-only update uses a field-scoped write so it cannot
    // clobber a concurrent profile autosave (issue #263). The updated user
    // comes back from the write itself (ALL_NEW): no eventually consistent
    // re-read.
    const onlyDefaultClassId = Object.keys(updateData).length === 1 && 'defaultClassId' in updateData
    let updatedUser
    if (onlyDefaultClassId) {
      updatedUser = await updateUserDefaultClassId(id, updateData.defaultClassId ?? null)
    } else {
      updatedUser = await updateUser(id, updateData)
    }
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
    if (auth.response) return noStore(auth.response)

    if (!id) {
      return noStoreJson({ error: 'User ID is required' }, { status: 400 })
    }

    const user = await getUserById(id)

    if (!user) {
      return noStoreJson({ error: 'User not found' }, { status: 404 })
    }

    return noStoreJson({ user })
  } catch (error: unknown) {
    reportError(error, { location: 'GET /api/users/[id]', extra: { status: 500 } })
    console.error('Error getting user:', error)
    return noStoreJson({ error: 'Failed to get user' }, { status: 500 })
  }
}
