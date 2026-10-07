'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getList, getLists } from '@/lib/lists-api'
import type { WordList } from '@/models/WordList'
import PracticeMode from '@/components/PracticeMode'
import WordListCard from '@/components/WordListCard'

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
      <div className="min-h-screen bg-background" role="status" aria-label="Loading">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
          <div className="h-10 w-72 animate-pulse rounded-xl bg-line/60" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-48 animate-pulse rounded-[20px] border-2 border-line bg-card" />
            ))}
          </div>
          <p className="text-muted-foreground">Loading...</p>
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
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-8">
          <div>
            <Link href="/" className="text-[15px] font-semibold text-sky-ink hover:underline" aria-label="Back to home">
              <ChevronLeftIcon className="mr-1 inline size-4" aria-hidden="true" />
              Back
            </Link>
            <h1 className="mt-3 text-[30px] leading-tight font-bold">Choose a list to practice</h1>
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
                  onOpen={(opened) => router.push(`/practice?list=${encodeURIComponent(opened.id)}`)}
                  showPresent={false}
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
        <div className="min-h-screen bg-background" role="status" aria-label="Loading">
          <div className="mx-auto max-w-6xl px-4 py-8">
            <div className="h-10 w-72 animate-pulse rounded-xl bg-line/60" />
            <p className="mt-6 text-muted-foreground">Loading...</p>
          </div>
        </div>
      }
    >
      <PracticeInner />
    </Suspense>
  )
}
