'use client'

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react'
import { ReactNode } from 'react'

interface SessionProviderProps {
  children: ReactNode
}

export default function SessionProvider({ children }: SessionProviderProps) {
  // refetchOnWindowFocus defaults to true in next-auth v4, which refetches
  // /api/auth/session on every visibilitychange and pushes a new session
  // object through context. That re-renders every useSession consumer and
  // re-runs the home page's syncUser effect, flashing the loading spinner
  // whenever the tab regains focus. The session is only used for identity
  // (name/email/avatar), so per-focus freshness is not needed. Sign-in and
  // sign-out still trigger an explicit session refresh.
  return <NextAuthSessionProvider refetchOnWindowFocus={false}>{children}</NextAuthSessionProvider>
}
