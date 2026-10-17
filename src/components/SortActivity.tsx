'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type DragOverEvent,
  type Modifier,
} from '@dnd-kit/core'
import { XIcon, CheckIcon, UsersIcon, RotateCcwIcon } from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import { LIFT_TRANSITION, PICKUP_SHADOW, feedbackAnimate, settleTransition } from '@/lib/sort-motion'
import { Button } from '@/components/ui/button'
import { PowerBar, FREQUENCY_LABELS, type PowerBarLevel } from '@/components/ui/power-bar'
import RulesVisibilityToggle from './RulesVisibilityToggle'
import {
  playCorrectSound,
  playIncorrectSound,
  playDropSound,
  playPickupSound,
  playWinFanfare,
} from '@/lib/sound-effects'
import { buildWordBank, checkPlacements, type BankWord } from '@/lib/sort-activity'
import { getPatternUnderlineRanges } from '@/lib/pattern-underline'
import { fireWinConfetti } from '@/lib/confetti'
import { OddDuck } from './OddDuck'
import RuleCard, { EmptyRulePlaceholder } from './RuleCard'
import { getSoundType, SOUND_TYPE_BORDER, SOUND_TYPE_UNDERLINE_COLOR } from '@/lib/sound-type'
import { useMediaQuery } from '@/lib/use-media-query'
import type { WordList, SpellingPattern, PatternFrequency } from '@/models/WordList'

interface SortActivityProps {
  list: WordList
  onExit: () => void
  /**
   * Active class id, or null/undefined when sorting without a class.
   * Set once by the host page from the list's classroom (issue #263):
   * the teacher never picks a class here.
   */
  classId?: string | null
}

/** A class loaded for rule recall, with its per-pattern rules. */
export interface ActiveClass {
  id: string
  name: string
  rules: Record<string, { rule: string }>
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

/**
 * Scale applied to the floating drag tile (see DraggingWordCard). The tile
 * scales about its own center, which would move the grabbed point away from
 * the pointer (up to ~25px on full-width mobile tiles); the drag modifier
 * below compensates so the grab point stays pinned to the pointer.
 */
export const DRAG_TILE_SCALE = 1.15

/** Pointer coordinates from a pointer or touch activator event, if any. */
function activatorPoint(event: Event | null): { x: number; y: number } | null {
  if (!event) return null
  if ('clientX' in event) {
    const pointer = event as PointerEvent
    return { x: pointer.clientX, y: pointer.clientY }
  }
  const touchEvent = event as TouchEvent
  const touch = touchEvent.touches?.[0] ?? touchEvent.changedTouches?.[0]
  return touch ? { x: touch.clientX, y: touch.clientY } : null
}

/**
 * Touch drag lift: on touch pointers the floating tile renders 64px above
 * the fingertip so the finger never covers the word (Block Blast pattern).
 * Mouse drags keep the tile under the cursor.
 *
 * Also compensates for the overlay tile's lift scale: because the floating
 * tile scales up about its center, the grabbed point would otherwise drift
 * away from the pointer. Shifting the overlay by (1 - scale) times the grab
 * offset from center keeps the grabbed point exactly under the pointer.
 * Pure transform shifts, so neither affects layout.
 */
export const TOUCH_DRAG_LIFT = 64

export const touchDragLiftModifier: Modifier = ({ activatorEvent, activeNodeRect, transform }) => {
  let { x, y } = transform
  const point = activatorPoint(activatorEvent)
  if (point && activeNodeRect) {
    const grabX = point.x - activeNodeRect.left
    const grabY = point.y - activeNodeRect.top
    x += (1 - DRAG_TILE_SCALE) * (grabX - activeNodeRect.width / 2)
    y += (1 - DRAG_TILE_SCALE) * (grabY - activeNodeRect.height / 2)
  }
  const pointerType = (activatorEvent as PointerEvent | null)?.pointerType
  if (pointerType === 'touch') {
    y -= TOUCH_DRAG_LIFT
  }
  if (x === transform.x && y === transform.y) return transform
  return { ...transform, x, y }
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

// Module scope keeps the options object identity stable across renders, so
// the pointer sensor descriptor is not rebuilt on every render.
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 8 } }

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

/**
 * Word bank for the mobile tap-to-place layout. A droppable target so
 * touch-dragged words can be dropped back into the bank; highlighted while
 * a dragged word hovers it.
 */
function MobileWordBank({ isOver, children }: { isOver: boolean; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: WORD_BANK_ID })
  return (
    <section
      ref={setNodeRef}
      aria-label="Word bank"
      className={cn(
        'mb-8 rounded-2xl border-2 bg-card p-4 transition-colors',
        isOver ? 'border-sky-deep bg-sky-soft' : 'border-line'
      )}
    >
      <p className="mb-3 text-sm font-bold text-muted-foreground">Word bank</p>
      {children}
    </section>
  )
}

/**
 * Renders a word with its spelling-pattern letters underlined for correct
 * placements. Shared by the desktop draggable card and the mobile
 * tap-to-place card so the pattern underline shows on both.
 */
function renderWordWithUnderline(
  word: string,
  pattern: SpellingPattern | undefined,
  correct: boolean | null
): React.ReactNode {
  // No underline without a correctness state or a destination pattern.
  // The early return also narrows pattern for the sound lookup below.
  if (!correct || !pattern) return word
  const underlineRanges = getPatternUnderlineRanges(word, pattern.pattern)
  if (underlineRanges.length === 0) return word
  // Build the word with underlined segments.
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  // Get the underline color based on sound type.
  const soundType = getSoundType(pattern.pattern)
  const underlineColor = SOUND_TYPE_UNDERLINE_COLOR[soundType]
  underlineRanges.forEach((range, i) => {
    if (range.start > lastIndex) {
      parts.push(<span key={`t${i}`}>{word.slice(lastIndex, range.start)}</span>)
    }
    parts.push(
      <span
        key={`u${i}`}
        style={{
          // text-decoration paints the underline without changing the
          // box: border-bottom + padding-bottom made underlined segments
          // taller than plain ones, shifting the word up and breaking
          // letter alignment inside the flex word tile.
          textDecorationLine: 'underline',
          textDecorationColor: underlineColor,
          textDecorationThickness: '4px',
          textUnderlineOffset: '4px',
          textDecorationSkipInk: 'none',
        }}
      >
        {word.slice(range.start, range.end)}
      </span>
    )
    lastIndex = range.end
  })
  if (lastIndex < word.length) {
    parts.push(<span key="t-end">{word.slice(lastIndex)}</span>)
  }
  return <>{parts}</>
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
        animate={feedbackAnimate(correct)}
        className={cn(
          'flex min-h-[56px] min-w-[120px] cursor-grab items-center justify-center rounded-[14px] border-2 px-4 py-3 text-[24px] font-bold outline-none transition-colors select-none [-webkit-user-select:none]',
          'border-line bg-card text-ink hover:border-sky-deep hover:bg-sky-soft',
          'focus-visible:ring-[3px] focus-visible:ring-ring/60 active:cursor-grabbing',
          // The DragOverlay renders the floating copy; hide the original
          // so it does not shift layout or get clipped by scroll containers.
          isDragging && 'invisible',
          correct && 'border-leaf bg-leaf-soft',
          correct === false && 'border-coral bg-coral-soft'
        )}
      >
        {renderWordWithUnderline(entry.word, pattern, correct)}
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
      // Matches DRAG_TILE_SCALE; the drag modifier compensates for this
      // scale so the grabbed point stays under the pointer.
      animate={{ scale: DRAG_TILE_SCALE }}
      transition={LIFT_TRANSITION}
      style={{ boxShadow: PICKUP_SHADOW }}
      className="flex min-h-[56px] min-w-[120px] cursor-grabbing items-center justify-center rounded-[14px] border-2 border-sky-deep bg-sky-soft px-4 py-3 text-[24px] font-bold text-ink select-none [-webkit-user-select:none]"
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
  rule,
  ruleLabel,
  showRules,
}: {
  pattern: SpellingPattern
  children: React.ReactNode
  isOver: boolean
  ghostEntry: BankWord | null
  rule: string | null
  ruleLabel: string
  /** When false the rule slot (card or placeholder) is hidden entirely. */
  showRules: boolean
}) {
  const { setNodeRef } = useDroppable({ id: pattern.id })
  const border = SOUND_TYPE_BORDER[getSoundType(pattern.pattern)]
  const level = FREQUENCY_LEVEL[pattern.frequency]
  return (
    <section
      ref={setNodeRef}
      aria-label={`Pattern ${pattern.pattern} drop column`}
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
        {showRules && (rule ? <RuleCard rule={rule} label={ruleLabel} editable={false} /> : <EmptyRulePlaceholder />)}
      </div>
      <ul className="flex flex-wrap items-start gap-3">
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
    </section>
  )
}

/**
 * Word button for the mobile tap-to-place layout. Doubles as the touch
 * drag source: a tap (no pointer movement) selects the word and opens the
 * placement bar, while a real finger drag picks the tile up via dnd-kit
 * (PointerSensor's distance constraint keeps the two gestures distinct).
 * `touch-action: none` lets the drag start reliably on touch screens.
 */
function MobileWordCard({
  entry,
  correct,
  selected,
  onSelect,
  pattern,
  fillWidth = true,
}: {
  entry: BankWord
  correct: boolean | null
  selected: boolean
  onSelect: () => void
  pattern?: SpellingPattern
  /** Full-width in the word bank; content-width when wrapped inside a column. */
  fillWidth?: boolean
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.id })
  return (
    <li>
      <button
        ref={setNodeRef}
        type="button"
        {...listeners}
        {...attributes}
        style={{ touchAction: 'none' }}
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${selected ? 'Deselect' : 'Select'} the word ${entry.word}`}
        className={cn(
          'flex min-h-[56px] items-center justify-center rounded-[14px] border-2 px-4 py-3 text-[24px] font-bold outline-none transition-colors select-none [-webkit-user-select:none]',
          fillWidth ? 'w-full' : 'min-w-[120px]',
          'border-line bg-card text-ink hover:border-sky-deep hover:bg-sky-soft',
          'focus-visible:ring-[3px] focus-visible:ring-ring/60',
          // The DragOverlay renders the floating copy; hide the original
          // so it does not double-render while dragging.
          isDragging && 'invisible',
          selected && 'border-sky-deep bg-sky-soft',
          correct && 'border-leaf bg-leaf-soft',
          correct === false && 'border-coral bg-coral-soft'
        )}
      >
        {renderWordWithUnderline(entry.word, pattern, correct)}
        {correct && <CheckIcon className="ml-2 size-5 text-leaf-ink" aria-label="Correct" />}
        {correct === false && <XIcon className="ml-2 size-5 text-coral-ink" aria-label="Incorrect" />}
      </button>
    </li>
  )
}

/**
 * Column for the mobile tap-to-place layout: stacked full-width. A droppable
 * target for touch drags (highlighted while a dragged word hovers it);
 * words can also be placed via the sticky bottom placement bar, so the
 * column doubles as the display for tap-to-place.
 */
function MobileDropColumn({
  pattern,
  children,
  isOver,
  rule,
  ruleLabel,
  showRules,
}: {
  pattern: SpellingPattern
  children: React.ReactNode
  isOver: boolean
  rule: string | null
  ruleLabel: string
  /** When false the rule slot (card or placeholder) is hidden entirely. */
  showRules: boolean
}) {
  const { setNodeRef } = useDroppable({ id: pattern.id })
  const border = SOUND_TYPE_BORDER[getSoundType(pattern.pattern)]
  const level = FREQUENCY_LEVEL[pattern.frequency]
  return (
    <section
      ref={setNodeRef}
      aria-label={`Pattern ${pattern.pattern} column`}
      className={cn('rounded-2xl border-[3px] bg-card p-5 transition-colors', border, isOver && 'bg-sky-soft')}
    >
      <div className="mb-4 text-center">
        <h2 className="text-2xl font-extrabold text-ink">{pattern.pattern}</h2>
        <div className="mt-2 flex items-center justify-center gap-2">
          <PowerBar level={level} filledClassName="bg-ink" />
          <span className="text-sm font-bold text-muted-foreground">{FREQUENCY_LABELS[level]}</span>
        </div>
        {showRules && (rule ? <RuleCard rule={rule} label={ruleLabel} editable={false} /> : <EmptyRulePlaceholder />)}
      </div>
      <ul className="flex flex-wrap items-start gap-3">{children}</ul>
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
export default function SortActivity({ list, onExit, classId = null }: SortActivityProps) {
  const bank = useMemo(() => buildWordBank(list), [list])
  const [placements, setPlacements] = useState<Record<string, string>>({})
  const [results, setResults] = useState<Record<string, boolean>>({})
  const [announcement, setAnnouncement] = useState('')
  const [overId, setOverId] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<BankWord | null>(null)
  const [won, setWon] = useState(false)
  const [activeClass, setActiveClass] = useState<ActiveClass | null>(null)
  // Rule display visibility (issue #310). Default shown; the toggle in the
  // toolbar hides the rule cards under the column headers.
  const [showRules, setShowRules] = useState(true)
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

  // Play fanfare, confetti, and announce win when the win state is reached.
  useEffect(() => {
    if (won) {
      playWinFanfare()
      fireWinConfetti()
      announce('Every word is sorted.')
    }
  }, [won, announce])

  // Load the active class (if any) for rule recall and rule capture.
  // The previous class is cleared while the new one loads so the pill,
  // recalled rules, and rule saves can never act on a stale class.
  useEffect(() => {
    if (!classId) {
      setActiveClass(null)
      return
    }
    setActiveClass(null)
    let cancelled = false
    fetch(`/api/classes/${classId}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((body) => {
        if (!cancelled) setActiveClass(body.class)
      })
      .catch(() => {
        // A missing class must not block the sort; rules just won't recall.
        if (!cancelled) setActiveClass(null)
      })
    return () => {
      cancelled = true
    }
  }, [classId])

  // Existing rules for the column headers: the list's unscoped rules are the
  // base, and the class's decided rules overlay them when a class is active
  // (rule recall). The old exclusive swap made the rule flash and then vanish
  // once the class fetch completed for a class with no saved rules (issue
  // #351), and left the show/hide toggle with nothing to control. Rule
  // capture lives on the list page now (issue #263), never here.
  const { existingRules, classRulePatterns } = useMemo(() => {
    const map: Record<string, string> = {}
    for (const p of list.patterns) {
      if (p.rule) map[p.pattern] = p.rule
    }
    const classRules = new Set<string>()
    if (activeClass) {
      // Class rules are never empty: clearing one deletes it instead.
      for (const [patternText, rule] of Object.entries(activeClass.rules)) {
        map[patternText] = rule.rule
        classRules.add(patternText)
      }
    }
    return { existingRules: map, classRulePatterns: classRules }
  }, [activeClass, list])

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

  // Win cascade trigger: when every sortable word is placed and correct,
  // wait a beat, then celebrate. The timer cancels if the board changes
  // (a word moved back, Try again) before it fires. The win fires once per
  // completion: dismissing the dialog does not re-arm it, only breaking and
  // re-completing the board does.
  const winCelebrated = useRef(false)
  useEffect(() => {
    const complete = bank.length > 0 && bank.every((w) => placements[w.id] && placements[w.id] === w.patternId)
    if (!complete) {
      winCelebrated.current = false
      return
    }
    if (winCelebrated.current) return
    winCelebrated.current = true
    const timer = window.setTimeout(() => setWon(true), 300)
    return () => window.clearTimeout(timer)
  }, [bank, placements])

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
      // A completed drag replaces the tap-to-place selection: the word is
      // where the finger put it, so the placement bar must not linger.
      setSelectedEntry(null)
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
        setResults((prev) => {
          const next = { ...prev }
          delete next[entry.id]
          return next
        })
        announce(`Moved '${entry.word}' back to the word bank.`)
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

  // useSensor normalizes a missing options argument to {}, which the
  // KeyboardSensor requires: its handleKeyDown destructures options, and an
  // undefined options object crashes with "Cannot read properties of
  // undefined (reading 'keyboardCodes')" (sentry #255).
  const pointerSensor = useSensor(PointerSensor, POINTER_SENSOR_OPTIONS)
  const keyboardSensor = useSensor(KeyboardSensor)
  const sensors = useSensors(pointerSensor, keyboardSensor)

  return (
    <DndContext
      sensors={sensors}
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
        <div className={cn('mb-4 flex items-center', activeClass ? 'justify-between' : 'justify-end')}>
          {activeClass && (
            <span className="flex items-center gap-1.5 rounded-full border-2 border-line bg-card px-3 py-1.5 text-sm font-bold text-ink">
              <UsersIcon className="size-4" aria-hidden="true" />
              {activeClass.name}
            </span>
          )}
          <div className="flex items-center gap-1">
            <RulesVisibilityToggle showRules={showRules} onToggle={() => setShowRules((v) => !v)} />
            <Button variant="secondary" size="sm" onClick={handleTryAgain}>
              <RotateCcwIcon className="size-4" aria-hidden="true" />
              Try again
            </Button>
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
            <MobileWordBank isOver={overId === WORD_BANK_ID}>
              {bankWords.length === 0 ? (
                <p className="py-4 text-center text-[15px] text-muted-foreground">All words are placed.</p>
              ) : (
                <ul className="space-y-3">
                  {bankWords.map((entry) => (
                    <MobileWordCard
                      key={entry.id}
                      entry={entry}
                      // Bank words have no correctness state; results are
                      // cleared whenever a word returns to the bank.
                      correct={null}
                      selected={selectedEntry?.id === entry.id}
                      onSelect={() => handleMobileWordTap(entry)}
                    />
                  ))}
                </ul>
              )}
            </MobileWordBank>

            <div className="flex flex-col gap-6">
              {patterns.map((pattern) => {
                const columnWords = bank.filter((w) => placements[w.id] === pattern.id)
                return (
                  <MobileDropColumn
                    key={pattern.id}
                    pattern={pattern}
                    isOver={overId === pattern.id}
                    rule={existingRules[pattern.pattern] ?? null}
                    ruleLabel={classRulePatterns.has(pattern.pattern) ? 'Your class decided:' : 'The rule:'}
                    showRules={showRules}
                  >
                    {columnWords.map((entry) => (
                      <MobileWordCard
                        key={entry.id}
                        entry={entry}
                        // Placed words always have a result: every column
                        // drop sets results[entry.id] alongside placements.
                        correct={results[entry.id]}
                        pattern={pattern}
                        selected={selectedEntry?.id === entry.id}
                        onSelect={() => handleMobileWordTap(entry)}
                        fillWidth={false}
                      />
                    ))}
                    {columnWords.length === 0 && (
                      <li className="w-full py-8 text-center text-sm text-muted-foreground">No words here yet.</li>
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
                  <DropColumn
                    key={pattern.id}
                    pattern={pattern}
                    isOver={overId === pattern.id}
                    ghostEntry={ghostEntry}
                    rule={existingRules[pattern.pattern] ?? null}
                    ruleLabel={classRulePatterns.has(pattern.pattern) ? 'Your class decided:' : 'The rule:'}
                    showRules={showRules}
                  >
                    {columnWords.map((entry) => (
                      <SortableWordCard
                        key={entry.id}
                        entry={entry}
                        // Placed words always have a result: every column
                        // drop sets results[entry.id] alongside placements.
                        correct={results[entry.id]}
                        pattern={pattern}
                      />
                    ))}
                    {columnWords.length === 0 && (
                      <li className="w-full py-8 text-center text-sm text-muted-foreground">Drop words here</li>
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
      </div>
      <DragOverlay dropAnimation={null} modifiers={[touchDragLiftModifier]} style={{ zIndex: 100 }}>
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
            <p className="mt-2 text-[15px] text-muted-foreground">Nice work.</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button variant="secondary" onClick={handleTryAgain}>
                Try again
              </Button>
              <Button variant="ghost" onClick={onExit}>
                Exit
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </DndContext>
  )
}
