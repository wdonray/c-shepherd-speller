'use client'

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, PrinterIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getListWithClassroom, getLists, updateList, invalidateListClassroomCache } from '@/lib/lists-api'
import { getPrebuiltWeek, prebuiltWeekToWordList } from '@/lib/prebuilt-lists'
import PrebuiltBadge from './PrebuiltBadge'
import { getAssignedWeeks, type WordList, type PatternVideo } from '@/models/WordList'
import PatternChartDisplay from './PatternChartDisplay'
import ChartActionsMenu from './ChartActionsMenu'
import FullscreenButton from './FullscreenButton'
import { useFullscreen } from '@/hooks/use-fullscreen'
import RulesVisibilityToggle from './RulesVisibilityToggle'
import WordUnderlineToggle from './WordUnderlineToggle'
import WordListCard from './WordListCard'
import PresentingTipsBar from './PresentingTipsBar'
import WhyChartPopover from './WhyChartPopover'
import BackBreadcrumb from './BackBreadcrumb'
import { reportError } from '@/lib/report-error'
import dynamic from 'next/dynamic'

/**
 * The sort game (issue #482): loaded on demand instead of in the /display
 * initial bundle. motion, @dnd-kit and canvas-confetti only parse when the
 * teacher taps "Sort words". The loading spinner follows the app's centered
 * spinner convention (skeleton geometry is unknowable while the chunk loads).
 */
const SortActivity = dynamic(() => import('./SortActivity'), {
  loading: () => (
    <div className="flex flex-1 items-center justify-center" role="status" aria-label="Loading sort activity">
      <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
    </div>
  ),
})

const LOAD_ERROR = 'Could not load the word list. Check your connection and try again.'

/** Picker copy, shared with the picker skeleton's invisible-copy placeholders (issue #350). */
const PICKER_TITLE = 'Present a list'
const PICKER_INTRO = 'Choose a list to show its pattern chart on the big screen.'
const PICKER_DESCRIPTION =
  'One column per pattern, all words visible at once. Use the fullscreen button for the biggest readable chart, lock patterns you want to hold back, and try Sort words to turn the chart into a class sorting activity.'

/**
 * Centered loading spinner for the present page (issue #366, per the rule
 * Donray set in #388): skeleton loaders are only for pages whose layout is
 * known while loading. The present page's layout is unknowable up front
 * (pattern count, words per pattern, rule text, keyword media,
 * class pill), and the skeleton placeholders could never match it, so a
 * centered spinner replaces both of them. Nothing is drawn that could shift
 * when the real content arrives.
 */
export function DisplayLoadingSpinner({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-screen items-center justify-center bg-background"
      role="status"
      aria-label={label}
      aria-busy="true"
    >
      <Loader2 className="size-8 animate-spin text-muted-foreground" aria-hidden="true" />
    </div>
  )
}

/**
 * Display mode: pattern chart for the selected list, sized for projectors
 * and smartboards. Reads ?list=<id> from the URL; if absent, shows a list
 * picker.
 */
function DisplayModeInner() {
  const searchParams = useSearchParams()
  const listId = searchParams.get('list')
  // A prebuilt week presents directly from the bundled curriculum data
  // (issue #463): no API fetch, no classroom, read-only chart.
  const prebuiltId = searchParams.get('prebuilt')
  const isPrebuilt = prebuiltId !== null

  const [list, setList] = useState<WordList | null>(null)
  const [allLists, setAllLists] = useState<WordList[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [sortMode, setSortMode] = useState(false)
  // Full screen hides the chart header below (issue #380); Escape exits
  // full screen via the hook since the exit button hides with the header.
  const { isFullscreen } = useFullscreen()
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

  // Save a pattern's attached song videos in present mode (issue #401):
  // optimistic update, then persist, mirroring the lock toggle above. An
  // emptied video list drops the field so legacy reads stay clean. Rethrows
  // after the revert so the video modal can show its own save error; the
  // present chart handles the rejection.
  const handleSaveVideos = useCallback(async (patternId: string, videos: PatternVideo[], current: WordList) => {
    const nextPatterns = current.patterns.map((p) =>
      p.id === patternId ? { ...p, videos: videos.length > 0 ? videos : undefined } : p
    )
    setList({ ...current, patterns: nextPatterns })
    setToggleError(null)
    try {
      const saved = await updateList(current.id, { patterns: nextPatterns })
      setList(saved)
    } catch {
      setList(current)
      setToggleError(LOAD_ERROR)
      throw new Error('Failed to save pattern videos')
    }
  }, [])

  // The list's classroom rules by pattern text, for the present chart.
  // Rules are edited on the list page (issue #263) and, since issue #372,
  // also in place on the present chart behind the callout's pencil icon.
  // Null when the list has no classroom. Both arrive with the list itself
  // (issue #388): a second fetch after the chart rendered shifted the
  // header pill and the rule callouts when it landed, so the classroom is
  // joined server-side into the single loading state.
  const [classRules, setClassRules] = useState<Record<string, string> | null>(null)
  const [className, setClassName] = useState<string | null>(null)
  // Rule display visibility on the chart (issue #310). Default shown.
  const [showRules, setShowRules] = useState(true)
  // Word underline visibility on the chart (issue #264). Default hidden:
  // underlines stay off when the Present chart loads until the teacher
  // turns them on.
  const [showUnderlines, setShowUnderlines] = useState(false)

  /**
   * Save one spelling rule from the present chart's callout editor
   * (issue #372). Mirrors the list page's save (issue #313/#307): with a
   * classroom, the rule is saved to the classroom (shared across its
   * lists); otherwise it is saved unscoped on the pattern itself. Clearing
   * a classroom rule deletes it via DELETE: an empty rule fails the rules
   * API validation, so it cannot go through PUT. Rejects on failure so the
   * editor keeps the draft and shows the error.
   */
  const handleSaveRule = useCallback(
    async (patternId: string, patternText: string, rule: string, current: WordList): Promise<void> => {
      if (current.classId) {
        if (rule === '') {
          const res = await fetch(`/api/classes/${encodeURIComponent(current.classId)}/rules`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ patternText }),
          })
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          invalidateListClassroomCache(current.id)
          setClassRules((prev) => {
            const next = { ...(prev ?? {}) }
            delete next[patternText]
            return next
          })
          return
        }
        const res = await fetch(`/api/classes/${encodeURIComponent(current.classId)}/rules`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rules: { [patternText]: { rule } } }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        invalidateListClassroomCache(current.id)
        setClassRules((prev) => ({ ...(prev ?? {}), [patternText]: rule }))
      } else {
        const nextPatterns = current.patterns.map((p) => (p.id === patternId ? { ...p, rule: rule || undefined } : p))
        const saved = await updateList(current.id, { patterns: nextPatterns })
        setList(saved)
      }
    },
    []
  )

  // Escape never navigates. When the browser is in full screen, Escape exits
  // full screen natively; the app takes no action on Escape at all.

  useEffect(() => {
    setLoading(true)
    setLoadError(null)

    const load = async () => {
      try {
        if (prebuiltId) {
          const week = getPrebuiltWeek(prebuiltId)
          if (!week) throw new Error(`Unknown ready-made week: ${prebuiltId}`)
          setList(prebuiltWeekToWordList(week))
        } else if (listId) {
          const { list: data, classroom } = await getListWithClassroom(listId)
          setList(data)
          setClassName(classroom?.name ?? null)
          setClassRules(classroom ? classroom.rules : null)
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
  }, [listId, prebuiltId])

  if (loading) {
    // The present page's layout is unknowable while loading (issue #366):
    // a centered spinner, never a skeleton that pretends to know it.
    return <DisplayLoadingSpinner label={!listId && !prebuiltId ? 'Loading lists' : 'Loading chart'} />
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
  if ((!listId && !prebuiltId) || !list) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="sticky top-0 z-10 border-b-2 border-line bg-card">
          <div className="flex items-center gap-2 px-4 py-3">
            <BackBreadcrumb href="/home" label="Home" />
            <h1 className="text-xl font-bold text-ink">{PICKER_TITLE}</h1>
          </div>
        </div>
        <div className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8 sm:px-8">
          <p className="text-[15px] text-muted-foreground">{PICKER_INTRO}</p>
          <p className="mt-2 max-w-3xl text-[15px] text-muted-foreground">{PICKER_DESCRIPTION}</p>
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
  // In full screen (issue #380) the chart header is hidden too, so the
  // chart gets the whole screen for the projector; Escape is the way out.
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!sortMode && !isFullscreen && (
        <div className="sticky top-0 z-10 border-b-2 border-line bg-card">
          <div className="flex items-center gap-2 px-4 py-3">
            {/* Back breadcrumb (issue #378): names the destination instead of
                the ambiguous "Lists" label, so the teacher always knows the
                click returns to the list picker. */}
            <BackBreadcrumb href="/display" label="Present a list" />
            <h1 className="min-w-0 flex-1 truncate text-xl font-bold text-ink">{list.name}</h1>
            {isPrebuilt && <PrebuiltBadge />}
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
              {/* No print route exists for prebuilt weeks (issue #463). */}
              {!isPrebuilt && (
                <Button variant="secondary" size="sm" asChild>
                  <Link href={`/lists/${list.id}/print`}>
                    <PrinterIcon className="size-4" aria-hidden="true" />
                    Print chart
                  </Link>
                </Button>
              )}
            </div>
            <Button size="sm" onClick={() => setSortMode(true)} className="shrink-0">
              Sort words
            </Button>
            <div className="hidden shrink-0 sm:block">
              <FullscreenButton />
            </div>
            {/* ChartActionsMenu carries a print link with no prebuilt target. */}
            {!isPrebuilt && (
              <div className="shrink-0 sm:hidden">
                <ChartActionsMenu
                  listId={list.id}
                  showRules={showRules}
                  onToggleRules={() => setShowRules((v) => !v)}
                  showUnderlines={showUnderlines}
                  onToggleUnderlines={() => setShowUnderlines((v) => !v)}
                />
              </div>
            )}
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
            // Prebuilt weeks are read-only: no lock toggles, rule edits, or
            // video saves (issue #463). The callbacks stay undefined, exactly
            // like the library preview.
            onToggleLock={isPrebuilt ? undefined : (patternId) => handleToggleLock(patternId, list)}
            classRules={classRules}
            onSaveRule={
              isPrebuilt
                ? undefined
                : (patternId, patternText, rule) => handleSaveRule(patternId, patternText, rule, list)
            }
            onSaveVideos={isPrebuilt ? undefined : (patternId, videos) => handleSaveVideos(patternId, videos, list)}
            className={className}
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
    <Suspense fallback={<DisplayLoadingSpinner label="Loading chart" />}>
      <DisplayModeInner />
    </Suspense>
  )
}
