'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, SearchIcon, XIcon } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  PREBUILT_GRADES,
  getPrebuiltWeeks,
  prebuiltGradeLabel,
  prebuiltWeekToWordList,
  type PrebuiltGrade,
  type PrebuiltWeek,
} from '@/lib/prebuilt-lists'
import WordListCard from './WordListCard'
import PrebuiltBadge from './PrebuiltBadge'

/** Case-insensitive substring match on a week's patterns and sounds. */
function weekMatchesQuery(week: PrebuiltWeek, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return week.patterns.some((p) => p.pattern.toLowerCase().includes(q) || p.sound.toLowerCase().includes(q))
}

function allWeeks(): PrebuiltWeek[] {
  return PREBUILT_GRADES.flatMap((g) => getPrebuiltWeeks(g))
}

/**
 * Weeks per page (issue #481): the card grid is 3 columns on desktop, 2 on
 * small screens, 1 on mobile, so 12 is 4 / 6 / 12 full rows. Rendering all
 * 30 grade weeks (up to 162 on a cross-grade search) at once kept /lists
 * interactive at ~2-4s; paginating targets under 500ms.
 */
export const PREBUILT_WEEKS_PER_PAGE = 12

/** Visible page-number window around the current page (at most 5). */
export function prebuiltPageWindow(current: number, total: number): number[] {
  const size = 5
  const half = Math.floor(size / 2)
  const end = Math.min(total, Math.max(current + half, size))
  const start = Math.max(1, end - size + 1)
  return Array.from({ length: end - start + 1 }, (_, i) => start + i)
}

/**
 * The prebuilt curriculum library as a section of the lists overview page
 * (issue #463 redesign). The teacher's own lists stay primary above; this
 * section is secondary and additive. Pattern search is the primary way in:
 * it matches weeks across all grades by spelling pattern or sound. The
 * grade pills browse one grade at a time. Week cards reuse WordListCard so
 * the section reads as part of the page, with the Prebuilt badge as the
 * distinction from the teacher's own lists.
 */
export default function PrebuiltLibrarySection() {
  const [grade, setGrade] = useState<PrebuiltGrade>('1')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)

  const searching = query.trim().length > 0
  const weeks = useMemo(() => {
    const pool = searching ? allWeeks() : getPrebuiltWeeks(grade)
    return pool.filter((week) => weekMatchesQuery(week, query))
  }, [grade, query, searching])

  // A new grade or search is a new result set: always start on page 1.
  useEffect(() => {
    setPage(1)
  }, [grade, query])

  const pageCount = Math.max(1, Math.ceil(weeks.length / PREBUILT_WEEKS_PER_PAGE))
  const safePage = Math.min(page, pageCount)
  const start = weeks.length === 0 ? 0 : (safePage - 1) * PREBUILT_WEEKS_PER_PAGE + 1
  const end = Math.min(safePage * PREBUILT_WEEKS_PER_PAGE, weeks.length)
  const pageWeeks = weeks.slice(start - 1, end)
  const weekWord = weeks.length === 1 ? 'week' : 'weeks'

  return (
    <section id="prebuilt-library" aria-labelledby="prebuilt-library-heading" className="pt-4 scroll-mt-20">
      <h3 id="prebuilt-library-heading" className="text-lg font-bold">
        Prebuilt library
      </h3>
      <p className="mt-1 text-[15px] text-muted-foreground">
        162 weeks of ready-made spelling lists for grades K through 5. Search by pattern or pick a grade, preview a
        week, then make it your own.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div
          role="tablist"
          aria-label="Filter prebuilt lists by grade"
          className="inline-flex flex-wrap rounded-full border-2 border-line bg-card p-1"
        >
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
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
          <SearchIcon
            className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search patterns, e.g. ai, sh, tion"
            aria-label="Search prebuilt lists by pattern"
            className="min-h-[44px] rounded-full pl-10 pr-10"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear pattern search"
              className={cn(
                'absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full',
                'text-muted-foreground outline-none transition-colors hover:bg-line/60 hover:text-ink',
                'focus-visible:ring-[3px] focus-visible:ring-ring/60'
              )}
            >
              <XIcon className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <p className="mt-3 text-[15px] text-muted-foreground" role="status">
        {searching
          ? weeks.length === 0
            ? `No prebuilt weeks match "${query.trim()}".`
            : `Showing ${start}-${end} of ${weeks.length} ${weekWord} matching "${query.trim()}" across all grades.`
          : `Showing ${start}-${end} of ${weeks.length} ${weekWord} of ${prebuiltGradeLabel(grade)} spelling patterns.`}
      </p>

      {weeks.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="prebuilt-grid">
          {pageWeeks.map((week) => {
            // The title already reads "Grade 2 - Week 6", so the week and
            // grade badges would repeat it; the Prebuilt badge is the only
            // marker these cards need.
            const list = { ...prebuiltWeekToWordList(week), week: '', gradeLevel: '' }
            return (
              <WordListCard
                key={week.id}
                list={list}
                href={`/lists/prebuilt/${week.id}`}
                primaryLabel="Preview"
                showPresent={false}
                badge={<PrebuiltBadge />}
              />
            )
          })}
        </div>
      )}

      {pageCount > 1 && (
        <nav aria-label="Prebuilt library pages" className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage(safePage - 1)}
            disabled={safePage === 1}
            aria-label="Previous page"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-2 border-line bg-card px-3 text-[15px] font-bold text-ink outline-none transition-colors hover:border-sky-deep focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeftIcon className="size-5" aria-hidden="true" />
          </button>
          {prebuiltPageWindow(safePage, pageCount).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              aria-label={`Go to page ${p}`}
              aria-current={p === safePage ? 'page' : undefined}
              className={cn(
                'min-h-[44px] min-w-[44px] rounded-full border-2 px-3 text-[15px] font-bold outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/60',
                p === safePage
                  ? 'border-ink bg-ink text-background'
                  : 'border-line bg-card text-muted-foreground hover:border-sky-deep hover:text-ink'
              )}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPage(safePage + 1)}
            disabled={safePage === pageCount}
            aria-label="Next page"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-2 border-line bg-card px-3 text-[15px] font-bold text-ink outline-none transition-colors hover:border-sky-deep focus-visible:ring-[3px] focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRightIcon className="size-5" aria-hidden="true" />
          </button>
        </nav>
      )}
    </section>
  )
}
