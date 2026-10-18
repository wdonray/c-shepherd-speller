'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { PREBUILT_GRADES, getPrebuiltWeeks, prebuiltGradeLabel, type PrebuiltGrade } from '@/lib/prebuilt-lists'
import PrebuiltBadge from './PrebuiltBadge'

/**
 * Browse the prebuilt curriculum library (issue #463, Phase A). Grade tabs
 * filter the 162-week collection; each week row shows its patterns as chips
 * so the teacher can see what is inside before opening the read-only
 * preview. Matches the SongVideoBrowser layout (search-less: the collection
 * is small enough to scan by grade).
 */
export default function PrebuiltLibraryBrowser() {
  const [grade, setGrade] = useState<PrebuiltGrade>('1')
  const weeks = getPrebuiltWeeks(grade)

  return (
    <div className="space-y-6">
      <div role="tablist" aria-label="Filter prebuilt lists by grade" className="flex flex-wrap gap-2">
        {PREBUILT_GRADES.map((g) => (
          <button
            key={g}
            type="button"
            role="tab"
            aria-selected={grade === g}
            onClick={() => setGrade(g)}
            className={cn(
              'min-h-[44px] rounded-full px-5 py-2 text-[15px] font-bold outline-none transition-colors',
              'focus-visible:ring-[3px] focus-visible:ring-ring/60',
              grade === g ? 'bg-ink text-background' : 'text-muted-foreground hover:text-ink'
            )}
          >
            {g === 'k' ? 'K' : g}
          </button>
        ))}
      </div>

      <p className="text-sm text-muted-foreground" role="status">
        Showing {weeks.length} weeks of {prebuiltGradeLabel(grade)} spelling patterns
      </p>

      <ul className="space-y-3">
        {weeks.map((week) => (
          <li key={week.id}>
            <Link
              href={`/library/${week.id}`}
              className="flex items-center gap-4 rounded-[20px] border-2 border-line bg-card p-4 outline-none transition hover:border-sky-deep focus-visible:border-sky-deep focus-visible:ring-[3px] focus-visible:ring-ring/60"
            >
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[17px] font-bold text-ink">Week {week.week}</span>
                  <PrebuiltBadge />
                </div>
                <div className="flex flex-wrap gap-1.5" aria-label="Spelling patterns">
                  {week.patterns.map((p) => (
                    <span
                      key={p.pattern}
                      className="rounded-full bg-line/50 px-2.5 py-0.5 text-[13px] font-bold text-ink"
                    >
                      {p.pattern}
                    </span>
                  ))}
                </div>
              </div>
              <span className="shrink-0 text-sm font-bold text-muted-foreground" aria-hidden="true">
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
