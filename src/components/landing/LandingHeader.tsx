import Link from 'next/link'
import { PatternMark } from '@/components/PatternMark'
import { Button } from '@/components/ui/button'

/**
 * Public header for the landing page. The app header (account menu,
 * navigation) only makes sense behind auth; visitors get a simple
 * header with the product name and login/signup actions.
 */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-line bg-paper/95 backdrop-blur">
      <div className="mx-auto flex h-[72px] max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          aria-label="PatternSpell home"
          className="flex items-center gap-3 rounded-xl outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          <PatternMark label="PatternSpell logo" />
          <span className="text-[22px] font-bold tracking-tight text-ink">PatternSpell</span>
        </Link>
        <nav aria-label="Landing page" className="flex items-center gap-1 sm:gap-2">
          <Link
            href="#how-it-works"
            className="hidden rounded-xl px-4 py-2 text-[15px] font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60 md:block"
          >
            How it works
          </Link>
          <Link
            href="#who-its-for"
            className="hidden rounded-xl px-4 py-2 text-[15px] font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60 md:block"
          >
            Who it is for
          </Link>
          <Button variant="ghost" asChild className="px-4">
            <Link href="/auth/signin">Log in</Link>
          </Button>
          <Button asChild className="px-4">
            <Link href="/auth/signin">
              <span className="sm:hidden">Start free</span>
              <span className="hidden sm:inline">Get started free</span>
            </Link>
          </Button>
        </nav>
      </div>
    </header>
  )
}
