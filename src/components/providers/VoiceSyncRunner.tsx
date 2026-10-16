'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { syncNow } from '@/lib/voice-sync'

/**
 * Runs the voice-recording sync pass whenever the teacher is signed in.
 * Mounted once in the root layout inside the SessionProvider. Sync is
 * best-effort and silent: it never blocks rendering and never surfaces
 * errors to the teacher.
 */
export default function VoiceSyncRunner() {
  const { status } = useSession()

  useEffect(() => {
    if (status !== 'authenticated') return
    // syncNow never throws; the void keeps the linter honest about the float.
    void syncNow()
  }, [status])

  return null
}
