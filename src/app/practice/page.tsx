'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getList, getLists } from '@/lib/lists-api'
import type { WordList } from '@/models/WordList'
import PracticeMode from '@/components/PracticeMode'

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
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    const load = async () => {
      try {
        if (listId) {
          const data = await getList(listId)
          if (!cancelled) setList(data)
        } else {
          const data = await getLists()
          if (!cancelled) setAllLists(data)
        }
      } catch {
        if (!cancelled) setLoadError(LOAD_ERROR)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()

    return () => {
      cancelled = true
    }
  }, [listId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" role="status">
        <p className="text-2xl text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-2xl text-destructive text-center" role="alert">
          {loadError}
        </p>
        <Button asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    )
  }

  if (!listId || !list) {
    return (
      <div className="min-h-screen flex flex-col p-4 sm:p-8">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" aria-label="Back to home">
              <ArrowLeftIcon className="size-4" />
              <span className="hidden sm:inline-block">Back</span>
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Choose a list to practice</h1>
        </div>
        {allLists.length === 0 ? (
          <p className="text-xl text-muted-foreground">No word lists yet. Create one from My Spelling Lists first.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allLists.map((l) => (
              <Link
                key={l.id}
                href={`/practice?list=${encodeURIComponent(l.id)}`}
                className="border rounded-lg p-6 hover:border-primary transition-colors"
              >
                <h2 className="text-2xl font-bold mb-2">{l.name}</h2>
                <p className="text-muted-foreground">
                  {l.patterns.reduce((sum, p) => sum + p.words.length, 0)} words to practice
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="border-b">
        <div className="flex items-center gap-2 px-4 py-3">
          <h1 className="text-2xl font-bold">{list.name}</h1>
        </div>
      </div>
      <main className="flex-1 px-4 py-6 sm:px-8">
        <PracticeMode list={list} onExit={() => router.push('/practice')} />
      </main>
    </div>
  )
}

export default function PracticePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" role="status">
          <p className="text-2xl text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <PracticeInner />
    </Suspense>
  )
}
