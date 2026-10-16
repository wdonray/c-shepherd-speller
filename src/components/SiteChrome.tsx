'use client'

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { Header } from './Header'
import { Footer } from './Footer'

/**
 * Reserved header height: the header bar is h-[72px] plus its 2px bottom
 * border. The slot is always rendered at this height (even while Header
 * returns null before the session loads) so the header popping in never
 * shifts the page (issue #341).
 */
const HEADER_SLOT_CLASS = 'min-h-[74px]'

/**
 * Site chrome wrapper. Present mode (/display with a list selected) is
 * chrome-free for projector use, list print routes are chrome-free for a
 * clean poster with no site header or footer, and the landing page renders
 * its own public header and footer; everywhere else gets the app header
 * and footer. The list picker at /display keeps the site header: present
 * mode only begins when the teacher picks a list.
 *
 * Only the /display route needs useSearchParams (to detect present mode),
 * so only it pays for a Suspense boundary. Every other route renders its
 * chrome (or lack of it) synchronously with the header slot reserved, which
 * keeps layout shift at zero. The /display fallback reserves the header
 * space because the picker is the common cold-load case; a cold load
 * straight into present mode may still shift 74px once.
 */
function HeaderSlot() {
  return (
    <div className={HEADER_SLOT_CLASS}>
      <Header />
    </div>
  )
}

function DisplayChrome({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  const isPresentMode = searchParams.get('list') !== null

  if (isPresentMode) {
    return <main className="min-h-dvh">{children}</main>
  }

  return (
    <>
      <HeaderSlot />
      <main className="min-h-dvh">{children}</main>
      <Footer />
    </>
  )
}

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/' || pathname?.endsWith('/print')) {
    return <main className="min-h-dvh">{children}</main>
  }

  if (pathname === '/display') {
    return (
      <Suspense
        fallback={
          <>
            <div className={`${HEADER_SLOT_CLASS} border-b-2 border-line bg-card`} aria-hidden="true" />
            <main className="min-h-dvh">{children}</main>
          </>
        }
      >
        <DisplayChrome>{children}</DisplayChrome>
      </Suspense>
    )
  }

  return (
    <>
      <HeaderSlot />
      <main className="min-h-dvh">{children}</main>
      <Footer />
    </>
  )
}
