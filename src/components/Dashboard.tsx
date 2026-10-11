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

const ACTIVITY_META: Record<ActivityEvent['kind'], { label: string; chipClasses: string }> = {
  practiced: { label: 'Practiced', chipClasses: 'bg-leaf-soft text-leaf-ink' },
  presented: { label: 'Presented', chipClasses: 'bg-sky-soft text-sky-ink' },
  created: { label: 'Created', chipClasses: 'bg-plum-soft text-plum-ink' },
}

function GettingStarted() {
  return (
    <section aria-label="Getting started guide" className="space-y-4">
      <h2 className="text-2xl font-bold">Getting started with pattern-based spelling</h2>
      <p className="max-w-3xl text-muted-foreground">
        Instead of memorizing flat word lists, group words by the spelling pattern for a target sound. Research shows
        this helps students learn the pattern, not just the words.
      </p>
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
                  {event.text}, <span className="text-muted-foreground">{timeAgo(event.at)}</span>
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
 */
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
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">{greeting}</h1>
        {!loading && !loadError && (
          <p className="text-muted-foreground">Here is your spelling toolkit for this week.</p>
        )}
      </div>

      {loading ? (
        <div className="space-y-10" role="status" aria-label="Loading dashboard" aria-busy="true">
          {/* Quick actions: matches the loaded button row (3x size="lg" buttons) */}
          <div className="flex flex-wrap gap-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-11 w-32 animate-pulse rounded-2xl bg-line/60" />
            ))}
          </div>
          {/* My word lists: matches the loaded section (h2 + card grid) */}
          <div className="space-y-4" aria-hidden="true">
            <div className="h-8 w-48 animate-pulse rounded-xl bg-line/60" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-[20px] border-2 border-line bg-card p-6">
                  <div className="h-7 w-3/4 animate-pulse rounded-lg bg-line/60" />
                  <div className="mt-3 h-5 w-1/2 animate-pulse rounded-lg bg-line/60" />
                  <div className="mt-4 h-20 animate-pulse rounded-xl bg-line/40" />
                </div>
              ))}
            </div>
          </div>
          {/* Getting started: matches the loaded section (h2 + text + 3 cards) */}
          <div className="space-y-4" aria-hidden="true">
            <div className="h-8 w-72 animate-pulse rounded-xl bg-line/60" />
            <div className="h-5 w-full max-w-3xl animate-pulse rounded-lg bg-line/60" />
            <div className="grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="rounded-[20px] border-2 border-line bg-card p-6">
                  <div className="mb-4 size-10 animate-pulse rounded-full bg-line/60" />
                  <div className="mb-2 h-6 w-2/3 animate-pulse rounded-lg bg-line/60" />
                  <div className="h-4 w-full animate-pulse rounded-lg bg-line/40" />
                  <div className="mt-2 h-4 w-5/6 animate-pulse rounded-lg bg-line/40" />
                </div>
              ))}
            </div>
          </div>
        </div>
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

          <section aria-label="My word lists" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold">My word lists ({lists.length})</h2>
              {lists.length > 0 && (
                <Button variant="secondary" asChild>
                  <Link href="/lists">View all lists</Link>
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
                  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
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
