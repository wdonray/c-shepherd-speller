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
 *
 * Mobile layout follows native auth-screen conventions: top-aligned with
 * modest top padding (not a huge fixed offset), compact branding, roomy
 * 20px+ field rhythm, and safe-area-aware bottom padding. The page always
 * scrolls, including with the iOS keyboard open. Desktop keeps the
 * vertically centered card.
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
    if (status === 'authenticated' && session?.user?.id != null) {
      router.replace('/home')
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
    <div className="flex justify-center px-5 pt-10 pb-[max(2rem,env(safe-area-inset-bottom))] sm:min-h-[85vh] sm:items-center sm:px-8 sm:py-16">
      <Card className="w-full max-w-[400px]">
        <CardContent className="flex flex-col items-center px-6 py-8 sm:px-10 sm:py-12">
          <PatternMark className="h-[72px] w-[72px] sm:h-[110px] sm:w-[110px]" label="PatternSpell logo" />
          <h1 className="mt-5 text-center text-[26px] font-bold text-ink sm:mt-6">{title}</h1>
          {subtitle ? (
            <p className="mt-2 text-center text-[15px] leading-6 text-muted-foreground sm:mt-3">{subtitle}</p>
          ) : null}
          <div className="mt-6 w-full sm:mt-8">{children}</div>
        </CardContent>
      </Card>
    </div>
  )
}
