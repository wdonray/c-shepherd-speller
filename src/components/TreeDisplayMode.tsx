'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getList, getLists } from '@/lib/lists-api'
import type { WordList } from '@/models/WordList'
import SpellingTree from './SpellingTree'

const LOAD_ERROR = 'Could not load the word list. Check your connection and try again.'

/**
 * Interactive display mode: shows a spelling tree for the selected list.
 * Replaces the old passive flat-list display.
 *
 * Reads ?list=<id> from the URL; if absent, shows a list picker.
 */
function TreeDisplayInner() {
  const searchParams = useSearchParams()
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

  // No list selected: show the picker.
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
          <h1 className="text-3xl font-bold">Choose a list to present</h1>
        </div>
        {allLists.length === 0 ? (
          <p className="text-xl text-muted-foreground">No word lists yet. Create one from My Spelling Lists first.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {allLists.map((l) => (
              <Link
                key={l.id}
                href={`/display?list=${encodeURIComponent(l.id)}`}
                className="border rounded-lg p-6 hover:border-primary transition-colors"
              >
                <h2 className="text-2xl font-bold mb-2">{l.name}</h2>
                <p className="text-muted-foreground">
                  {l.patterns.length} {l.patterns.length === 1 ? 'pattern' : 'patterns'} ·{' '}
                  {l.patterns.reduce((sum, p) => sum + p.words.length, 0)} words
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Show the interactive tree.
  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/display" aria-label="Choose a different list">
              <ArrowLeftIcon className="size-4" />
              <span className="hidden sm:inline-block">Lists</span>
            </Link>
          </Button>
        </div>
      </div>
      <main className="flex-1 px-4 py-6 sm:px-8">
        <SpellingTree list={list} />
      </main>
    </div>
  )
}

export default function TreeDisplayMode() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center" role="status">
          <p className="text-2xl text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <TreeDisplayInner />
    </Suspense>
  )
}
