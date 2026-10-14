'use client'

import { useRef } from 'react'
import { useDraggable, useDroppable } from '@dnd-kit/core'
import { CSS, type Transform } from '@dnd-kit/utilities'
import { GripVerticalIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { WordList } from '@/models/WordList'
import { isListFavorite } from '@/models/WordList'
import WordListCard from './WordListCard'

/** Minimum rightward swipe distance that toggles a favorite (Spotify-style). */
export const SWIPE_STAR_MIN_DX = 60

/** Card style while dragging: the card follows the pointer. */
export function dragCardStyle(transform: Transform | null): React.CSSProperties | undefined {
  return transform ? { transform: CSS.Translate.toString(transform) } : undefined
}

interface ListsOverviewCardProps {
  list: WordList
  /** When true, the card shows a drag handle and participates in reorder. */
  reorderable: boolean
  onOpen: (list: WordList) => void
  onDelete: (list: WordList) => void
  onToggleFavorite: (list: WordList) => void
}

/**
 * One list card on the lists overview page (issue #275).
 *
 * - Star toggle lives on the card (WordListCard).
 * - Swipe right on the card body toggles the favorite (mobile gesture).
 * - In reorder mode a drag handle reorders via dnd-kit; only the handle
 *   starts a drag so swipes on the body never conflict with dragging.
 */
export default function ListsOverviewCard({
  list,
  reorderable,
  onOpen,
  onDelete,
  onToggleFavorite,
}: ListsOverviewCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
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
      style={dragCardStyle(transform)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className={cn(isDragging && 'opacity-40', isOver && 'rounded-[20px] ring-[3px] ring-sky-deep')}
    >
      <div className="flex h-full items-center gap-2">
        {reorderable && (
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
        )}
        <div className="min-w-0 flex-1">
          <WordListCard
            list={list}
            onOpen={onOpen}
            onDelete={onDelete}
            primaryLabel="Edit list"
            isFavorite={isListFavorite(list)}
            onToggleFavorite={onToggleFavorite}
          />
        </div>
      </div>
    </div>
  )
}
