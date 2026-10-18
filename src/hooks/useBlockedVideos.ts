'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { getUserByEmail } from '@/lib/spelling-api'
import type { BlockedVideo } from '@/models/User'
import { reportError } from '@/lib/report-error'
import { getErrorMessage, toastError, HttpError } from '@/lib/error-toast'

/** The video row the teacher acted on when hiding it. */
export interface BlockVideoInput {
  videoId: string
  title: string
  channel?: string
}

interface BlockedVideosState {
  userId: string | null
  blocked: BlockedVideo[]
}

/**
 * Persist the hidden-video list through the profile update route. Resolves
 * with the server's sanitized echo of the list, falling back to what was
 * sent when the response carries no user (defensive; the route always does).
 */
async function persistBlockedVideos(userId: string, blocked: BlockedVideo[]): Promise<BlockedVideo[]> {
  const response = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ blockedVideos: blocked }),
  })
  if (!response.ok) {
    throw new HttpError('Could not save hidden videos', response.status)
  }
  const data = (await response.json()) as { user?: { blockedVideos?: BlockedVideo[] } }
  return data.user?.blockedVideos ?? blocked
}

/**
 * The teacher's hidden-video list (issue #443: "don't ever show me this
 * video again"). Loads the profile once per mount; hide/unhide apply
 * optimistic updates and revert with an error toast when the save fails.
 * Signed-out teachers (and profiles that fail to load) get an empty list,
 * so video surfaces render unfiltered instead of hanging.
 */
export function useBlockedVideos() {
  const { data: session, status } = useSession()
  const [state, setState] = useState<BlockedVideosState>({ userId: null, blocked: [] })
  const [isLoaded, setIsLoaded] = useState(false)

  const email = session?.user?.email

  useEffect(() => {
    if (status === 'loading') return
    if (status !== 'authenticated' || !email) {
      setIsLoaded(true)
      return
    }
    let cancelled = false
    setIsLoaded(false)
    getUserByEmail(email)
      .then((user) => {
        if (cancelled) return
        setState({ userId: user.id, blocked: user.blockedVideos ?? [] })
        setIsLoaded(true)
      })
      .catch((error: unknown) => {
        if (cancelled) return
        reportError(error, { location: 'useBlockedVideos.load' })
        setIsLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [status, email])

  const blockVideo = useCallback(
    async (video: BlockVideoInput): Promise<void> => {
      const { userId, blocked } = state
      if (!userId || blocked.some((entry) => entry.videoId === video.videoId)) return
      const next: BlockedVideo[] = [
        ...blocked,
        { videoId: video.videoId, title: video.title, ...(video.channel ? { channel: video.channel } : {}) },
      ]
      setState({ userId, blocked: next })
      try {
        const saved = await persistBlockedVideos(userId, next)
        setState({ userId, blocked: saved })
      } catch (error) {
        setState({ userId, blocked })
        reportError(error, { location: 'useBlockedVideos.blockVideo' })
        toastError(getErrorMessage(error))
      }
    },
    [state]
  )

  const unblockVideo = useCallback(
    async (videoId: string): Promise<void> => {
      const { userId, blocked } = state
      if (!userId || !blocked.some((entry) => entry.videoId === videoId)) return
      const next = blocked.filter((entry) => entry.videoId !== videoId)
      setState({ userId, blocked: next })
      try {
        const saved = await persistBlockedVideos(userId, next)
        setState({ userId, blocked: saved })
      } catch (error) {
        setState({ userId, blocked })
        reportError(error, { location: 'useBlockedVideos.unblockVideo' })
        toastError(getErrorMessage(error))
      }
    },
    [state]
  )

  return {
    /** The hidden videos, in the order they were hidden. */
    blockedVideos: state.blocked,
    /** The hidden video IDs as a set, for filtering suggestions and cards. */
    blockedVideoIds: new Set(state.blocked.map((entry) => entry.videoId)),
    /** True once the profile has loaded (or hiding is unavailable). */
    isLoaded,
    /** The signed-in teacher's user id; null when hiding is unavailable. */
    userId: state.userId,
    blockVideo,
    unblockVideo,
  }
}
