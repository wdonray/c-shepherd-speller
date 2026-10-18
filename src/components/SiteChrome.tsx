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
 * and footer. The worksheets print route is the exception among print
 * routes: its first step (filling in missing sentences) is interactive
 * screen UI, so it keeps the header and footer on screen and hides them
 * only in print CSS (issue #436). The list picker at /display keeps the
 * site header: present mode only begins when the teacher picks a list.
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

  if (pathname === '/') {
    return <main className="min-h-dvh">{children}</main>
  }

  // List print routes render a clean poster with no site header or footer.
  if (pathname?.endsWith('/print') && !pathname.endsWith('/worksheets/print')) {
    return <main className="min-h-dvh">{children}</main>
  }

  // The worksheets print route keeps the header and footer on screen: its
  // first step (filling in missing sentences) is interactive screen UI, not
  // the print job (issue #436). They hide in print CSS so the job itself
  // still prints clean, exactly as before.
  if (pathname?.endsWith('/worksheets/print')) {
    return (
      <>
        <div className={`${HEADER_SLOT_CLASS} print:hidden`}>
          <Header />
        </div>
        <main className="min-h-dvh">{children}</main>
        <div className="print:hidden">
          <Footer />
        </div>
      </>
    )
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
