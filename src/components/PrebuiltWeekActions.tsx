'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createList, notifyListsChanged } from '@/lib/lists-api'
import { prebuiltGradeLabel, type PrebuiltWeek } from '@/lib/prebuilt-lists'
import { cn } from '@/lib/utils'
import PullPatternsModal from './PullPatternsModal'

type CopyState =
  | { name: 'idle' }
  | { name: 'copying' }
  | { name: 'copied'; listId: string; listName: string; patternCount: number; wordCount: number }
  | { name: 'copyError' }

const COPY_ERROR = 'Could not copy the list. Check your connection and try again.'

const SECTION_CAPTION_CLASS = 'text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground'

/**
 * One segment of the "Try it" group. The segments are plain buttons joined
 * into a single pill: dividers (not gaps) separate them so the three
 * try-before-you-copy actions read as one set. Focus rings are inset because
 * the container clips overflow.
 */
const SEGMENT_CLASS =
  'cursor-pointer px-4 py-3 text-[15px] font-bold whitespace-nowrap text-foreground transition-colors select-none hover:bg-accent focus-visible:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/60 focus-visible:ring-inset focus-visible:outline-none'

/**
 * The actions on a prebuilt week preview (issue #463), split into two
 * labeled groups (issue #487): "Make it yours" takes the content (copy the
 * whole week, or pull patterns into her own lists), "Try it" tries the
 * preview first as one compact segmented set. The preview itself stays
 * read-only; both flows create or update her own editable lists.
 */
export default function PrebuiltWeekActions({ week }: { week: PrebuiltWeek }) {
  const router = useRouter()
  const [copyState, setCopyState] = useState<CopyState>({ name: 'idle' })
  const [pullOpen, setPullOpen] = useState(false)
  const ownLabelId = useId()
  const tryLabelId = useId()

  const wordCount = week.patterns.reduce((sum, p) => sum + p.words.length, 0)

  const handleCopy = async () => {
    setCopyState({ name: 'copying' })
    try {
      const list = await createList({
        name: week.title,
        gradeLevel: prebuiltGradeLabel(week.grade),
        week: String(week.week),
        patterns: week.patterns.map((p) => ({
          sound: p.sound,
          pattern: p.pattern,
          frequency: p.frequency,
          words: p.words,
        })),
      })
      notifyListsChanged()
      setCopyState({
        name: 'copied',
        listId: list.id,
        listName: list.name,
        patternCount: week.patterns.length,
        wordCount,
      })
    } catch {
      setCopyState({ name: 'copyError' })
    }
  }

  if (copyState.name === 'copied') {
    // Confirmation restates exactly what she got (Phase A research: teachers
    // distrust vague confirmations). One tap lands her on the editable list.
    return (
      <div role="status" className="rounded-[20px] border-2 border-leaf bg-card p-4">
        <p className="flex items-center gap-2 text-[17px] font-bold text-ink">
          <CheckIcon className="size-5 shrink-0 text-leaf" aria-hidden="true" />
          {copyState.listName} is now in your lists
        </p>
        <p className="mt-1 text-[15px] text-muted-foreground">
          {copyState.patternCount} patterns, {copyState.wordCount} words, ready to edit.
        </p>
        <Button className="mt-3" onClick={() => router.push(`/lists/${copyState.listId}`)}>
          Open my list
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <p id={ownLabelId} className={cn(SECTION_CAPTION_CLASS, 'mb-1.5')}>
          Make it yours
        </p>
        <div role="group" aria-labelledby={ownLabelId} className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={handleCopy} disabled={copyState.name === 'copying'}>
            {copyState.name === 'copying' ? 'Copying...' : 'Copy to my lists'}
          </Button>
          <Button variant="secondary" onClick={() => setPullOpen(true)}>
            Add patterns to...
          </Button>
        </div>
      </div>
      {/* Phase C: use the week directly, no setup needed (issue #463). */}
      <div>
        <p id={tryLabelId} className={cn(SECTION_CAPTION_CLASS, 'mb-1.5')}>
          Try it
        </p>
        <div
          role="group"
          aria-labelledby={tryLabelId}
          className="inline-flex overflow-hidden rounded-full border-2 border-line bg-card"
        >
          <button
            type="button"
            onClick={() => router.push(`/display?prebuilt=${encodeURIComponent(week.id)}`)}
            className={SEGMENT_CLASS}
          >
            Present
          </button>
          <button
            type="button"
            onClick={() => router.push(`/practice?prebuilt=${encodeURIComponent(week.id)}`)}
            className={cn(SEGMENT_CLASS, 'border-l-2 border-line')}
          >
            Practice
          </button>
          <button
            type="button"
            onClick={() => router.push(`/lists/prebuilt/${encodeURIComponent(week.id)}/worksheets`)}
            className={cn(SEGMENT_CLASS, 'border-l-2 border-line')}
          >
            Worksheets
          </button>
        </div>
      </div>
      {/* Reserved so the error notice never shifts the layout when it appears. */}
      <div className="min-h-6 pt-1">
        {copyState.name === 'copyError' && (
          <p role="alert" className="text-[13px] text-muted-foreground">
            {COPY_ERROR}{' '}
            <button type="button" onClick={handleCopy} className="font-bold text-ink underline">
              Try again
            </button>
          </p>
        )}
      </div>
      {pullOpen && <PullPatternsModal week={week} onClose={() => setPullOpen(false)} />}
    </div>
  )
}
