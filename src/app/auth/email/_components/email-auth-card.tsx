'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent } from '@/components/ui/card'
import { PatternMark } from '@/components/PatternMark'
import { Loader2 } from 'lucide-react'

/**
 * Shared shell for the custom email auth pages (/auth/email/*). Matches the
 * main /auth/signin card: dark card, PatternMark logo, centered heading.
 * Signed-in visitors bounce to the homepage; the session check shows a
 * spinner so logged-in users never see a login flash.
 */
export function EmailAuthCard({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    document.body.setAttribute('data-auth-page', 'true')
    return () => {
      document.body.removeAttribute('data-auth-page')
    }
  }, [])

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id != null) {
      router.replace('/')
    }
  }, [status, session, router])

  if (status === 'authenticated' && session?.user?.id != null) return null

  if (status === 'loading') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" role="status" aria-label="Checking sign-in status">
        <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
      </div>
    )
  }

  return (
    <div className="flex justify-center px-8 pt-32 pb-8">
      <Card className="mx-4 w-full max-w-[400px] sm:mx-0">
        <CardContent className="flex flex-col items-center px-10 py-12">
          <PatternMark className="h-[110px] w-[110px]" label="PatternSpell logo" />
          <h1 className="mt-6 text-center text-[26px] font-bold text-ink">{title}</h1>
          {subtitle ? <p className="mt-3 text-center text-[15px] leading-6 text-muted-foreground">{subtitle}</p> : null}
          <div className="mt-8 w-full">{children}</div>
        </CardContent>
      </Card>
    </div>
  )
}
