'use client'

import { useCallback, useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeftIcon, PrinterIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getList, getLists, updateList } from '@/lib/lists-api'
import type { WordList } from '@/models/WordList'
import PatternChartDisplay from './PatternChartDisplay'
import SortActivity from './SortActivity'
import WordListCard from './WordListCard'
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

  // Back to the app always goes home.
  const backToApp = useCallback(() => {
    router.push('/home')
  }, [router])

  // Back from the chart to the list picker.
  const backToPicker = useCallback(() => {
    router.push('/display')
  }, [router])

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
              {allLists.map((l) => (
                <WordListCard
                  key={l.id}
                  list={l}
                  href={`/display?list=${encodeURIComponent(l.id)}`}
                  primaryLabel="Present chart"
                  showPresent={false}
                  showPreview={false}
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
          <div className="ml-auto flex items-center gap-2">
            <Button variant="secondary" size="sm" asChild>
              <Link href={`/lists/${list.id}/print`}>
                <PrinterIcon className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline-block">Print chart</span>
              </Link>
            </Button>
            {!sortMode && (
              <Button size="sm" onClick={() => setSortMode(true)}>
                Sort words
              </Button>
            )}
          </div>
        </div>
      </div>
      <main className="flex-1 px-4 py-6 sm:px-8">
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
          <SortActivity list={list} onExit={() => setSortMode(false)} />
        ) : (
          <PatternChartDisplay list={list} onToggleLock={(patternId) => handleToggleLock(patternId, list)} />
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
