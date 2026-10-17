'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getLists, LISTS_CHANGED_EVENT } from '@/lib/lists-api'
import { HttpError } from '@/lib/error-toast'
import { getActivity, greetingForHour, timeAgo, type ActivityEvent } from '@/lib/activity'
import type { WordList } from '@/models/WordList'
import WordListCard from './WordListCard'
import { PatternMark } from './PatternMark'
import { GhostText } from './ui/ghost-text'
import { reportError } from '@/lib/report-error'

interface DashboardProps {
  onNewList: () => void
  onEditList: (list: WordList) => void
}

const GETTING_STARTED_STEPS = [
  {
    title: 'Create a list',
    text: 'Pick one target sound, like long a, and name the list for your week.',
  },
  {
    title: 'Add patterns',
    text: 'Add one column per spelling. Size each column by how common the spelling is.',
  },
  {
    title: 'Present and practice',
    text: 'Project the pattern chart for the class, then run practice mode with the review queue.',
  },
]

/**
 * Intro paragraph for the getting-started guide. Shared with the skeleton
 * below so the skeleton's line-highlight placeholder wraps at exactly the
 * same points as the real copy at every viewport width (issue #349).
 */
const GETTING_STARTED_INTRO =
  'One pattern learned is dozens of words spelled. When students see words grouped by a shared spelling pattern, they learn the rule behind the words and can spell new words they have never seen. PatternSpell works with the program you already teach: CKLA, Fundations, UFLI, Words Their Way, or your own sequence.'

const ACTIVITY_META: Record<ActivityEvent['kind'], { label: string; chipClasses: string }> = {
  practiced: { label: 'Practiced', chipClasses: 'bg-leaf-soft text-leaf-ink' },
  presented: { label: 'Presented', chipClasses: 'bg-sky-soft text-sky-ink' },
  created: { label: 'Created', chipClasses: 'bg-plum-soft text-plum-ink' },
  edited: { label: 'Edited', chipClasses: 'bg-sun-soft text-sun-ink' },
  deleted: { label: 'Deleted', chipClasses: 'bg-coral-soft text-coral-ink' },
}

function GettingStarted() {
  return (
    <section aria-label="Getting started guide" className="space-y-4">
      <h2 className="text-2xl font-bold">Getting started with pattern-based spelling</h2>
      <p className="max-w-3xl text-muted-foreground">{GETTING_STARTED_INTRO}</p>
      <ol className="grid gap-4 md:grid-cols-3">
        {GETTING_STARTED_STEPS.map((step, i) => (
          <li key={step.title}>
            <Card className="h-full p-6">
              <span
                aria-hidden="true"
                className="mb-4 flex size-10 items-center justify-center rounded-full bg-sun text-xl font-extrabold text-chunk-sun-ink"
              >
                {i + 1}
              </span>
              <h3 className="mb-2 text-lg font-bold">{step.title}</h3>
              <p className="text-sm text-muted-foreground">{step.text}</p>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  )
}

function RecentActivity({ events }: { events: ActivityEvent[] }) {
  if (events.length === 0) return null
  return (
    <section aria-label="Recent activity" className="space-y-4">
      <h2 className="text-2xl font-bold">Recent activity</h2>
      <ul className="space-y-2">
        {events.slice(0, 5).map((event) => {
          const meta = ACTIVITY_META[event.kind]
          return (
            <li key={event.id}>
              <Card className="flex flex-row items-center gap-4 p-4">
                <span className={`shrink-0 rounded-full px-3 py-1 text-[13px] font-bold ${meta.chipClasses}`}>
                  {meta.label}
                </span>
                <p>
                  {event.listId ? (
                    <Link
                      href={`/lists/${encodeURIComponent(event.listId)}`}
                      className="font-medium text-sky-deep underline underline-offset-4"
                    >
                      {event.text}
                    </Link>
                  ) : (
                    event.text
                  )}
                  , <span className="text-muted-foreground">{timeAgo(event.at)}</span>
                </p>
              </Card>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/**
 * Teacher dashboard: greeting, quick actions, lists, getting started guide,
 * and recent activity.
 *
 * The lists section previews the teacher's three most recently used lists.
 * Recency comes from the activity log (practiced, presented, created,
 * edited) when an event exists for the list, falling back to the list's
 * own updatedAt. The activity log is local-only and capped, so older or
 * cross-device work still ranks by updatedAt.
 */
function lastActivityAt(list: WordList, events: ActivityEvent[]): number {
  let latest = Date.parse(list.updatedAt)
  for (const event of events) {
    if (event.listId === list.id && event.at > latest) latest = event.at
  }
  return latest
}

/**
 * Shared dashboard skeleton (issues #341, #349). Used by Dashboard itself
 * and by the /home page-level loading state so both skeletons are
 * geometrically identical to each other and to the loaded layout.
 *
 * Every block mirrors the loaded component's exact box geometry for the
 * common case (a teacher with 1-3 lists, each with 1-4 patterns):
 * - header: greeting (text-3xl) + quick actions (size="lg" buttons, h-14)
 * - lists header: h2 (text-2xl) + "View all lists" button (default size, h-11)
 * - list cards: the real Card with the accent bar (h-2), title + badge row,
 *   count line, pattern-preview grid (same columns, tile padding, gaps, and
 *   3-segment power-bar placeholders as WordListCard), and the two action
 *   buttons (size="sm", h-9). The preview shows 2 tiles: at every width that
 *   is exactly one row for lists with 1-2 patterns (the seeded e2e shape);
 *   lists with 3-4 patterns wrap to a second row on narrow screens, which a
 *   skeleton cannot know in advance.
 * - getting started: GhostText placeholders carry the real copy, so the h2,
 *   intro paragraph, and step cards wrap exactly like the loaded text at
 *   every viewport width
 *
 * Inherent approximations (unknowable while loading): the exact list count,
 * badge wrapping on long titles, the "+N more" line past 4 patterns, and the
 * "showing three most recently used" subline past 3 lists.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-10" role="status" aria-label="Loading dashboard" aria-busy="true">
      {/* Header: matches the loaded greeting + quick action row */}
      <div className="flex flex-wrap items-center justify-between gap-3" aria-hidden="true">
        <div className="h-9 w-64 animate-pulse rounded-xl bg-line/60" />
        <div className="flex flex-wrap gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 w-32 animate-pulse rounded-2xl bg-line/60" />
          ))}
        </div>
      </div>
      {/* My word lists: matches the loaded section (header row + card grid) */}
      <div className="space-y-4" aria-hidden="true">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="h-8 w-48 animate-pulse rounded-xl bg-line/60" />
          <div className="h-11 w-32 animate-pulse rounded-2xl bg-line/60" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="relative overflow-hidden">
              {/* accent bar */}
              <div className="h-2 w-full animate-pulse bg-line/60" />
              <div className="flex flex-1 flex-col gap-3 p-6">
                {/* title + week badge row */}
                <div className="flex flex-wrap items-center gap-2">
                  <div className="h-7 w-2/3 animate-pulse rounded-lg bg-line/60" />
                  <div className="h-6 w-20 animate-pulse rounded-full bg-line/40" />
                </div>
                {/* pattern/word count line */}
                <div className="h-5 w-1/3 animate-pulse rounded-lg bg-line/60" />
                {/* pattern preview: same grid, tile padding, gaps, and power-bar segments as WordListCard */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {[0, 1].map((j) => (
                    <div key={j} className="flex flex-col gap-1.5 rounded-xl bg-line/20 px-3 py-2">
                      <div className="h-5 w-3/4 animate-pulse rounded bg-line/40" />
                      <div className="flex gap-1.5">
                        {[0, 1, 2].map((k) => (
                          <div key={k} className="h-2.5 w-6 animate-pulse rounded-full bg-line/40" />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {/* action buttons: "Edit list" + "Present" (size="sm") */}
                <div className="mt-auto flex flex-wrap gap-2 pt-2">
                  <div className="h-9 w-24 animate-pulse rounded-2xl bg-line/60" />
                  <div className="h-9 w-24 animate-pulse rounded-2xl bg-line/40" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
      {/* Getting started: matches the loaded section (h2 + intro + 3 cards) */}
      <div className="space-y-4" aria-hidden="true">
        <h2 className="text-2xl font-bold">
          <GhostText text="Getting started with pattern-based spelling" highlightClassName="bg-line/60" />
        </h2>
        <p className="max-w-3xl">
          <GhostText text={GETTING_STARTED_INTRO} highlightClassName="bg-line/40" />
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {GETTING_STARTED_STEPS.map((step) => (
            <Card key={step.title} className="p-6">
              <div className="mb-4 size-10 animate-pulse rounded-full bg-line/60" />
              <h3 className="mb-2 text-lg font-bold">
                <GhostText text={step.title} highlightClassName="bg-line/60" />
              </h3>
              <p className="text-sm">
                <GhostText text={step.text} highlightClassName="bg-line/40" />
              </p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function Dashboard({ onNewList, onEditList }: DashboardProps) {
  const { data: session, status } = useSession()
  const [lists, setLists] = useState<WordList[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [activity, setActivity] = useState<ActivityEvent[]>([])

  const loadLists = useCallback(() => {
    // Lists belong to a signed-in teacher. A signed-out visitor gets a 401
    // from /api/lists, which means "not signed in", not an application
    // error: never fetch, never report to Sentry, never show the error card.
    if (status !== 'authenticated') {
      setLists([])
      setLoadError(false)
      if (status !== 'loading') setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(false)
    getLists()
      .then(setLists)
      .catch((error: unknown) => {
        if (error instanceof HttpError && error.status === 401) {
          // Session expired between page load and fetch: signed out, not an error.
          setLists([])
          setLoadError(false)
          return
        }
        reportError(error, { location: 'Dashboard.loadLists' })
        setLoadError(true)
      })
      .finally(() => setLoading(false))
  }, [status])

  useEffect(() => {
    loadLists()
    setActivity(getActivity())
    const reload = () => {
      loadLists()
      setActivity(getActivity())
    }
    window.addEventListener(LISTS_CHANGED_EVENT, reload)
    return () => window.removeEventListener(LISTS_CHANGED_EVENT, reload)
  }, [loadLists])

  const firstName = session?.user?.name?.trim().split(/\s+/)[0]
  const greeting = `${greetingForHour(new Date().getHours())}${firstName ? `, ${firstName}` : ''}`

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      {loading ? (
        <DashboardSkeleton />
      ) : loadError ? (
        <Card className="mx-auto max-w-xl border-coral bg-coral-soft p-8 text-center" role="alert">
          <h2 className="mb-2 text-2xl font-bold text-coral-ink">Could not load your lists</h2>
          <p className="mb-6">Check your connection and try again. Your lists are safe.</p>
          <Button variant="destructive" onClick={loadLists} className="self-center">
            Try again
          </Button>
        </Card>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-3xl font-bold">{greeting}</h1>
            <section aria-label="Quick actions" className="flex flex-wrap gap-3">
              <Button size="lg" onClick={onNewList}>
                New list
              </Button>
              <Button size="lg" variant="sunny" asChild>
                <Link href="/practice">Practice</Link>
              </Button>
              <Button size="lg" variant="secondary" asChild>
                <Link href="/display">Present</Link>
              </Button>
            </section>
          </div>

          <section aria-label="My word lists" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold">My word lists ({lists.length})</h2>
                {lists.length > 3 && (
                  <p className="text-sm text-muted-foreground">Showing your three most recently used lists.</p>
                )}
              </div>
              {lists.length > 0 && (
                <Button variant="secondary" asChild>
                  <Link href="/lists">{lists.length > 3 ? `View all ${lists.length} lists` : 'View all lists'}</Link>
                </Button>
              )}
            </div>
            {lists.length === 0 ? (
              <div className="space-y-6">
                <Button size="lg" onClick={onNewList}>
                  Create your first list
                </Button>
                <Card className="mx-auto max-w-3xl p-8 text-center">
                  <PatternMark label="PatternSpell logo" className="mx-auto mb-6 size-28" />
                  <h3 className="mb-2 text-2xl font-bold">No word lists yet</h3>
                  <p className="mx-auto mb-6 max-w-xl text-muted-foreground">
                    Group words by the spelling pattern for a target sound. For the long a sound you might create
                    patterns for a_e (cake, bake), ai (rain, pain), and ay (day, play). Mark irregular spellings as odd
                    ducks.
                  </p>
                  <Button size="lg" onClick={onNewList} className="self-center">
                    Create your first list
                  </Button>
                </Card>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[...lists]
                  .sort((a, b) => lastActivityAt(b, activity) - lastActivityAt(a, activity))
                  .slice(0, 3)
                  .map((list) => (
                    <WordListCard key={list.id} list={list} onOpen={onEditList} primaryLabel="Edit list" />
                  ))}
              </div>
            )}
          </section>

          <GettingStarted />
          <RecentActivity events={activity} />
        </>
      )}
    </div>
  )
}
