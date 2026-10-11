'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * Signed-in visitors have no use for the marketing page; send them
 * straight to the app dashboard instead of showing login buttons.
 * The full-screen cover stays up until we know the visitor is signed
 * out, so the landing page never flashes: not while the session is
 * loading, and not in the gap between auth resolving and the redirect
 * to /home completing.
 */
export function SignedInRedirect() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/home')
    }
  }, [status, router])

  if (status === 'unauthenticated') {
    return null
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-paper"
      role="status"
      aria-label="Checking sign-in status"
    >
      <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
    </div>
  )
}
