'use client'

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeftIcon, PrinterIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getList, getLists, updateList } from '@/lib/lists-api'
import { getAssignedWeeks, type WordList } from '@/models/WordList'
import PatternChartDisplay from './PatternChartDisplay'
import ChartActionsMenu from './ChartActionsMenu'
import FullscreenButton from './FullscreenButton'
import RulesVisibilityToggle from './RulesVisibilityToggle'
import WordUnderlineToggle from './WordUnderlineToggle'
import SortActivity from './SortActivity'
import WordListCard from './WordListCard'
import PresentingTipsBar from './PresentingTipsBar'
import WhyChartPopover from './WhyChartPopover'
import { reportError } from '@/lib/report-error'

const LOAD_ERROR = 'Could not load the word list. Check your connection and try again.'

/**
 * Display mode: pattern chart for the selected list, sized for projectors
 * and smartboards. Reads ?list=<id> from the URL; if absent, shows a list
 * picker.
 */
function DisplayModeInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const listId = searchParams.get('list')

  const [list, setList] = useState<WordList | null>(null)
  const [allLists, setAllLists] = useState<WordList[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortMode, setSortMode] = useState(false)
  /** Selected week chip; null means "All weeks" (every list). */
  const [weekFilter, setWeekFilter] = useState<string | null>(null)

  // Weeks actually assigned to lists; drives the filter chips.
  const assignedWeeks = useMemo(() => getAssignedWeeks(allLists), [allLists])

  // Lists shown by the picker: every list under "All weeks", only the
  // matching week's lists under a week chip. Unassigned lists are hidden
  // under a specific week, since teachers who do not think in weeks never
  // have to assign one.
  const visibleLists = weekFilter === null ? allLists : allLists.filter((l) => l.week?.trim() === weekFilter)

  // A selected week that no longer exists (a list was unassigned or
  // deleted) falls back to "All weeks" instead of showing an empty picker.
  useEffect(() => {
    if (weekFilter !== null && !assignedWeeks.includes(weekFilter)) {
      setWeekFilter(null)
    }
  }, [assignedWeeks, weekFilter])

  // Back to the app always goes home.
  const backToApp = useCallback(() => {
    router.push('/home')
  }, [router])

  // Escape never navigates. When the browser is in full screen, Escape exits
  // full screen natively; the app takes no action on Escape at all.

  // Lock/unlock a pattern in present mode: optimistic update, then persist.
  // On failure the optimistic change is reverted and the load error is shown.
  // Takes the current list as an argument so there is no nullable-list branch:
  // the toggle only renders once a list is loaded.
  const handleToggleLock = useCallback(async (patternId: string, current: WordList) => {
    const nextPatterns = current.patterns.map((p) => (p.id === patternId ? { ...p, isLocked: !p.isLocked } : p))
    setList({ ...current, patterns: nextPatterns })
    setToggleError(null)
    try {
      const saved = await updateList(current.id, { patterns: nextPatterns })
      setList(saved)
    } catch {
      setList(current)
      setToggleError(LOAD_ERROR)
    }
  }, [])

  // The list's classroom rules by pattern text, for the present chart.
  // Rules are managed on the list page now (issue #263); the chart is
  // display-only. Null when the list has no classroom.
  const [classRules, setClassRules] = useState<Record<string, string> | null>(null)
  const [className, setClassName] = useState<string | null>(null)
  // Rule display visibility on the chart (issue #310). Default shown.
  const [showRules, setShowRules] = useState(true)
  // Word underline visibility on the chart (issue #264). Default hidden:
  // underlines stay off when the Present chart loads until the teacher
  // turns them on.
  const [showUnderlines, setShowUnderlines] = useState(false)

  useEffect(() => {
    const classId = list?.classId
    if (!classId) {
      setClassRules(null)
      setClassName(null)
      return
    }
    let cancelled = false
    fetch(`/api/classes/${encodeURIComponent(classId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((body) => {
        if (cancelled) return
        const rules: Record<string, string> = {}
        for (const [patternText, rule] of Object.entries(body.class.rules ?? {})) {
          rules[patternText] = (rule as { rule: string }).rule
        }
        setClassRules(rules)
        setClassName(body.class.name)
      })
      .catch(() => {
        if (!cancelled) {
          setClassRules(null)
          setClassName(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [list?.classId])

  // Escape never navigates. When the browser is in full screen, Escape exits
  // full screen natively; the app takes no action on Escape at all.

  useEffect(() => {
    setLoading(true)
    setLoadError(null)

    const load = async () => {
      try {
        if (listId) {
          const data = await getList(listId)
          setList(data)
        } else {
          const data = await getLists()
          setAllLists(data)
        }
      } catch (error) {
        reportError(error, { location: 'DisplayMode.load' })
        setLoadError(LOAD_ERROR)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [listId])

  if (loading) {
    // No list selected: the picker loads, so the skeleton depicts the picker
    // (issue #341). With a list selected, the chart skeleton is correct.
    if (!listId) {
      return (
        <div
          className="flex min-h-screen flex-col bg-background"
          role="status"
          aria-label="Loading lists"
          aria-busy="true"
        >
          {/* Subheader: matches the loaded sticky picker subheader */}
          <div className="sticky top-0 z-10 border-b-2 border-line bg-card" aria-hidden="true">
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="h-9 w-20 animate-pulse rounded-xl bg-line/60" />
              <div className="h-7 w-48 animate-pulse rounded-lg bg-line/60" />
            </div>
          </div>
          {/* Picker: matches the loaded max-w-6xl picker layout */}
          <div className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8 sm:px-8" aria-hidden="true">
            {/* Description: two paragraphs like the loaded copy (issue #341) */}
            <div className="h-[45px] animate-pulse rounded-lg bg-line/60 sm:h-6" />
            <div className="mt-2 h-[113px] animate-pulse rounded-lg bg-line/40 sm:h-12" />
            <div className="flex flex-wrap gap-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-9 w-24 animate-pulse rounded-xl bg-line/60" />
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="overflow-hidden rounded-[20px] border-2 border-line bg-card">
                  <div className="h-2 w-full animate-pulse bg-line/60" />
                  <div className="flex flex-col gap-3 p-6">
                    <div className="h-7 w-3/4 animate-pulse rounded-lg bg-line/60" />
                    <div className="h-5 w-1/2 animate-pulse rounded-lg bg-line/40" />
                    <div className="pt-2" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }
    return (
      <div
        className="flex min-h-screen flex-col bg-background"
        role="status"
        aria-label="Loading chart"
        aria-busy="true"
      >
        {/* Header: matches loaded sticky header */}
        <div className="border-b-2 border-line bg-card" aria-hidden="true">
          <div className="flex items-center gap-2 px-4 py-3">
            <div className="h-9 w-20 animate-pulse rounded-xl bg-line/60" />
            <div className="h-7 w-48 animate-pulse rounded-lg bg-line/60" />
            <div className="ml-auto h-9 w-24 animate-pulse rounded-xl bg-line/60" />
          </div>
        </div>
        {/* Chart: matches PatternChartDisplay column layout */}
        <div className="flex-1 px-4 py-6 sm:px-8" aria-hidden="true">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl border-2 border-line bg-card p-6">
                <div className="h-8 w-2/3 animate-pulse rounded-lg bg-line/60" />
                <div className="mt-2 h-5 w-1/2 animate-pulse rounded-lg bg-line/40" />
                <div className="mt-4 space-y-2">
                  {[0, 1, 2, 3].map((j) => (
                    <div key={j} className="h-10 animate-pulse rounded-xl bg-line/40" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
        <div
          role="alert"
          className="w-full max-w-md space-y-2 rounded-[20px] border-2 border-coral bg-coral-soft p-6 text-center"
        >
          <p className="text-lg font-bold text-coral-ink">Could not load the word list</p>
          <p className="text-[15px] text-ink">{LOAD_ERROR}</p>
        </div>
        <Button variant="secondary" asChild>
          <Link href="/home">Back to home</Link>
        </Button>
      </div>
    )
  }

  // No list selected: show the picker.
  if (!listId || !list) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="sticky top-0 z-10 border-b-2 border-line bg-card">
          <div className="flex items-center gap-2 px-4 py-3">
            <Button variant="ghost" size="sm" onClick={backToApp} aria-label="Back">
              <ChevronLeftIcon className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline-block">Back</span>
            </Button>
            <h1 className="text-xl font-bold text-ink">Present a list</h1>
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8 sm:px-8">
          <p className="text-[15px] text-muted-foreground">
            Choose a list to show its pattern chart on the big screen.
          </p>
          <p className="mt-2 max-w-3xl text-[15px] text-muted-foreground">
            One column per pattern, all words visible at once. Use the fullscreen button for the biggest readable chart,
            lock patterns you want to hold back, and try Sort words to turn the chart into a class sorting activity.
          </p>
          {assignedWeeks.length > 0 && (
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter lists by week">
              <Button
                size="sm"
                variant={weekFilter === null ? 'default' : 'secondary'}
                onClick={() => setWeekFilter(null)}
                aria-pressed={weekFilter === null}
              >
                All weeks
              </Button>
              {assignedWeeks.map((week) => (
                <Button
                  key={week}
                  size="sm"
                  variant={weekFilter === week ? 'default' : 'secondary'}
                  onClick={() => setWeekFilter(week)}
                  aria-pressed={weekFilter === week}
                >
                  {week}
                </Button>
              ))}
            </div>
          )}
          {allLists.length === 0 ? (
            <div className="rounded-[20px] border-2 border-line bg-card p-12 text-center">
              <p className="text-xl font-bold text-ink">No word lists yet</p>
              <p className="mt-2 text-[15px] text-muted-foreground">Create one from My Spelling Lists first.</p>
              <Button className="mt-6" asChild>
                <Link href="/home">Back to home</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleLists.map((l) => (
                <WordListCard
                  key={l.id}
                  list={l}
                  href={`/display?list=${encodeURIComponent(l.id)}`}
                  primaryLabel="Present chart"
                  showPresent={false}
                  showPreview={false}
                  hoverLift
                />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // Show the pattern chart.
  // In sort mode the sort surface fills the available area: no header, no
  // subheader. SortActivity brings its own Exit control and class pill.
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!sortMode && (
        <div className="sticky top-0 z-10 border-b-2 border-line bg-card">
          <div className="flex items-center gap-2 px-4 py-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/display" aria-label="Choose a different list">
                <ChevronLeftIcon className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline-block">Lists</span>
              </Link>
            </Button>
            <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-ink">{list.name}</h1>
            {/* The list's classroom, clearly shown (issue #263): this is what
                the old sort-entry picker communicated, now visible up front. */}
            <span
              className="hidden shrink-0 rounded-full border-2 border-line bg-background px-2.5 py-1 text-xs font-extrabold text-muted-foreground sm:inline-block"
              title={className ? `Classroom: ${className}` : 'No classroom assigned'}
            >
              {className ?? 'No class'}
            </span>
            {/* Secondary chart controls: the full bar on desktop, collapsed
                into the overflow menu on mobile so the title keeps room
                (issue #312). */}
            <div className="hidden shrink-0 sm:block">
              <WhyChartPopover />
            </div>
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <RulesVisibilityToggle showRules={showRules} onToggle={() => setShowRules((v) => !v)} />
              <WordUnderlineToggle showUnderlines={showUnderlines} onToggle={() => setShowUnderlines((v) => !v)} />
              <Button variant="secondary" size="sm" asChild>
                <Link href={`/lists/${list.id}/print`}>
                  <PrinterIcon className="size-4" aria-hidden="true" />
                  Print chart
                </Link>
              </Button>
            </div>
            <Button size="sm" onClick={() => setSortMode(true)} className="shrink-0">
              Sort words
            </Button>
            <div className="hidden shrink-0 sm:block">
              <FullscreenButton />
            </div>
            <div className="shrink-0 sm:hidden">
              <ChartActionsMenu
                listId={list.id}
                showRules={showRules}
                onToggleRules={() => setShowRules((v) => !v)}
                showUnderlines={showUnderlines}
                onToggleUnderlines={() => setShowUnderlines((v) => !v)}
              />
            </div>
          </div>
        </div>
      )}
      <main className="flex-1 px-4 py-6 sm:px-8">
        {!sortMode && <PresentingTipsBar />}
        {toggleError && (
          <div
            role="alert"
            className="mx-auto mb-6 flex w-full max-w-2xl items-center justify-between gap-4 rounded-[20px] border-2 border-coral bg-coral-soft p-4"
          >
            <p className="text-[15px] font-bold text-coral-ink">{toggleError}</p>
            <Button size="sm" variant="secondary" onClick={() => setToggleError(null)}>
              Dismiss
            </Button>
          </div>
        )}
        {sortMode ? (
          <SortActivity
            list={list}
            classId={list.classId ?? null}
            onExit={() => {
              setSortMode(false)
            }}
          />
        ) : (
          <PatternChartDisplay
            list={list}
            onToggleLock={(patternId) => handleToggleLock(patternId, list)}
            classRules={classRules}
            showRules={showRules}
            showUnderlines={showUnderlines}
          />
        )}
      </main>
    </div>
  )
}

export default function DisplayMode() {
  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen flex-col bg-background"
          role="status"
          aria-label="Loading chart"
          aria-busy="true"
        >
          <div className="border-b-2 border-line bg-card" aria-hidden="true">
            <div className="flex items-center gap-2 px-4 py-3">
              <div className="h-9 w-20 animate-pulse rounded-xl bg-line/60" />
              <div className="h-7 w-48 animate-pulse rounded-lg bg-line/60" />
              <div className="ml-auto h-9 w-24 animate-pulse rounded-xl bg-line/60" />
            </div>
          </div>
          <div className="flex-1 px-4 py-6 sm:px-8" aria-hidden="true">
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-2xl border-2 border-line bg-card p-6">
                  <div className="h-8 w-2/3 animate-pulse rounded-lg bg-line/60" />
                  <div className="mt-2 h-5 w-1/2 animate-pulse rounded-lg bg-line/40" />
                  <div className="mt-4 space-y-2">
                    {[0, 1, 2, 3].map((j) => (
                      <div key={j} className="h-10 animate-pulse rounded-xl bg-line/40" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      }
    >
      <DisplayModeInner />
    </Suspense>
  )
}
