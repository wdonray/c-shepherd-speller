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
import PresentingTipsBar, { PRESENTING_TIPS_LEAD, PRESENTING_TIPS_BODY } from './PresentingTipsBar'
import WhyChartPopover from './WhyChartPopover'
import { GhostText } from './ui/ghost-text'
import { reportError } from '@/lib/report-error'

const LOAD_ERROR = 'Could not load the word list. Check your connection and try again.'

/** Picker copy, shared with the picker skeleton's invisible-copy placeholders (issue #350). */
const PICKER_TITLE = 'Present a list'
const PICKER_INTRO = 'Choose a list to show its pattern chart on the big screen.'
const PICKER_DESCRIPTION =
  'One column per pattern, all words visible at once. Use the fullscreen button for the biggest readable chart, lock patterns you want to hold back, and try Sort words to turn the chart into a class sorting activity.'

/**
 * Picker skeleton (issue #350): geometrically identical to the loaded list
 * picker. The title and intro paragraphs use invisible-copy placeholders so
 * they wrap at exactly the same points as the real copy at every viewport
 * width; the cards mirror WordListCard as the picker configures it
 * (accent bar, title + badge row, count line, no pattern preview, empty
 * action row since the whole card is the link).
 *
 * Inherent approximations (unknowable while loading): the list count (three
 * cards shown), the week chips (always shown; the loaded picker shows them
 * only when a week is assigned) and their labels, and the card badges (one
 * shown; a list may have zero, one, or two).
 */
export function DisplayPickerSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background" role="status" aria-label="Loading lists" aria-busy="true">
      {/* Subheader: matches the loaded sticky picker subheader */}
      <div className="sticky top-0 z-10 border-b-2 border-line bg-card" aria-hidden="true">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-line/60 sm:w-20" />
          <p className="text-xl font-bold">
            <GhostText text={PICKER_TITLE} highlightClassName="bg-line/60" />
          </p>
        </div>
      </div>
      {/* Picker: matches the loaded max-w-6xl picker layout */}
      <div className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-4 py-8 sm:px-8" aria-hidden="true">
        <p className="text-[15px] text-muted-foreground">
          <GhostText text={PICKER_INTRO} highlightClassName="bg-line/40" />
        </p>
        <p className="mt-2 max-w-3xl text-[15px] text-muted-foreground">
          <GhostText text={PICKER_DESCRIPTION} highlightClassName="bg-line/40" />
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-9 w-24 animate-pulse rounded-2xl bg-line/60" />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="relative flex flex-col overflow-hidden rounded-[20px] border-2 border-line bg-card">
              <div className="h-2 w-full animate-pulse bg-line/60" />
              <div className="flex flex-1 flex-col gap-3 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="h-7 w-2/3 animate-pulse rounded-lg bg-line/60" />
                  <div className="h-6 w-20 animate-pulse rounded-full bg-line/40" />
                </div>
                <div className="h-5 w-40 animate-pulse rounded bg-line/40" />
                {/* Action row: empty in the picker (the whole card is the
                    link and the Present button is hidden), kept as a spacer
                    like the loaded card */}
                <div className="relative z-10 mt-auto pt-2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Chart skeleton (issue #350): geometrically identical to the loaded present
 * chart. Shared by the loading state and the Suspense fallback so both paths
 * show the same geometry.
 *
 * Every block mirrors the loaded header and PatternChartDisplay for the
 * common case (patterns with rules, words with speaker buttons):
 * - header: sticky like the loaded one, with a block for every control in
 *   the same order and responsive visibility (back link, flex-1 title, class
 *   pill, info popover trigger, rules/underline toggles, Print chart, Sort
 *   words, and the mobile overflow menu trigger). The fullscreen button is
 *   deliberately absent: it mounts a beat after the loaded header's first
 *   paint (support is detected in an effect), so the skeleton matches that
 *   first paint exactly.
 * - presenting-tips placeholder: always rendered. The real bar's SSR HTML
 *   includes it, and a fresh browser (the first-present case the tips exist
 *   for) shows it; a teacher who dismissed it sees a small collapse.
 * - chart: the PatternChartDisplay wrapper, the list-name title, and the
 *   capped, centered column grid with one block per pattern column.
 *
 * Inherent approximations (unknowable while loading): the pattern count
 * (three columns shown) and word count (four rows each), the keyword
 * emoji/image, the rule text (a rule block is shown; a pattern may have no
 * rule), the odd ducks section, and the class pill label (the loaded pill
 * flips from "No class" once the class loads).
 */
export function DisplayChartSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background" role="status" aria-label="Loading chart" aria-busy="true">
      {/* Header: matches the loaded sticky header */}
      <div className="sticky top-0 z-10 border-b-2 border-line bg-card" aria-hidden="true">
        <div className="flex items-center gap-2 px-4 py-3">
          <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-line/60 sm:w-20" />
          <div className="h-7 min-w-0 flex-1 animate-pulse rounded-lg bg-line/60" />
          <div className="hidden h-7 w-24 shrink-0 animate-pulse rounded-full bg-line/40 sm:block" />
          <div className="hidden size-11 shrink-0 animate-pulse rounded-xl bg-line/40 sm:block" />
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            <div className="size-9 animate-pulse rounded-full bg-line/40" />
            <div className="size-9 animate-pulse rounded-full bg-line/40" />
            <div className="h-9 w-28 animate-pulse rounded-2xl bg-line/60" />
          </div>
          <div className="h-9 w-24 shrink-0 animate-pulse rounded-2xl bg-line/60" />
          <div className="size-11 shrink-0 animate-pulse rounded-2xl bg-line/60 sm:hidden" />
        </div>
      </div>
      {/* Chart: matches the loaded main + PatternChartDisplay layout */}
      <div className="flex-1 px-4 py-6 sm:px-8" aria-hidden="true">
        {/* Presenting tips: matches the loaded one-time tips bar */}
        <div className="mx-auto mb-6 flex w-full max-w-3xl items-start gap-3 rounded-[20px] border-2 border-line bg-card p-4">
          <div className="mt-0.5 size-5 shrink-0 animate-pulse rounded-full bg-line/60" />
          <p className="flex-1 text-[15px] leading-6">
            <GhostText text={PRESENTING_TIPS_LEAD} highlightClassName="bg-line/60" className="font-bold" />{' '}
            <GhostText text={PRESENTING_TIPS_BODY} highlightClassName="bg-line/40" />
          </p>
          <div className="h-9 w-20 shrink-0 animate-pulse rounded-xl bg-line/60" />
        </div>
        <div className="force-light w-full rounded-[20px] bg-background p-6 sm:p-10">
          <div className="mb-8 text-center">
            <div className="mx-auto h-10 w-64 animate-pulse rounded-lg bg-line/60" />
          </div>
          <div className="mx-auto grid w-full max-w-[1400px] grid-cols-1 justify-center gap-6 sm:grid-cols-[repeat(2,minmax(0,420px))] lg:grid-cols-[repeat(3,minmax(0,420px))]">
            {[0, 1, 2].map((i) => (
              <div key={i} className="min-w-0 rounded-2xl border-[3px] border-line bg-card p-5">
                <div className="mb-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-8 w-28 animate-pulse rounded-lg bg-line/60" />
                    <div className="size-11 animate-pulse rounded-full bg-line/40" />
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <div className="flex items-center gap-1.5">
                      {[0, 1, 2].map((j) => (
                        <div key={j} className="h-2.5 w-6 animate-pulse rounded-full bg-line/60" />
                      ))}
                    </div>
                    <div className="h-5 w-20 animate-pulse rounded bg-line/40" />
                  </div>
                  <div className="mt-3 border-l-4 border-line bg-line/10 px-3 py-2 text-left">
                    <div className="h-4 w-24 animate-pulse rounded bg-line/60" />
                    <div className="mt-1.5 h-6 w-full animate-pulse rounded bg-line/40" />
                    <div className="mt-1.5 h-6 w-2/3 animate-pulse rounded bg-line/40" />
                  </div>
                </div>
                <div className="space-y-3">
                  {[0, 1, 2, 3].map((j) => (
                    <div
                      key={j}
                      className="flex min-h-[58px] items-center gap-1 rounded-[14px] border-2 border-line bg-card p-1.5"
                    >
                      <div className="h-11 flex-1 animate-pulse rounded-[10px] bg-line/40" />
                      <div className="size-11 shrink-0 animate-pulse rounded-[10px] bg-line/40" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
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
    return !listId ? <DisplayPickerSkeleton /> : <DisplayChartSkeleton />
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
    <Suspense fallback={<DisplayChartSkeleton />}>
      <DisplayModeInner />
    </Suspense>
  )
}
