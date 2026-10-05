'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { ArrowLeftIcon, RefreshCwIcon } from 'lucide-react'
import { getSpelling, type SpellingData } from '@/lib/spelling-api'
import { Button } from '@/components/ui/button'

type ListKey = 'words' | 'sounds' | 'spelling'

interface ListMeta {
  key: ListKey
  label: string
  emptyHint: string
}

const LISTS: ListMeta[] = [
  { key: 'words', label: 'Words', emptyHint: 'No words in this list yet.' },
  { key: 'sounds', label: 'Sounds', emptyHint: 'No sounds in this list yet.' },
  { key: 'spelling', label: 'Spelling Patterns', emptyHint: 'No spelling patterns in this list yet.' },
]

const LOAD_ERROR = 'Could not load your spelling lists. Check your connection and try again.'

export default function DisplayMode() {
  const { data: session } = useSession()
  const [activeList, setActiveList] = useState<ListKey>('words')
  const [spellingData, setSpellingData] = useState<SpellingData | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const email = session?.user?.email
    if (!email) return
    let cancelled = false
    setLoadError(null)
    // Resolve the app's database user ID via email. session.user.id is the
    // NextAuth UUID, not the user record ID that the API's ownership check
    // expects (see requireOwnership in src/lib/require-auth.ts).
    fetch(`/api/users?email=${encodeURIComponent(email)}`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to resolve user')
        return res.json()
      })
      .then((data) => {
        const dbUserId = data.user?.id
        if (!dbUserId) throw new Error('User not found')
        return getSpelling(dbUserId)
      })
      .then(
        (data) => {
          if (!cancelled) setSpellingData(data)
        },
        () => {
          if (!cancelled) setLoadError(LOAD_ERROR)
        }
      )
    return () => {
      cancelled = true
    }
  }, [session, reloadKey])

  const activeMeta = LISTS.find((list) => list.key === activeList) as ListMeta

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 text-center">
        <p role="alert" className="text-xl text-destructive">
          {loadError}
        </p>
        <Button
          onClick={() => {
            setLoadError(null)
            setReloadKey((key) => key + 1)
          }}
        >
          <RefreshCwIcon className="size-4" />
          Try again
        </Button>
        <Button variant="link" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    )
  }

  if (!spellingData) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <p className="text-xl text-muted-foreground" role="status">
          Loading your spelling lists...
        </p>
      </div>
    )
  }

  const items = spellingData[activeList]

  return (
    <div className="min-h-screen flex flex-col">
      <div className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-8">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/" aria-label="Exit display mode and go back home">
              <ArrowLeftIcon className="size-4" />
              <span className="hidden sm:inline-block">Exit display</span>
            </Link>
          </Button>
          <div role="group" aria-label="Choose a list to display" className="flex flex-wrap gap-2">
            {LISTS.map((list) => (
              <Button
                key={list.key}
                variant={list.key === activeList ? 'default' : 'outline'}
                size="sm"
                aria-pressed={list.key === activeList}
                onClick={() => setActiveList(list.key)}
              >
                {list.label}
                <span className="ml-1 text-xs">({spellingData[list.key].length})</span>
              </Button>
            ))}
          </div>
        </div>
      </div>

      <main className="flex-1 px-4 py-8 sm:px-8 lg:px-12">
        <h1 className="sr-only">{activeMeta.label} spelling list</h1>
        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
            <p className="text-3xl font-semibold">{activeMeta.emptyHint}</p>
            <p className="text-xl text-muted-foreground">Add items from My Spelling Lists on the home page.</p>
          </div>
        ) : (
          <ol className="columns-1 gap-10 md:columns-2 xl:columns-3">
            {items.map((item, index) => (
              <li key={`${index}-${item}`} className="mb-6 flex break-inside-avoid items-baseline gap-4">
                <span
                  aria-hidden="true"
                  className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-2xl font-bold text-muted-foreground"
                >
                  {index + 1}
                </span>
                <span className="text-4xl font-bold tracking-wide break-words sm:text-5xl lg:text-6xl">{item}</span>
              </li>
            ))}
          </ol>
        )}
      </main>
    </div>
  )
}
