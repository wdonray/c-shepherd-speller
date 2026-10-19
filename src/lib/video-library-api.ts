/**
 * Frontend API client for the teacher's personal song-video collection.
 * Calls the session-scoped /api/video-library endpoints; throws on
 * non-OK responses.
 */

import type { PatternVideo } from '@/models/WordList'
import { HttpError } from '@/lib/error-toast'

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new HttpError(body.error || `Request failed with status ${res.status}`, res.status)
  }
  return res.json() as Promise<T>
}

/**
 * The teacher's personal song-video collection: every video she added by
 * pasting a link, in the order added. Empty when she never pasted one (or
 * when she is signed out, which 401s). A malformed success body degrades
 * to the empty collection rather than crashing the dashboard.
 */
export async function getVideoLibrary(): Promise<PatternVideo[]> {
  const res = await fetch('/api/video-library')
  const data = await handleResponse<{ videos: PatternVideo[] }>(res)
  return Array.isArray(data.videos) ? data.videos : []
}

/**
 * Append one video to the teacher's personal collection (issue #458). The
 * server de-duplicates by video ID. Returns the updated collection.
 */
export async function addVideoToLibrary(video: PatternVideo): Promise<PatternVideo[]> {
  const res = await fetch('/api/video-library', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ video }),
  })
  const data = await handleResponse<{ videos: PatternVideo[] }>(res)
  return data.videos
}
