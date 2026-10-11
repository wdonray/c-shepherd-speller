'use client'

import Link from 'next/link'
import { MenuIcon } from 'lucide-react'
import { PatternMark } from '@/components/PatternMark'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetClose, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

/**
 * Public header for the landing page. The app header (account menu,
 * navigation) only makes sense behind auth; visitors get a simple
 * header with the product name and login/signup actions.
 *
 * Below the md breakpoint only the brand stays visible and the rest of
 * the nav collapses into a hamburger that opens a bottom sheet, matching
 * the app's existing mobile menu pattern.
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
        <nav aria-label="Landing page" className="hidden items-center gap-1 sm:gap-2 md:flex">
          <Link
            href="#how-it-works"
            className="rounded-xl px-4 py-2 text-[15px] font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60"
          >
            How it works
          </Link>
          <Link
            href="#who-its-for"
            className="rounded-xl px-4 py-2 text-[15px] font-semibold text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/60"
          >
            Who it is for
          </Link>
          <Button variant="ghost" asChild className="px-4">
            <Link href="/auth/signin">Log in</Link>
          </Button>
          <Button asChild className="px-4">
            <Link href="/auth/signin">Get started free</Link>
          </Button>
        </nav>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary" size="icon" className="md:hidden" aria-label="Open menu">
              <MenuIcon className="size-5" aria-hidden="true" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent
            side="bottom"
            className="rounded-t-3xl border-t-2 border-line bg-card pb-[calc(1rem+env(safe-area-inset-bottom))]"
          >
            <SheetHeader>
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <nav aria-label="Mobile navigation" className="flex flex-col gap-1 px-4">
              <SheetClose asChild>
                <Button size="lg" variant="ghost" asChild className="justify-start px-4">
                  <Link href="#how-it-works">How it works</Link>
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button size="lg" variant="ghost" asChild className="justify-start px-4">
                  <Link href="#who-its-for">Who it is for</Link>
                </Button>
              </SheetClose>
              <Separator className="my-1 bg-line" />
              <SheetClose asChild>
                <Button size="lg" variant="ghost" asChild className="justify-start px-4">
                  <Link href="/auth/signin">Log in</Link>
                </Button>
              </SheetClose>
              <SheetClose asChild>
                <Button size="lg" asChild>
                  <Link href="/auth/signin">Get started free</Link>
                </Button>
              </SheetClose>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
