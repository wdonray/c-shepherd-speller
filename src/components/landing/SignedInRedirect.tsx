'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

/**
 * Signed-in visitors have no use for the marketing page; send them
 * straight to the app dashboard instead of showing login buttons.
 */
export function SignedInRedirect() {
  const { status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/home')
    }
  }, [status, router])

  return null
}
