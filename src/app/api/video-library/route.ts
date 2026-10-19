import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/require-auth'
import { getUserVideoLibrary, addVideoToUserLibrary } from '@/lib/db-utils'
import { PatternVideoSchema } from '@/models/WordList'
import { reportError } from '@/lib/report-error'
import { noStore, noStoreJson } from '@/lib/no-store'

export const dynamic = 'force-dynamic'

/**
 * GET /api/video-library — the caller's personal song-video collection
 * (issue #458): every video she added by pasting a link, in the order
 * added. The curated bank is static data and is never stored here.
 */
export async function GET() {
  const auth = await requireUser()
  if (auth.response) return noStore(auth.response)

  try {
    const videos = await getUserVideoLibrary(auth.user.id)
    return noStoreJson({ videos })
  } catch (error) {
    reportError(error, { location: 'GET /api/video-library', extra: { status: 500 } })
    console.error('Error getting video library:', error)
    return noStoreJson({ error: 'Failed to get video library' }, { status: 500 })
  }
}

/** POST /api/video-library — append one video to the caller's collection. */
export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if (auth.response) return auth.response

  let body: unknown
  try {
    body = await request.json()
  } catch (error) {
    reportError(error, { location: 'POST /api/video-library', extra: { status: 400 } })
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatternVideoSchema.safeParse((body as { video?: unknown } | null)?.video)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid video data', details: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const videos = await addVideoToUserLibrary(auth.user.id, parsed.data)
    return NextResponse.json({ videos }, { status: 201 })
  } catch (error) {
    reportError(error, { location: 'POST /api/video-library', extra: { status: 500 } })
    console.error('Error adding video to library:', error)
    return NextResponse.json({ error: 'Failed to add video to library' }, { status: 500 })
  }
}
