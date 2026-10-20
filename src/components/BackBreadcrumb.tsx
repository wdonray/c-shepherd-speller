'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePreviousPage } from '@/lib/navigation-history'

/**
 * "Back breadcrumb": a single back control, never labeled "Back" (issue #378).
 *
 * History-aware (issue #504), following the iOS convention: when the teacher
 * arrived via in-app navigation, the control names the page they actually
 * came from (e.g. "Home") and performs a real history-back, preserving
 * scroll and state where the browser supports it. The per-tab navigation
 * trail mirrors the session-history stack (pushes append, history-back
 * pops), so the named page is always where a real back lands, even across
 * same-pathname search-param steps. On direct landing (refresh, deep link,
 * new tab: no in-app referrer in this tab), it falls back to the
 * parent-named link, which is always a promise the app can keep.
 *
 * NN/g's "breadcrumbs show hierarchy, not history" rule is about breadcrumb
 * trails; a single back control is the history-showing control, which NN/g
 * explicitly contrasts with the browser's native Back button.
 *
 * The visual style is identical in both modes; only the label and the target
 * get smarter. The control never renders the history label during SSR (the
 * hook's server snapshot is null), so hydration never mismatches.
 */
export default function BackBreadcrumb({
  href,
  label,
  className,
}: {
  href: string
  label: string
  className?: string
}) {
  const router = useRouter()
  const previousPage = usePreviousPage()

  const classNames = cn(
    'inline-flex items-center gap-1.5 rounded-lg text-[14px] font-semibold text-muted-foreground outline-none transition hover:text-ink focus-visible:ring-[3px] focus-visible:ring-ring/60',
    className
  )

  if (previousPage !== null && window.history.length > 1) {
    return (
      <button type="button" onClick={() => router.back()} className={classNames}>
        <ArrowLeft className="size-4" aria-hidden="true" />
        {previousPage.name}
      </button>
    )
  }

  return (
    <Link href={href} className={classNames}>
      <ArrowLeft className="size-4" aria-hidden="true" />
      {label}
    </Link>
  )
}
