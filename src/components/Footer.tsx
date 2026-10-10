import { BuyMeACoffeeButton } from './BuyMeACoffeeButton'

export function Footer() {
  return (
    <footer className="w-full border-t-2 border-line bg-card pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-4 pt-6 pb-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-sm text-muted-foreground">PatternSpell. Made for K-3 classrooms.</p>
        <div className="flex items-center gap-4">
          <a
            href="https://www.donray.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            donray.dev
          </a>
          <a
            href="https://www.linkedin.com/in/donrayxwilliams/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            LinkedIn
          </a>
          <a href="/privacy" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Privacy
          </a>
          <a href="/terms" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
            Terms
          </a>
          <BuyMeACoffeeButton />
        </div>
      </div>
    </footer>
  )
}
