import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Consistent back navigation link for page headers.
 * Tight spacing: the link sits close to the content above and below,
 * following the app's compact header rhythm.
 */
export default function BackLink({
  href,
  children,
  className,
}: {
  href: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg text-[14px] font-semibold text-muted-foreground outline-none transition hover:text-ink focus-visible:ring-[3px] focus-visible:ring-ring/60',
        className
      )}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {children}
    </Link>
  )
}
