'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Header } from './Header'
import { Footer } from './Footer'

/**
 * Site chrome wrapper. Present mode (/display with a list selected) is
 * chrome-free for projector use, list print routes are chrome-free for a
 * clean poster with no site header or footer, and the landing page renders
 * its own public header and footer; everywhere else gets the app header
 * and footer. The list picker at /display keeps the site header: present
 * mode only begins when the teacher picks a list.
 */
function SiteChromeInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isPresentMode = pathname === '/display' && searchParams.get('list') !== null

  if (pathname === '/' || isPresentMode || pathname?.endsWith('/print')) {
    return <main className="min-h-dvh">{children}</main>
  }

  return (
    <>
      <Header />
      <main className="min-h-dvh">{children}</main>
      <Footer />
    </>
  )
}

export function SiteChrome({ children }: { children: React.ReactNode }) {
  // useSearchParams needs a Suspense boundary for static prerendering. The
  // fallback stays chrome-free so the chart route renders exactly as before;
  // the picker briefly streams without the site header on a cold load.
  return (
    <Suspense fallback={<main className="min-h-dvh">{children}</main>}>
      <SiteChromeInner>{children}</SiteChromeInner>
    </Suspense>
  )
}
