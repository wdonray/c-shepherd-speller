'use client'

import { usePathname } from 'next/navigation'
import { Header } from './Header'
import { Footer } from './Footer'

/**
 * Site chrome wrapper. The display route is chrome-free for projector use:
 * no site header or footer, just the page content full-bleed.
 */
export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (pathname === '/display') {
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
