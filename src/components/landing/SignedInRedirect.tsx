'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'

/**
 * Signed-in visitors have no use for the marketing page; send them
 * straight to the app dashboard instead of showing login buttons.
 * While the session is still loading we cover the page with a spinner
 * so visitors never see the landing page flash before the redirect.
 */
export function SignedInRedirect() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/home')
    }
  }, [status, router])

  if (status !== 'loading') {
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
