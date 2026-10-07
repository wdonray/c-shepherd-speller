'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getList, getLists } from '@/lib/lists-api'
import type { WordList } from '@/models/WordList'
import PatternChartDisplay from './PatternChartDisplay'
import SortActivity from './SortActivity'
import WordListCard from './WordListCard'

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
  const [loading, setLoading] = useState(true)
  const [sortMode, setSortMode] = useState(false)

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
      } catch {
        setLoadError(LOAD_ERROR)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [listId])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" role="status">
        <div className="w-full max-w-6xl space-y-4 px-4">
          <div className="h-10 w-2/3 animate-pulse rounded-[20px] bg-line" />
          <div className="flex flex-col gap-6 lg:flex-row" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-64 flex-1 animate-pulse rounded-2xl bg-line" />
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
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    )
  }

  // No list selected: show the picker.
  if (!listId || !list) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-6xl space-y-8 px-4 py-8 sm:px-8">
        <div className="space-y-2">
          <h1 className="text-[32px] font-bold text-ink">Present a list</h1>
          <p className="text-[15px] text-muted-foreground">
            Choose a list to show its pattern chart on the big screen.
          </p>
        </div>
        {allLists.length === 0 ? (
          <div className="rounded-[20px] border-2 border-line bg-card p-12 text-center">
            <p className="text-xl font-bold text-ink">No word lists yet</p>
            <p className="mt-2 text-[15px] text-muted-foreground">Create one from My Spelling Lists first.</p>
            <Button className="mt-6" asChild>
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allLists.map((l, i) => (
              <WordListCard
                key={l.id}
                list={l}
                index={i}
                onOpen={(selected) => router.push(`/display?list=${encodeURIComponent(selected.id)}`)}
                primaryLabel="Present chart"
                showPresent={false}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Show the pattern chart.
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="sticky top-0 z-10 border-b-2 border-line bg-card">
        <div className="flex items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/display" aria-label="Choose a different list">
              <ChevronLeftIcon className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline-block">Lists</span>
            </Link>
          </Button>
          <h1 className="text-xl font-bold text-ink">{list.name}</h1>
          <div className="ml-auto">
            {!sortMode && (
              <Button size="sm" onClick={() => setSortMode(true)}>
                Sort words
              </Button>
            )}
          </div>
        </div>
      </div>
      <main className="flex-1 px-4 py-6 sm:px-8">
        {sortMode ? (
          <SortActivity list={list} onExit={() => setSortMode(false)} />
        ) : (
          <PatternChartDisplay list={list} />
        )}
      </main>
    </div>
  )
}

export default function DisplayMode() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center" role="status">
          <div className="w-full max-w-6xl space-y-4 px-4">
            <div className="h-10 w-2/3 animate-pulse rounded-[20px] bg-line" />
            <div className="flex flex-col gap-6 lg:flex-row" aria-hidden="true">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-64 flex-1 animate-pulse rounded-2xl bg-line" />
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
