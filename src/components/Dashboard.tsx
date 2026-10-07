'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getLists, LISTS_CHANGED_EVENT } from '@/lib/lists-api'
import { getActivity, greetingForHour, timeAgo, type ActivityEvent } from '@/lib/activity'
import type { WordList } from '@/models/WordList'
import WordListCard from './WordListCard'
import { PatternMark } from './PatternMark'

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

const ACTIVITY_DOTS: Record<ActivityEvent['kind'], string> = {
  practiced: 'bg-leaf',
  presented: 'bg-sky',
  created: 'bg-plum',
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
        {events.slice(0, 5).map((event) => (
          <li key={event.id}>
            <Card className="flex flex-row items-center gap-4 p-4">
              <span aria-hidden="true" className={`size-6 shrink-0 rounded-full ${ACTIVITY_DOTS[event.kind]}`} />
              <p>
                {event.text}, <span className="text-muted-foreground">{timeAgo(event.at)}</span>
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * Teacher dashboard: greeting, quick actions, lists, getting started guide,
 * and recent activity.
 */
export default function Dashboard({ onNewList, onEditList }: DashboardProps) {
  const { data: session } = useSession()
  const [lists, setLists] = useState<WordList[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [activity, setActivity] = useState<ActivityEvent[]>([])

  const loadLists = useCallback(() => {
    setLoading(true)
    setLoadError(false)
    getLists()
      .then(setLists)
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false))
  }, [])

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
        <div className="space-y-10" role="status">
          <div className="flex flex-wrap gap-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 w-32 animate-pulse rounded-2xl bg-line/60" />
            ))}
          </div>
          <div className="space-y-4" aria-hidden="true">
            <div className="h-8 w-48 animate-pulse rounded-xl bg-line/60" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-48 animate-pulse rounded-[20px] bg-line/60" />
              ))}
            </div>
          </div>
          <div className="space-y-4" aria-hidden="true">
            <div className="h-8 w-72 animate-pulse rounded-xl bg-line/60" />
            <div className="grid gap-4 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-44 animate-pulse rounded-[20px] bg-line/60" />
              ))}
            </div>
          </div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
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
            <h2 className="text-2xl font-bold">My word lists ({lists.length})</h2>
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
                {lists.map((list, i) => (
                  <WordListCard key={list.id} list={list} index={i} onOpen={onEditList} />
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
