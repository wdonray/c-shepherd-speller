'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import { XIcon, CheckIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { LIFT_TRANSITION, PICKUP_SHADOW, prefersReducedMotion, settleTransition } from '@/lib/sort-motion'
import { Button } from '@/components/ui/button'
import { PowerBar, FREQUENCY_LABELS, type PowerBarLevel } from '@/components/ui/power-bar'
import {
  playCorrectSound,
  playIncorrectSound,
  playDropSound,
  playPickupSound,
  playWinFanfare,
} from '@/lib/sound-effects'
import { buildWordBank, checkPlacements, type BankWord } from '@/lib/sort-activity'
import { getPatternUnderlineRanges } from '@/lib/pattern-underline'
import { OddDuck } from './OddDuck'
import { getSoundType, SOUND_TYPE_BORDER } from '@/lib/sound-type'
import { useMediaQuery } from '@/lib/use-media-query'
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

/**
 * Magnetic collision detection: expands each droppable's rect by the magnetic
 * radius so columns glow and show the ghost preview before the pointer
 * crosses their boundary. Forgives sloppy smartboard aim.
 */
const MAGNETIC_RADIUS = 60

/** Expands a rect by the magnetic radius on all sides. */
export function expandRectForMagnet<T extends { left: number; right: number; top: number; bottom: number }>(
  rect: T
): T {
  return {
    ...rect,
    left: rect.left - MAGNETIC_RADIUS,
    right: rect.right + MAGNETIC_RADIUS,
    top: rect.top - MAGNETIC_RADIUS,
    bottom: rect.bottom + MAGNETIC_RADIUS,
  }
}

export const magneticCollision: CollisionDetection = (args) => {
  // KeyboardSensor provides no pointer coordinates, so pointerWithin would
  // return no collisions. Fall back to rectIntersection for keyboard drags.
  if (!args.pointerCoordinates) {
    return rectIntersection(args)
  }
  const { droppableContainers, droppableRects } = args
  // Expand each droppable's rect by the magnetic radius so columns glow
  // and show the ghost preview before the pointer crosses their boundary.
  const expandedRects = new Map(droppableRects)
  for (const container of droppableContainers) {
    const rect = droppableRects.get(container.id)
    if (rect) {
      expandedRects.set(container.id, expandRectForMagnet(rect))
    }
  }
  return pointerWithin({ ...args, droppableRects: expandedRects })
}

// Below Tailwind's md breakpoint the drag-and-drop sort is replaced with
// tap-to-place: small viewports cannot scroll horizontally to reach every
// column, so dragging breaks. A viewport-width media query (not pointer
// type) is the signal, because the failure mode is layout size: large
// touchscreens keep the working drag-and-drop layout.
const MOBILE_QUERY = '(max-width: 767px)'

function WordTray({ isOver, children }: { isOver: boolean; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: WORD_BANK_ID })
  return (
    <div
      ref={setNodeRef}
      aria-label="Word tray"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 max-h-[40vh] overflow-y-auto border-t-2 border-line bg-card px-4 py-4 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] transition-colors',
        isOver && 'border-sky-deep bg-sky-soft'
      )}
    >
      <div className="mx-auto max-w-6xl">{children}</div>
    </div>
  )
}

function SortableWordCard({
  entry,
  correct,
  pattern,
}: {
  entry: BankWord
  correct: boolean | null
  pattern?: SpellingPattern
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.id })
  // Compute underline ranges for correct placements.
  const underlineRanges = correct && pattern ? getPatternUnderlineRanges(entry.word, pattern.pattern) : []
  const renderWord = () => {
    if (underlineRanges.length === 0 || !pattern) return entry.word
    // Build the word with underlined segments.
    const parts: React.ReactNode[] = []
    let lastIndex = 0
    // Get the underline color based on sound type.
    const soundType = getSoundType(pattern.pattern)
    const underlineColor = SOUND_TYPE_BORDER[soundType] ?? '#2e6510'
    underlineRanges.forEach((range, i) => {
      if (range.start > lastIndex) {
        parts.push(<span key={`t${i}`}>{entry.word.slice(lastIndex, range.start)}</span>)
      }
      parts.push(
        <span
          key={`u${i}`}
          style={{
            borderBottom: `4px solid ${underlineColor}`,
            borderRadius: '2px',
            paddingBottom: '2px',
          }}
        >
          {entry.word.slice(range.start, range.end)}
        </span>
      )
      lastIndex = range.end
    })
    if (lastIndex < entry.word.length) {
      parts.push(<span key="t-end">{entry.word.slice(lastIndex)}</span>)
    }
    return parts
  }
  return (
    <li>
      <motion.button
        ref={setNodeRef}
        type="button"
        {...listeners}
        {...attributes}
        style={{ touchAction: 'none' }}
        aria-label={`Drag the word ${entry.word}`}
        layout
        transition={settleTransition()}
        animate={correct === false ? { rotate: [-4, 4, -2, 0] } : correct ? { scale: [1, 1.18, 1] } : {}}
        className={cn(
          'flex min-h-[56px] min-w-[120px] cursor-grab items-center justify-center rounded-[14px] border-2 px-4 py-3 text-[24px] font-bold outline-none transition-colors',
          'border-line bg-card text-ink hover:border-sky-deep hover:bg-sky-soft',
          'focus-visible:ring-[3px] focus-visible:ring-ring/60 active:cursor-grabbing',
          // The DragOverlay renders the floating copy; hide the original
          // so it does not shift layout or get clipped by scroll containers.
          isDragging && 'invisible',
          correct && 'border-leaf bg-leaf-soft',
          correct === false && 'border-coral bg-coral-soft'
        )}
      >
        {renderWord()}
        {correct && <CheckIcon className="ml-2 size-5 text-leaf-ink" aria-label="Correct" />}
        {correct === false && <XIcon className="ml-2 size-5 text-coral-ink" aria-label="Incorrect" />}
      </motion.button>
    </li>
  )
}

/** Floating copy of the dragged word, rendered in a portal above everything. */
function DraggingWordCard({ entry }: { entry: BankWord }) {
  return (
    <motion.div
      data-testid="drag-ghost"
      initial={{ scale: 1 }}
      animate={{ scale: 1.15 }}
      transition={LIFT_TRANSITION}
      style={{ boxShadow: PICKUP_SHADOW }}
      className="flex min-h-[56px] min-w-[120px] cursor-grabbing items-center justify-center rounded-[14px] border-2 border-sky-deep bg-sky-soft px-4 py-3 text-[24px] font-bold text-ink"
    >
      {entry.word}
    </motion.div>
  )
}

function DropColumn({
  pattern,
  children,
  isOver,
  ghostEntry,
}: {
  pattern: SpellingPattern
  children: React.ReactNode
  isOver: boolean
  ghostEntry: BankWord | null
}) {
  const { setNodeRef } = useDroppable({ id: pattern.id })
  const border = SOUND_TYPE_BORDER[getSoundType(pattern.pattern)]
  const level = FREQUENCY_LEVEL[pattern.frequency]
  const reduceMotion = prefersReducedMotion()
  return (
    <motion.section
      ref={setNodeRef}
      aria-label={`Pattern ${pattern.pattern} drop column`}
      animate={isOver || reduceMotion ? { scale: 1 } : { scale: [1, 1.015, 1] }}
      transition={isOver || reduceMotion ? undefined : { duration: 2.4, ease: 'easeInOut', repeat: Infinity }}
      className={cn(
        'min-h-[240px] flex-1 rounded-2xl border-[3px] border-dashed bg-card p-5 outline-none transition-colors',
        border,
        isOver && 'border-solid bg-sky-soft'
      )}
    >
      <div className="mb-4 text-center">
        <h2 className="text-2xl font-extrabold text-ink">{pattern.pattern}</h2>
        <div className="mt-2 flex items-center justify-center gap-2">
          <PowerBar level={level} filledClassName="bg-ink" />
          <span className="text-sm font-bold text-muted-foreground">{FREQUENCY_LABELS[level]}</span>
        </div>
      </div>
      <ul className="space-y-3">
        {children}
        {isOver && ghostEntry && (
          <li aria-hidden="true">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 0.45, scale: 1 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              className="flex min-h-[56px] min-w-[120px] items-center justify-center rounded-[14px] border-2 border-dashed border-line px-4 py-3 text-[24px] font-bold text-ink"
            >
              {ghostEntry.word}
            </motion.div>
          </li>
        )}
      </ul>
    </motion.section>
  )
}

/** Word button for the mobile tap-to-place layout. */
function MobileWordCard({
  entry,
  correct,
  selected,
  onSelect,
}: {
  entry: BankWord
  correct: boolean | null
  selected: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${selected ? 'Deselect' : 'Select'} the word ${entry.word}`}
        className={cn(
          'flex min-h-[56px] w-full items-center justify-center rounded-[14px] border-2 px-4 py-3 text-[24px] font-bold outline-none transition-colors',
          'border-line bg-card text-ink hover:border-sky-deep hover:bg-sky-soft',
          'focus-visible:ring-[3px] focus-visible:ring-ring/60',
          selected && 'border-sky-deep bg-sky-soft',
          correct && 'border-leaf bg-leaf-soft',
          correct === false && 'border-coral bg-coral-soft'
        )}
      >
        {entry.word}
        {correct && <CheckIcon className="ml-2 size-5 text-leaf-ink" aria-label="Correct" />}
        {correct === false && <XIcon className="ml-2 size-5 text-coral-ink" aria-label="Incorrect" />}
      </button>
    </li>
  )
}

/**
 * Column for the mobile tap-to-place layout: stacked full-width. Words are
 * placed via the sticky bottom placement bar, so the column itself is
 * display-only.
 */
function MobileDropColumn({ pattern, children }: { pattern: SpellingPattern; children: React.ReactNode }) {
  const border = SOUND_TYPE_BORDER[getSoundType(pattern.pattern)]
  const level = FREQUENCY_LEVEL[pattern.frequency]
  return (
    <section
      aria-label={`Pattern ${pattern.pattern} column`}
      className={cn('rounded-2xl border-[3px] bg-card p-5', border)}
    >
      <div className="mb-4 text-center">
        <h2 className="text-2xl font-extrabold text-ink">{pattern.pattern}</h2>
        <div className="mt-2 flex items-center justify-center gap-2">
          <PowerBar level={level} filledClassName="bg-ink" />
          <span className="text-sm font-bold text-muted-foreground">{FREQUENCY_LABELS[level]}</span>
        </div>
      </div>
      <ul className="space-y-3">{children}</ul>
    </section>
  )
}

/**
 * Sticky bottom placement bar for the mobile tap-to-place layout. Tapping a
 * word opens this bar with one big destination button per pattern column, so
 * the student never has to scroll to find where to put the word: the choices
 * come to the thumb instead. This follows the mobile action-sheet pattern
 * (tap an item, choose a destination from the bottom of the screen) used by
 * mail and task apps for "move to" flows.
 */
function MobilePlaceBar({
  word,
  patterns,
  showWordBank,
  onPlace,
  onDismiss,
}: {
  word: BankWord
  patterns: SpellingPattern[]
  showWordBank: boolean
  onPlace: (destination: SpellingPattern | 'bank') => void
  onDismiss: () => void
}) {
  return (
    <div
      role="region"
      aria-label={`Choose where to put ${word.word}`}
      className="fixed inset-x-0 bottom-0 z-50 border-t-2 border-line bg-card px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(0,0,0,0.12)]"
    >
      <div className="mx-auto max-w-xl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-[15px] font-bold text-ink">Where does &lsquo;{word.word}&rsquo; go?</p>
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss} aria-label={`Put ${word.word} down`}>
            Cancel
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          {patterns.map((pattern) => (
            <button
              key={pattern.id}
              type="button"
              onClick={() => onPlace(pattern)}
              aria-label={`Put ${word.word} in the ${pattern.pattern} column`}
              className={cn(
                'min-h-[52px] flex-1 rounded-[14px] border-2 border-line bg-background px-4 py-2 text-[18px] font-bold whitespace-nowrap text-ink outline-none transition-colors',
                'hover:border-sky-deep hover:bg-sky-soft',
                'focus-visible:ring-[3px] focus-visible:ring-ring/60 active:bg-sky-soft'
              )}
            >
              {pattern.pattern}
            </button>
          ))}
          {showWordBank && (
            <button
              type="button"
              onClick={() => onPlace('bank')}
              aria-label={`Put ${word.word} back in the word bank`}
              className={cn(
                'min-h-[52px] flex-1 rounded-[14px] border-2 border-dashed border-line bg-background px-4 py-2 text-[18px] font-bold whitespace-nowrap text-muted-foreground outline-none transition-colors',
                'hover:border-sky-deep hover:bg-sky-soft hover:text-ink',
                'focus-visible:ring-[3px] focus-visible:ring-ring/60 active:bg-sky-soft'
              )}
            >
              Word bank
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Interactive word sort activity for the present screen. Words start unsorted
 * in a bank; students sort each word into the pattern column it belongs in.
 * The teacher checks answers when ready.
 *
 * On viewports below the md breakpoint the drag-and-drop interaction is
 * replaced with tap-to-place: tap a word, then choose a destination from the
 * sticky bottom bar. Small screens cannot show every column at once, so the
 * destinations come to the thumb instead of making the student scroll to
 * find them.
 */
export default function SortActivity({ list, onExit }: SortActivityProps) {
  const bank = useMemo(() => buildWordBank(list), [list])
  const [placements, setPlacements] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, boolean>>({})
  const [announcement, setAnnouncement] = useState('')
  const [overId, setOverId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<BankWord | null>(null)
  const [won, setWon] = useState(false)
  const isMobile = useMediaQuery(MOBILE_QUERY)

  const patterns = useMemo(() => {
    return [...list.patterns].sort((a, b) => FREQUENCY_LEVEL[b.frequency] - FREQUENCY_LEVEL[a.frequency])
  }, [list])

  const oddDuckWords = useMemo(() => {
    const words: string[] = []
    for (const pattern of list.patterns) {
      const odd = new Set(pattern.oddDucks ?? [])
      for (const word of pattern.words) {
        if (odd.has(word)) words.push(word)
      }
    }
    return words
  }, [list])

  const placedIds = useMemo(() => new Set(Object.keys(placements)), [placements])
  const bankWords = useMemo(() => bank.filter((w) => !placedIds.has(w.id)), [bank, placedIds])

  const announce = useCallback((message: string) => {
    setAnnouncement(message)
  }, [])

  // Play fanfare and announce win when the win state is reached.
  useEffect(() => {
    if (won) {
      playWinFanfare()
      announce('Every word is sorted.')
    }
  }, [won, announce])

  /**
   * Shared placement logic for drag-and-drop and tap-to-place. Moves the
   * word to the destination pattern column, or back to the word bank.
   * Returns the pattern placed into, 'bank', or null for unknown columns.
   */
  const placeWord = useCallback(
    (entry: BankWord, destination: string): SpellingPattern | 'bank' | null => {
      if (destination === WORD_BANK_ID) {
        setPlacements((prev) => {
          const next = { ...prev }
          delete next[entry.id]
          return next
        })
        return 'bank'
      }
      const pattern = patterns.find((p) => p.id === destination)
      if (!pattern) return null
      setPlacements((prev) => ({ ...prev, [entry.id]: destination }))
      return pattern
    },
    [patterns]
  )

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(String(event.active.id))
      playPickupSound()
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
      const result = placeWord(entry, String(over.id))
      if (result === null) return
      if (result === 'bank') {
        // Clearing the result when returning to the bank.
        setResults((prev) => {
          const next = { ...prev }
          delete next[entry.id]
          return next
        })
        announce(`Put '${entry.word}' back in the word bank`)
      } else {
        playDropSound()
        const isCorrect = entry.patternId === result.id
        setResults((prev) => ({ ...prev, [entry.id]: isCorrect }))
        if (isCorrect) {
          playCorrectSound()
          announce(`${entry.word} is correct in ${result.pattern}.`)
        } else {
          playIncorrectSound()
          announce(`${entry.word} does not go with ${result.pattern}. Try another column.`)
        }
        // Check win condition: all placed and all correct.
        setPlacements((currentPlacements) => {
          const newPlacements = { ...currentPlacements, [entry.id]: result.id }
          const allPlaced = bank.every((w) => newPlacements[w.id])
          const allCorrect = bank.every((w) => newPlacements[w.id] === w.patternId)
          if (allPlaced && allCorrect) {
            // Trigger win cascade.
            setTimeout(() => setWon(true), 300)
          }
          return newPlacements
        })
      }
    },
    [bank, placeWord, announce]
  )

  const handleMobileWordTap = useCallback(
    (entry: BankWord) => {
      if (selectedEntry?.id === entry.id) {
        setSelectedEntry(null)
        announce(`Deselected '${entry.word}'. Put it down.`)
      } else {
        setSelectedEntry(entry)
        announce(`Selected '${entry.word}'. Choose where it goes.`)
      }
    },
    [selectedEntry, announce]
  )

  const handleMobilePlaceDestination = useCallback(
    (entry: BankWord, destination: SpellingPattern | 'bank') => {
      // The bar only offers real destinations, so placeWord cannot fail here.
      const result = placeWord(entry, destination === 'bank' ? WORD_BANK_ID : destination.id)!
      setSelectedEntry(null)
      if (result === 'bank') {
        announce(`Moved '${entry.word}' back to the word bank.`)
      } else {
        announce(`Placed '${entry.word}' in ${result.pattern}.`)
      }
    },
    [placeWord, announce]
  )

  const handleTryAgain = useCallback(() => {
    setPlacements({})
    setResults({})
    setSelectedEntry(null)
    setWon(false)
    announce('All words returned to the word bank. Try again.')
  }, [announce])

  const sensors = useMemo(() => {
    const pointer = { sensor: PointerSensor, options: { activationConstraint: { distance: 8 } } }
    return [pointer, { sensor: KeyboardSensor }]
  }, [])

  return (
    <DndContext
      sensors={sensors as never}
      collisionDetection={magneticCollision}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div
        className={cn(
          'force-light w-full rounded-[20px] bg-background p-6 pb-56 sm:p-10 sm:pb-60',
          isMobile && selectedEntry && 'pb-64'
        )}
      >
        <div className="mb-4 flex items-center justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onExit}
            aria-label="Exit sort"
            className="opacity-60 hover:opacity-100"
          >
            <XIcon className="size-5" aria-hidden="true" />
          </Button>
        </div>

        <div aria-live="polite" className="sr-only" role="status">
          {announcement}
        </div>
        {!isMobile && (
          <p className="sr-only">
            Keyboard: Space to pick up a word, Left and Right to choose a column, Space to drop, Escape to cancel.
          </p>
        )}

        {isMobile ? (
          <>
            <p className="sr-only">Tap a word, then choose where it goes. Tap a placed word to move it.</p>
            <section aria-label="Word bank" className="mb-8 rounded-2xl border-2 border-line bg-card p-4">
              <p className="mb-3 text-sm font-bold text-muted-foreground">Word bank</p>
              {bankWords.length === 0 ? (
                <p className="py-4 text-center text-[15px] text-muted-foreground">All words are placed.</p>
              ) : (
                <ul className="space-y-3">
                  {bankWords.map((entry) => (
                    <MobileWordCard
                      key={entry.id}
                      entry={entry}
                      correct={results[entry.id] ?? null}
                      selected={selectedEntry?.id === entry.id}
                      onSelect={() => handleMobileWordTap(entry)}
                    />
                  ))}
                </ul>
              )}
            </section>

            <div className="flex flex-col gap-6">
              {patterns.map((pattern) => {
                const columnWords = bank.filter((w) => placements[w.id] === pattern.id)
                return (
                  <MobileDropColumn key={pattern.id} pattern={pattern}>
                    {columnWords.map((entry) => (
                      <MobileWordCard
                        key={entry.id}
                        entry={entry}
                        correct={results[entry.id] ?? null}
                        selected={selectedEntry?.id === entry.id}
                        onSelect={() => handleMobileWordTap(entry)}
                      />
                    ))}
                    {columnWords.length === 0 && (
                      <li className="py-8 text-center text-sm text-muted-foreground">No words here yet.</li>
                    )}
                  </MobileDropColumn>
                )
              })}
            </div>

            {selectedEntry && (
              <MobilePlaceBar
                word={selectedEntry}
                patterns={patterns}
                showWordBank={placedIds.has(selectedEntry.id)}
                onPlace={(destination) => handleMobilePlaceDestination(selectedEntry, destination)}
                onDismiss={() => {
                  announce(`Deselected '${selectedEntry.word}'. Put it down.`)
                  setSelectedEntry(null)
                }}
              />
            )}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch">
              {patterns.map((pattern) => {
                const columnWords = bank.filter((w) => placements[w.id] === pattern.id)
                const ghostEntry =
                  overId === pattern.id && activeId ? (bank.find((w) => w.id === activeId) ?? null) : null
                return (
                  <DropColumn key={pattern.id} pattern={pattern} isOver={overId === pattern.id} ghostEntry={ghostEntry}>
                    {columnWords.map((entry) => (
                      <SortableWordCard
                        key={entry.id}
                        entry={entry}
                        correct={results[entry.id] ?? null}
                        pattern={pattern}
                      />
                    ))}
                    {columnWords.length === 0 && (
                      <li className="py-8 text-center text-sm text-muted-foreground">Drop words here</li>
                    )}
                  </DropColumn>
                )
              })}
            </div>

            <WordTray isOver={overId === WORD_BANK_ID}>
              {bankWords.length === 0 ? (
                <p className="py-4 text-center text-[15px] text-muted-foreground">All words are placed.</p>
              ) : (
                <ul className="flex flex-wrap justify-center gap-3">
                  {bankWords.map((entry) => (
                    <SortableWordCard key={entry.id} entry={entry} correct={null} />
                  ))}
                </ul>
              )}
            </WordTray>
          </>
        )}

        {oddDuckWords.length > 0 && (
          <section aria-label="Odd ducks" className="mt-6 rounded-2xl border-2 border-plum bg-plum-soft p-5">
            <div className="mb-2 flex items-center gap-3">
              <OddDuck className="size-11 text-plum" label="Odd duck" />
              <h2 className="text-lg font-bold text-plum-ink">Odd ducks, already placed</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              {oddDuckWords.join(', ')}: these spellings do not follow the patterns.
            </p>
          </section>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button variant="secondary" onClick={handleTryAgain}>
            Try again
          </Button>
        </div>
      </div>
      <DragOverlay dropAnimation={null} style={{ zIndex: 100 }}>
        {activeId
          ? (() => {
              const ghostEntry = bank.find((w) => w.id === activeId)
              return ghostEntry ? <DraggingWordCard entry={ghostEntry} /> : null
            })()
          : null}
      </DragOverlay>
      {won && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="max-w-md rounded-2xl bg-card p-8 text-center shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="win-title"
          >
            <h2 id="win-title" className="text-2xl font-extrabold text-ink">
              Every word is sorted.
            </h2>
            <p className="mt-2 text-[15px] text-muted-foreground">Nice work. Now, what did the class figure out?</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={() => setWon(false)}>Tell the rule</Button>
              <Button variant="ghost" onClick={() => setWon(false)}>
                Skip for now
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </DndContext>
  )
}
