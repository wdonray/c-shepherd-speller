'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { XIcon, CheckIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PowerBar, FREQUENCY_LABELS, type PowerBarLevel } from '@/components/ui/power-bar'
import { playCorrectSound, playIncorrectSound } from '@/lib/sound-effects'
import { buildWordBank, checkPlacements, type BankWord } from '@/lib/sort-activity'
import type { WordList, SpellingPattern, PatternFrequency } from '@/models/WordList'

interface SortActivityProps {
  list: WordList
  onExit: () => void
}

const FREQUENCY_LEVEL: Record<PatternFrequency, PowerBarLevel> = {
  common: 3,
  'less-common': 2,
  rare: 1,
}

const WORD_BANK_ID = 'word-bank'

function WordBank({ isOver, children }: { isOver: boolean; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: WORD_BANK_ID })
  return (
    <div
      ref={setNodeRef}
      aria-label="Word bank drop area"
      className={cn(
        'mb-8 overflow-x-auto rounded-2xl border-2 border-line bg-card p-4 transition-colors',
        isOver && 'border-sky-deep bg-sky-soft'
      )}
    >
      {children}
    </div>
  )
}

const COLUMN_ACCENTS = [
  { border: 'border-leaf', fill: 'bg-leaf', text: 'text-leaf-ink' },
  { border: 'border-sun-deep', fill: 'bg-sun', text: 'text-sun-ink' },
  { border: 'border-sky', fill: 'bg-sky', text: 'text-sky-ink' },
  { border: 'border-plum', fill: 'bg-plum', text: 'text-plum-ink' },
] as const

function SortableWordCard({ entry, checked, correct }: { entry: BankWord; checked: boolean; correct: boolean | null }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.id })
  return (
    <li>
      <button
        ref={setNodeRef}
        type="button"
        {...listeners}
        {...attributes}
        style={{ touchAction: 'none' }}
        aria-label={`Drag the word ${entry.word}`}
        className={cn(
          'flex min-h-[56px] min-w-[120px] cursor-grab items-center justify-center rounded-[14px] border-2 px-4 py-3 text-[24px] font-bold outline-none transition-colors',
          'border-line bg-card text-ink hover:border-sky-deep hover:bg-sky-soft',
          'focus-visible:ring-[3px] focus-visible:ring-ring/60 active:cursor-grabbing',
          // The DragOverlay renders the floating copy; hide the original
          // so it does not shift layout or get clipped by scroll containers.
          isDragging && 'invisible',
          checked && correct && 'border-leaf bg-leaf-soft',
          checked && correct === false && 'border-coral bg-coral-soft'
        )}
      >
        {entry.word}
        {checked && correct && <CheckIcon className="ml-2 size-5 text-leaf-ink" aria-label="Correct" />}
        {checked && correct === false && <XIcon className="ml-2 size-5 text-coral-ink" aria-label="Incorrect" />}
      </button>
    </li>
  )
}

/** Floating copy of the dragged word, rendered in a portal above everything. */
function DraggingWordCard({ entry }: { entry: BankWord }) {
  return (
    <div className="flex min-h-[56px] min-w-[120px] cursor-grabbing items-center justify-center rounded-[14px] border-2 border-sky-deep bg-sky-soft px-4 py-3 text-[24px] font-bold text-ink shadow-lg">
      {entry.word}
    </div>
  )
}

function DropColumn({
  pattern,
  accentIndex,
  children,
  isOver,
}: {
  pattern: SpellingPattern
  accentIndex: number
  children: React.ReactNode
  isOver: boolean
}) {
  const { setNodeRef } = useDroppable({ id: pattern.id })
  const accent = COLUMN_ACCENTS[accentIndex % COLUMN_ACCENTS.length]
  const level = FREQUENCY_LEVEL[pattern.frequency]
  return (
    <section
      ref={setNodeRef}
      aria-label={`Pattern ${pattern.pattern} drop column`}
      className={cn(
        'min-h-[200px] rounded-2xl border-[3px] border-dashed bg-card p-5 outline-none transition-colors',
        accent.border,
        isOver && 'bg-sky-soft'
      )}
    >
      <div className="mb-4 text-center">
        <h2 className="text-2xl font-extrabold text-ink">{pattern.pattern}</h2>
        <div className="mt-2 flex items-center justify-center gap-2">
          <PowerBar level={level} filledClassName={accent.fill} />
          <span className={cn('text-sm font-bold', accent.text)}>{FREQUENCY_LABELS[level]}</span>
        </div>
      </div>
      <ul className="space-y-3">{children}</ul>
    </section>
  )
}

/**
 * Interactive word sort activity for the present screen. Words start unsorted
 * in a bank; students drag each word into the pattern column it belongs in.
 * The teacher checks answers when ready.
 */
export default function SortActivity({ list, onExit }: SortActivityProps) {
  const bank = useMemo(() => buildWordBank(list), [list])
  const [placements, setPlacements] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)
  const [results, setResults] = useState<Record<string, boolean>>({})
  const [score, setScore] = useState<{ correct: number; total: number } | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [overId, setOverId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const patterns = useMemo(() => {
    return [...list.patterns].sort((a, b) => FREQUENCY_LEVEL[b.frequency] - FREQUENCY_LEVEL[a.frequency])
  }, [list])

  const placedIds = useMemo(() => new Set(Object.keys(placements)), [placements])
  const bankWords = useMemo(() => bank.filter((w) => !placedIds.has(w.id)), [bank, placedIds])

  const announce = useCallback((message: string) => {
    setAnnouncement(message)
  }, [])

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(String(event.active.id))
      const entry = bank.find((w) => w.id === event.active.id)
      if (entry) announce(`Picked up '${entry.word}'`)
    },
    [bank, announce]
  )

  const handleDragOver = useCallback((event: DragOverEvent) => {
    setOverId(event.over ? String(event.over.id) : null)
  }, [])

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event
      setOverId(null)
      setActiveId(null)
      const entry = bank.find((w) => w.id === active.id)
      if (!over || !entry) return
      const overIdStr = String(over.id)
      if (overIdStr === WORD_BANK_ID) {
        // Dragged back into the word bank: remove any placement.
        setPlacements((prev) => {
          if (!(entry.id in prev)) return prev
          const next = { ...prev }
          delete next[entry.id]
          return next
        })
        setChecked(false)
        announce(`Put '${entry.word}' back in the word bank`)
        return
      }
      const pattern = patterns.find((p) => p.id === overIdStr)
      if (pattern) {
        setPlacements((prev) => ({ ...prev, [entry.id]: overIdStr }))
        setChecked(false)
        announce(`Dropped '${entry.word}' in column ${pattern.pattern}`)
      }
    },
    [bank, patterns, announce]
  )

  const handleCheck = useCallback(() => {
    const { results: graded, correct, total } = checkPlacements(bank, placements)
    const map: Record<string, boolean> = {}
    for (const r of graded) map[r.wordId] = r.correct
    setResults(map)
    setChecked(true)
    setScore({ correct, total })
    announce(`${correct} of ${total} in the right column.`)
    if (correct === total) {
      playCorrectSound()
    } else {
      playIncorrectSound()
    }
  }, [bank, placements, announce])

  const handleTryAgain = useCallback(() => {
    setPlacements({})
    setChecked(false)
    setResults({})
    setScore(null)
    announce('All words returned to the word bank. Try again.')
  }, [announce])

  const sensors = useMemo(() => {
    const pointer = { sensor: PointerSensor, options: { activationConstraint: { distance: 8 } } }
    return [pointer, { sensor: KeyboardSensor }]
  }, [])

  return (
    <DndContext
      sensors={sensors as never}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="force-light w-full rounded-[20px] bg-background p-6 sm:p-10">
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-extrabold text-ink">Sort the words</h2>
          <p className="mx-auto mt-2 max-w-xl text-[15px] text-muted-foreground">
            Invite students up to the board. Drag each word into the column whose spelling it uses.
          </p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-muted-foreground">
            Keyboard: Space to pick up a word, Left and Right to choose a column, Space to drop, Escape to cancel.
          </p>
        </div>

        <div aria-live="polite" className="sr-only" role="status">
          {announcement}
        </div>

        <WordBank isOver={overId === WORD_BANK_ID}>
          <p className="mb-3 text-sm font-bold text-muted-foreground">Word bank</p>
          {bankWords.length === 0 ? (
            <p className="py-4 text-center text-[15px] text-muted-foreground">
              All words placed. Check answers or drag words between columns to change them.
            </p>
          ) : (
            <ul className="flex gap-3 overflow-x-auto pb-2">
              {bankWords.map((entry) => (
                <SortableWordCard
                  key={entry.id}
                  entry={entry}
                  checked={checked}
                  correct={checked ? results[entry.id]! : null}
                />
              ))}
            </ul>
          )}
        </WordBank>

        <div className="flex flex-col gap-6 lg:flex-row lg:items-stretch">
          {patterns.map((pattern, i) => {
            const columnWords = bank.filter((w) => placements[w.id] === pattern.id)
            return (
              <div key={pattern.id} style={{ flex: '1 1 0', minWidth: 220 }} className="flex">
                <div className="w-full">
                  <DropColumn pattern={pattern} accentIndex={i} isOver={overId === pattern.id}>
                    {columnWords.map((entry) => (
                      <SortableWordCard
                        key={entry.id}
                        entry={entry}
                        checked={checked}
                        correct={checked ? results[entry.id]! : null}
                      />
                    ))}
                    {columnWords.length === 0 && (
                      <li className="py-8 text-center text-sm text-muted-foreground">Drop words here</li>
                    )}
                  </DropColumn>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {!checked ? (
            <Button onClick={handleCheck} disabled={Object.keys(placements).length === 0}>
              Check answers
            </Button>
          ) : (
            <Button variant="secondary" onClick={handleTryAgain}>
              Try again
            </Button>
          )}
          <Button variant="secondary" onClick={onExit}>
            Exit sort
          </Button>
        </div>

        {score && (
          <p aria-live="polite" className="mt-4 text-center text-xl font-bold text-ink">
            {score.correct} of {score.total} in the right column.
          </p>
        )}
      </div>
      <DragOverlay dropAnimation={null} style={{ zIndex: 100 }}>
        {activeId ? <DraggingWordCard entry={bank.find((w) => w.id === activeId)!} /> : null}
      </DragOverlay>
    </DndContext>
  )
}
