import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * "Back breadcrumb": a single link to the current page's immediate parent,
 * labeled with the parent's page name, never with "Back" (issue #378).
 *
 * Research (NN/g, GOV.UK, Intelligence Community design systems) says
 * breadcrumbs must show the site hierarchy, not the session history, and
 * that apps one or two levels deep should use exactly this pattern: the
 * parent's real name as the link text. A link labeled "Back" promises the
 * page the teacher came from, but every one of ours went to a fixed
 * destination, which is what confused people. Naming the destination makes
 * the click a promise the app can always keep.
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
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg text-[14px] font-semibold text-muted-foreground outline-none transition hover:text-ink focus-visible:ring-[3px] focus-visible:ring-ring/60',
        className
      )}
    >
      <ArrowLeft className="size-4" aria-hidden="true" />
      {label}
    </Link>
  )
}
