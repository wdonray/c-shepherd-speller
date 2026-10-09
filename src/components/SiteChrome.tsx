'use client'

import { usePathname } from 'next/navigation'
import { Header } from './Header'
import { Footer } from './Footer'

/**
 * Site chrome wrapper. The display route is chrome-free for projector use,
 * and list print routes are chrome-free for a clean poster with no site
 * header or footer; the page content goes full-bleed.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/display' || pathname?.endsWith('/print')) {
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
