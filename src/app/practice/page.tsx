'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import BackLink from '@/components/BackLink'
import { Button } from '@/components/ui/button'
import { getList, getLists } from '@/lib/lists-api'
import type { WordList } from '@/models/WordList'
import PracticeMode from '@/components/PracticeMode'
import WordListCard from '@/components/WordListCard'
import { reportError } from '@/lib/report-error'

const LOAD_ERROR = 'Could not load the word list. Check your connection and try again.'

/**
 * Practice mode page: select a list, then practice spelling with TTS.
 * Reads ?list=<id> from the URL; if absent, shows a list picker.
 */
function PracticeInner() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const listId = searchParams.get('list')

  const [list, setList] = useState<WordList | null>(null)
  const [allLists, setAllLists] = useState<WordList[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

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
        reportError(error, { location: 'PracticePage.load' })
        setLoadError(LOAD_ERROR)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [listId])

  if (loading) {
    return (
      <div className="min-h-screen bg-background" role="status" aria-label="Loading practice" aria-busy="true">
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
          {/* Header: matches loaded (back link + h1 + description) */}
          <div aria-hidden="true">
            <div className="h-5 w-16 animate-pulse rounded-lg bg-line/60" />
            <div className="mt-3 h-10 w-72 animate-pulse rounded-xl bg-line/60" />
            <div className="mt-1 h-5 w-96 max-w-full animate-pulse rounded-lg bg-line/40" />
          </div>
          {/* List cards: match WordListCard structure */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="overflow-hidden rounded-[20px] border-2 border-line bg-card">
                <div className="h-2 w-full animate-pulse bg-line/60" />
                <div className="flex flex-col gap-3 p-6">
                  <div className="h-7 w-3/4 animate-pulse rounded-lg bg-line/60" />
                  <div className="h-5 w-1/2 animate-pulse rounded-lg bg-line/40" />
                  <div className="h-20 animate-pulse rounded-xl bg-line/40" />
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
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-xl px-4 py-16">
          <div className="rounded-[20px] border-2 border-line bg-card p-10 text-center">
            <p className="text-xl font-bold">Could not load the word list</p>
            <p className="mt-2 text-[15px] text-muted-foreground" role="alert">
              {loadError}
            </p>
            <Button asChild className="mt-6">
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!listId || !list) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-6">
          <div>
            <BackLink href="/" aria-label="Back to home">
              Back
            </BackLink>
            <h1 className="mt-2 text-[30px] leading-tight font-bold">Choose a list to practice</h1>
            <p className="mt-1 text-[15px] text-muted-foreground">
              Pick a spelling list, listen to each word, and type the spelling.
            </p>
          </div>
          {allLists.length === 0 ? (
            <div className="rounded-[20px] border-2 border-line bg-card px-6 py-14 text-center">
              <h2 className="text-2xl font-bold">No word lists yet</h2>
              <p className="mx-auto mt-2 max-w-md text-[15px] text-muted-foreground">
                Create one from My Spelling Lists first, then come back to practice.
              </p>
              <Button asChild className="mt-6">
                <Link href="/lists/new">New list</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {allLists.map((l, i) => (
                <WordListCard
                  key={l.id}
                  list={l}
                  index={i}
                  href={`/practice?list=${encodeURIComponent(l.id)}`}
                  primaryLabel="Start practice"
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

  return (
    <div className="min-h-screen bg-background">
      <PracticeMode list={list} onExit={() => router.push('/practice')} />
    </div>
  )
}

export default function PracticePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background" role="status" aria-label="Loading practice" aria-busy="true">
          <div className="mx-auto max-w-6xl space-y-8 px-4 py-8" aria-hidden="true">
            <div>
              <div className="h-5 w-16 animate-pulse rounded-lg bg-line/60" />
              <div className="mt-3 h-10 w-72 animate-pulse rounded-xl bg-line/60" />
              <div className="mt-1 h-5 w-96 max-w-full animate-pulse rounded-lg bg-line/40" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="overflow-hidden rounded-[20px] border-2 border-line bg-card">
                  <div className="h-2 w-full animate-pulse bg-line/60" />
                  <div className="flex flex-col gap-3 p-6">
                    <div className="h-7 w-3/4 animate-pulse rounded-lg bg-line/60" />
                    <div className="h-5 w-1/2 animate-pulse rounded-lg bg-line/40" />
                    <div className="h-20 animate-pulse rounded-xl bg-line/40" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      }
    >
      <PracticeInner />
    </Suspense>
  )
}
