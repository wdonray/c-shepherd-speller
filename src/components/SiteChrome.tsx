'use client'

import { usePathname } from 'next/navigation'
import { Header } from './Header'
import { Footer } from './Footer'

/**
 * Site chrome wrapper. The display route is chrome-free for projector use,
 * list print routes are chrome-free for a clean poster with no site
 * header or footer, and the landing page renders its own public header
 * and footer; everywhere else gets the app header and footer.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/' || pathname === '/display' || pathname?.endsWith('/print')) {
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
