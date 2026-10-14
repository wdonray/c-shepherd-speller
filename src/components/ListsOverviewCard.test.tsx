'use client'

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import ListsOverviewCard, { SWIPE_STAR_MIN_DX, dragCardStyle } from './ListsOverviewCard'
import type { WordList } from '@/models/WordList'

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const { dndState } = vi.hoisted(() => ({ dndState: { isDragging: false, isOver: false } }))

// Wrap the real dnd-kit hooks so tests can force the drag/hover visual states.
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return {
    ...actual,
    useDraggable: (args: Parameters<typeof actual.useDraggable>[0]) => ({
      ...actual.useDraggable(args),
      isDragging: dndState.isDragging,
    }),
    useDroppable: (args: Parameters<typeof actual.useDroppable>[0]) => ({
      ...actual.useDroppable(args),
      isOver: dndState.isOver,
    }),
  }
})

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5: Long A',
  patterns: [],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

function renderCard(props: Partial<React.ComponentProps<typeof ListsOverviewCard>> = {}) {
  const onOpen = vi.fn()
  const onDelete = vi.fn()
  const onToggleFavorite = vi.fn()
  render(
    <DndContext>
      <div data-testid="card-slot">
        <ListsOverviewCard
          list={list}
          reorderable={false}
          onOpen={onOpen}
          onDelete={onDelete}
          onToggleFavorite={onToggleFavorite}
          {...props}
        />
      </div>
    </DndContext>
  )
  return { onOpen, onDelete, onToggleFavorite }
}

/** The dnd wrapper div carrying the touch handlers. */
function cardWrapper() {
  return screen.getByText('Week 5: Long A').closest('[data-testid="card-slot"] > div')!
}

describe('ListsOverviewCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    dndState.isDragging = false
    dndState.isOver = false
  })

  it('renders the list card with an unfilled star by default', () => {
    renderCard()
    const star = screen.getByRole('button', { name: 'Add Week 5: Long A to favorites' })
    expect(star).toHaveAttribute('aria-pressed', 'false')
  })

  it('shows a filled star for a favorite', () => {
    renderCard({ list: { ...list, isFavorite: true } })
    const star = screen.getByRole('button', { name: 'Remove Week 5: Long A from favorites' })
    expect(star).toHaveAttribute('aria-pressed', 'true')
  })

  it('toggles the favorite when the star is clicked', () => {
    const { onToggleFavorite } = renderCard()
    fireEvent.click(screen.getByRole('button', { name: 'Add Week 5: Long A to favorites' }))
    expect(onToggleFavorite).toHaveBeenCalledWith(list)
  })

  it('toggles the favorite on a rightward swipe', () => {
    const { onToggleFavorite } = renderCard()
    const wrapper = cardWrapper()
    fireEvent.touchStart(wrapper, { touches: [{ clientX: 100, clientY: 200 }] })
    fireEvent.touchEnd(wrapper, { changedTouches: [{ clientX: 100 + SWIPE_STAR_MIN_DX + 5, clientY: 203 }] })
    expect(onToggleFavorite).toHaveBeenCalledWith(list)
  })

  it('ignores swipes shorter than the threshold', () => {
    const { onToggleFavorite } = renderCard()
    const wrapper = cardWrapper()
    fireEvent.touchStart(wrapper, { touches: [{ clientX: 100, clientY: 200 }] })
    fireEvent.touchEnd(wrapper, { changedTouches: [{ clientX: 100 + SWIPE_STAR_MIN_DX - 5, clientY: 200 }] })
    expect(onToggleFavorite).not.toHaveBeenCalled()
  })

  it('ignores mostly-vertical swipes', () => {
    const { onToggleFavorite } = renderCard()
    const wrapper = cardWrapper()
    fireEvent.touchStart(wrapper, { touches: [{ clientX: 100, clientY: 200 }] })
    fireEvent.touchEnd(wrapper, { changedTouches: [{ clientX: 200, clientY: 400 }] })
    expect(onToggleFavorite).not.toHaveBeenCalled()
  })

  it('ignores leftward swipes', () => {
    const { onToggleFavorite } = renderCard()
    const wrapper = cardWrapper()
    fireEvent.touchStart(wrapper, { touches: [{ clientX: 200, clientY: 200 }] })
    fireEvent.touchEnd(wrapper, { changedTouches: [{ clientX: 100, clientY: 200 }] })
    expect(onToggleFavorite).not.toHaveBeenCalled()
  })

  it('ignores a touch end with no touch start', () => {
    const { onToggleFavorite } = renderCard()
    const wrapper = cardWrapper()
    fireEvent.touchEnd(wrapper, { changedTouches: [{ clientX: 200, clientY: 200 }] })
    expect(onToggleFavorite).not.toHaveBeenCalled()
  })

  it('does not star on a swipe starting from the drag handle', () => {
    const { onToggleFavorite } = renderCard({ reorderable: true })
    const handle = screen.getByRole('button', { name: 'Drag to reorder Week 5: Long A' })
    const wrapper = cardWrapper()
    // A drag starts on the handle and moves right; it must not toggle the star.
    fireEvent.touchStart(handle, { touches: [{ clientX: 100, clientY: 200 }] })
    fireEvent.touchEnd(wrapper, { changedTouches: [{ clientX: 200, clientY: 205 }] })
    expect(onToggleFavorite).not.toHaveBeenCalled()
  })

  it('shows a drag handle when reorderable', () => {
    renderCard({ reorderable: true })
    expect(screen.getByRole('button', { name: 'Drag to reorder Week 5: Long A' })).toBeInTheDocument()
  })

  it('hides the drag handle when not reorderable', () => {
    renderCard({ reorderable: false })
    expect(screen.queryByRole('button', { name: 'Drag to reorder Week 5: Long A' })).not.toBeInTheDocument()
  })
  it('dims the card while dragging and highlights the drop target', () => {
    dndState.isDragging = true
    dndState.isOver = true
    renderCard({ reorderable: true })
    const wrapper = cardWrapper()
    expect(wrapper.className).toContain('opacity-40')
    expect(wrapper.className).toContain('ring-sky-deep')
  })
})

describe('dragCardStyle', () => {
  it('returns undefined when not dragging', () => {
    expect(dragCardStyle(null)).toBeUndefined()
  })

  it('returns a translate style while dragging', () => {
    expect(dragCardStyle({ x: 10, y: 20, scaleX: 1, scaleY: 1 })).toEqual({ transform: 'translate3d(10px, 20px, 0)' })
  })
})
