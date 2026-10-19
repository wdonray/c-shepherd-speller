'use client'

import { useMemo, useState } from 'react'
import { SearchIcon, XIcon } from 'lucide-react'
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

  const searching = query.trim().length > 0
  const weeks = useMemo(() => {
    const pool = searching ? allWeeks() : getPrebuiltWeeks(grade)
    return pool.filter((week) => weekMatchesQuery(week, query))
  }, [grade, query, searching])

  return (
    <section aria-labelledby="prebuilt-library-heading" className="pt-4">
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
            : `${weeks.length} ${weeks.length === 1 ? 'week' : 'weeks'} matching "${query.trim()}" across all grades.`
          : `Showing ${weeks.length} weeks of ${prebuiltGradeLabel(grade)} spelling patterns.`}
      </p>

      {weeks.length > 0 && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="prebuilt-grid">
          {weeks.map((week) => {
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
    </section>
  )
}
