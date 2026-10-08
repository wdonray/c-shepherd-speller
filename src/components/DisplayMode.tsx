'use client'

import { useCallback, useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getList, getLists } from '@/lib/lists-api'
import { LISTS_CACHE_KEY, listCacheKey, useCachedData } from '@/lib/data-cache'
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

  // Cached data renders instantly on revisit; the loading state only shows
  // on a cold load while a background revalidation keeps data fresh.
  const cacheKey = listId ? listCacheKey(listId) : LISTS_CACHE_KEY
  const {
    data: cached,
    loading,
    error: loadFailed,
  } = useCachedData<WordList | WordList[]>(cacheKey, () => (listId ? getList(listId) : getLists()))
  const list = listId ? ((cached as WordList | undefined) ?? null) : null
  const allLists = listId ? [] : ((cached as WordList[] | undefined) ?? [])
  const loadError = loadFailed ? LOAD_ERROR : null
  const [sortMode, setSortMode] = useState(false)

  // Back to the app, preferring real history when there is any.
  const backToApp = useCallback(() => {
    if (window.history.length > 1) {
      router.back()
    } else {
      router.push('/')
    }
  }, [router])

  // Back from the chart to the list picker.
  const backToPicker = useCallback(() => {
    router.push('/display')
  }, [router])

  // Escape exits the presentation: chart to picker, picker to the app.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (listId && list) {
        backToPicker()
      } else {
        backToApp()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [listId, list, backToApp, backToPicker])

  if (loading) {
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
          <div className="flex flex-col gap-6 lg:flex-row">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex-1 rounded-2xl border-2 border-line bg-card p-6">
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
          <Link href="/">Back to home</Link>
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
            <div className="flex flex-col gap-6 lg:flex-row">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex-1 rounded-2xl border-2 border-line bg-card p-6">
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
