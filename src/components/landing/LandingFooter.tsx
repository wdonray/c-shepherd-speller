import Link from 'next/link'
import { PatternMark } from '@/components/PatternMark'

/** Simple public footer for the landing page. */
export function LandingFooter() {
  return (
    <footer className="border-t border-line bg-paper">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 sm:flex-row">
        <div className="flex items-center gap-2">
          <PatternMark label="PatternSpell logo" />
          <span className="text-[15px] font-bold text-ink">PatternSpell</span>
        </div>
        <nav aria-label="Legal" className="flex items-center gap-6">
          <Link
            href="/privacy"
            className="rounded text-[14px] text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/60"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="rounded text-[14px] text-muted-foreground underline-offset-2 outline-none hover:text-foreground hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/60"
          >
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  )
}
