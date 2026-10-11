'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getList } from '@/lib/lists-api'
import type { WordList } from '@/models/WordList'
import PatternChartDisplay from './PatternChartDisplay'
import { reportError } from '@/lib/report-error'

type LoadState = 'loading' | 'ready' | 'not-found' | 'error'

function PrintSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-6xl px-4 py-8"
      role="status"
      aria-label="Loading print preview"
      aria-busy="true"
    >
      <div className="h-8 w-2/3 animate-pulse rounded-lg bg-line/60" aria-hidden="true" />
      <div className="mt-6 flex flex-col gap-6 lg:flex-row" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex-1 rounded-2xl border-2 border-line bg-card p-6">
            <div className="h-8 w-2/3 animate-pulse rounded-lg bg-line/60" />
            <div className="mt-4 space-y-2">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="h-10 animate-pulse rounded-xl bg-line/40" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Print view for one word list: renders the pattern chart as a
 * non-interactive poster and opens the print dialog once it loads.
 */
export default function PrintPage({ listId }: { listId: string }) {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [list, setList] = useState<WordList | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getList(listId)
        if (!cancelled) {
          setList(data)
          setLoadState('ready')
        }
      } catch (err) {
        reportError(err, { location: 'PrintPage.load' })
        if (!cancelled) {
          setLoadState(err instanceof Error && /not found/i.test(err.message) ? 'not-found' : 'error')
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [listId, retryCount])

  // Open the print dialog once the chart has rendered. Guarded so the
  // loading, not-found, and error states never trigger it.
  useEffect(() => {
    if (loadState === 'ready') {
      window.print()
    }
  }, [loadState])

  if (loadState === 'loading') {
    return <PrintSkeleton />
  }

  if (loadState === 'not-found') {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold">List not found</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">This word list does not exist or was deleted.</p>
        <Button asChild className="mt-6">
          <Link href="/lists">Back to my lists</Link>
        </Button>
      </div>
    )
  }

  if (loadState === 'error' || !list) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold">Could not load this list</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">Check your connection and try again.</p>
        <Button onClick={() => setRetryCount((c) => c + 1)} className="mt-6">
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="print-page mx-auto w-full max-w-6xl px-4 py-8">
      <PatternChartDisplay list={list} variant="print" />
    </div>
  )
}
