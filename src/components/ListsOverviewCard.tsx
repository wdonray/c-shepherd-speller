'use client'

import { useRef } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { GripVerticalIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WordList } from '@/models/WordList'
import { isListFavorite } from '@/models/WordList'
import WordListCard from './WordListCard'

/** Minimum rightward swipe distance that toggles a favorite (Spotify-style). */
export const SWIPE_STAR_MIN_DX = 60

interface ListsOverviewCardProps {
  list: WordList
  /** When true, the card shows a drag handle and participates in reorder. */
  reorderable: boolean
  onOpen: (list: WordList) => void
  onDelete: (list: WordList) => void
  onToggleFavorite: (list: WordList) => void
  /** Search query for bolding matched substrings. */
  highlightQuery?: string
}

/**
 * One list card on the lists overview page (issue #275).
 *
 * - Star toggle lives on the card (WordListCard).
 * - Swipe right on the card body toggles the favorite (mobile gesture).
 * - In reorder mode the drag handle renders inside the card header
 *   (issue #289) and only the handle starts a drag, so swipes on the
 *   body never conflict with dragging.
 */
export default function ListsOverviewCard({
  list,
  reorderable,
  onOpen,
  onDelete,
  onToggleFavorite,
  highlightQuery = '',
}: ListsOverviewCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    isDragging,
  } = useDraggable({
    id: list.id,
    disabled: !reorderable,
  })
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: list.id, disabled: !reorderable })
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  const handleRef = useRef<HTMLButtonElement>(null)

  const handleTouchStart = (event: React.TouchEvent) => {
    // A touch starting on the drag handle is a reorder, not a star swipe.
    if (handleRef.current?.contains(event.target as Node)) {
      touchStart.current = null
      return
    }
    const touch = event.touches[0]
    touchStart.current = { x: touch.clientX, y: touch.clientY }
  }

  const handleTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start) return
    const touch = event.changedTouches[0]
    const dx = touch.clientX - start.x
    const dy = touch.clientY - start.y
    // Rightward and mostly horizontal: a swipe, not a scroll.
    if (dx >= SWIPE_STAR_MIN_DX && Math.abs(dx) > Math.abs(dy) * 2) {
      onToggleFavorite(list)
    }
  }

  return (
    <div
      ref={(element) => {
        setDraggableRef(element)
        setDroppableRef(element)
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      // The DragOverlay renders the floating copy; hide the original visually
      // with opacity-0 (not visibility:hidden) so a keyboard drag keeps its
      // focused handle in the accessibility tree while dragging.
      className={cn(isDragging && 'opacity-0', isOver && 'rounded-[20px] ring-[3px] ring-sky-deep')}
    >
      <WordListCard
        list={list}
        onOpen={onOpen}
        onDelete={onDelete}
        primaryLabel="Edit list"
        isFavorite={isListFavorite(list)}
        onToggleFavorite={onToggleFavorite}
        highlightQuery={highlightQuery}
        leadingAction={
          reorderable ? (
            <button
              type="button"
              ref={handleRef}
              {...listeners}
              {...attributes}
              aria-label={`Drag to reorder ${list.name}`}
              className={cn(
                'flex size-11 shrink-0 cursor-grab touch-none items-center justify-center rounded-full',
                'border-2 border-line bg-card text-muted-foreground outline-none',
                'hover:border-sky-deep hover:text-ink focus-visible:ring-[3px] focus-visible:ring-ring/60 active:cursor-grabbing'
              )}
            >
              <GripVerticalIcon className="size-5" aria-hidden="true" />
            </button>
          ) : undefined
        }
      />
    </div>
  )
}
