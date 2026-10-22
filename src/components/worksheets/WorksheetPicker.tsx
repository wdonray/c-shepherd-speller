'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { getList } from '@/lib/lists-api'
import { prebuiltWeekToWordList, type PrebuiltWeek } from '@/lib/prebuilt-lists'
import PrebuiltBadge from '@/components/PrebuiltBadge'
import { extractWorksheetWords, WORKSHEET_TYPES, type WorksheetType } from '@/lib/worksheets'
import type { WordList } from '@/models/WordList'
import { reportError } from '@/lib/report-error'

/** Picker-page copy for each worksheet type. Adult-educator tone, no em dashes. */
export const WORKSHEET_TYPE_INFO: Record<WorksheetType, { title: string; description: string }> = {
  'spelling-list': {
    title: 'Spelling list',
    description: "The week's words, grouped by spelling pattern.",
  },
  'cut-sort': {
    title: 'Cut and sort',
    description: 'Word cards to cut out and sort under each pattern.',
  },
  'fill-blank': {
    title: 'Fill in the blank',
    description: 'Sentences with the spelling patterns missing.',
  },
  'word-search': {
    title: 'Word search',
    description: 'Find every spelling word in the grid.',
  },
  crossword: {
    title: 'Crossword',
    description: 'Sentence clues with the word blanked out, plus a word bank.',
  },
  reading: {
    title: 'Reading practice',
    description: 'One sentence per word, read aloud.',
  },
  'parent-note': {
    title: 'Note for families',
    description: "Explains the week's patterns and practice ideas.",
  },
}

type LoadState = 'loading' | 'ready' | 'not-found' | 'error'

/**
 * Worksheet picker for one list (issue #402). Every type is selected by
 * default; the teacher unchecks what they do not want and prints the rest
 * as one job, answer keys included.
 *
 * Pass `prebuiltWeek` instead of `listId` to pick worksheets for a prebuilt
 * curriculum week (issue #463): the list loads from the bundled data, no
 * API fetch, and the print job routes under /lists/prebuilt.
 */
export default function WorksheetPicker({ listId, prebuiltWeek }: { listId?: string; prebuiltWeek?: PrebuiltWeek }) {
  const router = useRouter()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [list, setList] = useState<WordList | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [selected, setSelected] = useState<Set<WorksheetType>>(new Set(WORKSHEET_TYPES))
  // Spelling test date for the family note (issue #518): typed at print time,
  // never stored on the list.
  const [testDate, setTestDate] = useState('')

  // Routes and labels for the back link and the print job: prebuilt weeks
  // live under /lists/prebuilt, teacher lists under /lists.
  const backHref = prebuiltWeek ? `/lists/prebuilt/${prebuiltWeek.id}` : `/lists/${listId}`
  const backLabel = prebuiltWeek ? 'Back to preview' : 'Back to editing'
  const printBase = prebuiltWeek
    ? `/lists/prebuilt/${prebuiltWeek.id}/worksheets/print`
    : `/lists/${listId}/worksheets/print`

  useEffect(() => {
    if (prebuiltWeek) {
      setList(prebuiltWeekToWordList(prebuiltWeek))
      setLoadState('ready')
      return
    }
    let cancelled = false
    async function load() {
      try {
        const data = await getList(listId!)
        if (!cancelled) {
          setList(data)
          setLoadState('ready')
        }
      } catch (err) {
        reportError(err, { location: 'WorksheetPicker.load' })
        if (!cancelled) {
          setLoadState(err instanceof Error && /not found/i.test(err.message) ? 'not-found' : 'error')
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [listId, prebuiltWeek, retryCount])

  const toggleType = (type: WorksheetType) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const wordCount = list ? extractWorksheetWords(list).length : 0
  const canPrint = loadState === 'ready' && wordCount > 0 && selected.size > 0

  const handlePrint = () => {
    const ordered = WORKSHEET_TYPES.filter((type) => selected.has(type))
    const query = `types=${ordered.join(',')}${selected.has('parent-note') && testDate ? `&testDate=${testDate}` : ''}`
    router.push(`${printBase}?${query}`)
  }

  if (loadState === 'loading') {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center" role="status" aria-label="Loading worksheets">
        <div
          className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-line border-t-ink"
          aria-hidden="true"
        />
        <p className="mt-4 text-muted-foreground">Loading your list&hellip;</p>
      </div>
    )
  }

  if (loadState === 'not-found') {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
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
      <div className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold">Could not load this list</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">Check your connection and try again.</p>
        <Button onClick={() => setRetryCount((c) => c + 1)} className="mt-6">
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Link href={backHref} className="text-sm font-bold text-sky-ink hover:underline">
        &larr; {backLabel}
      </Link>
      <h1 className="mt-2 flex items-center gap-2 text-3xl font-bold">
        Printable worksheets
        {prebuiltWeek && <PrebuiltBadge />}
      </h1>
      <p className="mt-2 text-[15px] text-muted-foreground">
        Pick worksheets for &ldquo;{list.name}&rdquo;. They print as one job, and every worksheet comes with its own
        answer key.
      </p>

      {wordCount === 0 ? (
        <div className="mt-8 rounded-2xl border-2 border-line bg-card p-6 text-center">
          <h2 className="text-xl font-bold">No words to print yet</h2>
          <p className="mt-2 text-[15px] text-muted-foreground">
            Add words to at least one unlocked pattern first. Locked patterns stay hidden until they are taught.
          </p>
          <Button asChild variant="secondary" className="mt-4">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-6 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setSelected(new Set(WORKSHEET_TYPES))}>
              Select all
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
          <fieldset className="mt-4 space-y-3">
            <legend className="sr-only">Worksheet types</legend>
            {WORKSHEET_TYPES.map((type) => {
              const info = WORKSHEET_TYPE_INFO[type]
              const checked = selected.has(type)
              return (
                <label
                  key={type}
                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border-2 p-4 transition-colors ${
                    checked ? 'border-ink bg-card' : 'border-line bg-card'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleType(type)}
                    className="mt-1 h-5 w-5 shrink-0 accent-ink"
                    aria-label={info.title}
                  />
                  <span>
                    <span className="block text-[17px] font-bold">{info.title}</span>
                    <span className="block text-[15px] text-muted-foreground">{info.description}</span>
                  </span>
                </label>
              )
            })}
          </fieldset>
          {selected.has('parent-note') && (
            <div className="mt-4">
              <label className="block text-sm font-bold" htmlFor="test-date">
                Spelling test date{' '}
                <span className="font-normal text-muted-foreground">(optional, prints on the family note)</span>
              </label>
              <input
                id="test-date"
                type="date"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="mt-1 rounded-xl border-2 border-line bg-card px-3 py-2 text-[15px]"
              />
            </div>
          )}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Button onClick={handlePrint} disabled={!canPrint} size="lg">
              Preview and print
            </Button>
            {selected.size === 0 && (
              <p className="text-[15px] text-muted-foreground">Select at least one worksheet type to continue.</p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
