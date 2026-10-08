import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import SortActivity from './SortActivity'
import type { WordList } from '@/models/WordList'

const dndHandlers: {
  onDragStart?: (e: { active: { id: string } }) => void
  onDragEnd?: (e: { active: { id: string }; over: { id: string } | null }) => void
} = {}
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return {
    ...actual,
    DndContext: ({
      children,
      onDragStart,
      onDragEnd,
    }: {
      children: React.ReactNode
      onDragStart?: (e: { active: { id: string } }) => void
      onDragEnd?: (e: { active: { id: string }; over: { id: string } | null }) => void
    }) => {
      dndHandlers.onDragStart = onDragStart
      dndHandlers.onDragEnd = onDragEnd
      return <>{children}</>
    },
    DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5',
  patterns: [
    { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'] },
    { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'common', words: ['rain'] },
    { id: 'p3', sound: 'long a', pattern: 'odd', frequency: 'rare', words: ['said'], isOddDuck: true },
  ],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('SortActivity', () => {
  it('starts with all sortable words in the bank and empty columns', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    expect(screen.getByText('Sort the words')).toBeInTheDocument()
    expect(screen.getByText('Word bank')).toBeInTheDocument()
    // All 3 sortable words in the bank.
    expect(screen.getByRole('button', { name: 'Drag the word cake' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drag the word bake' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drag the word rain' })).toBeInTheDocument()
    // Odd duck not in the bank.
    expect(screen.queryByRole('button', { name: 'Drag the word said' })).not.toBeInTheDocument()
    // Columns show drop targets.
    expect(screen.getAllByText('Drop words here')).toHaveLength(2)
  })

  it('shows odd ducks as already placed', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    expect(screen.getByText('Odd ducks, already placed')).toBeInTheDocument()
    expect(screen.getByText(/said/)).toBeInTheDocument()
  })

  it('shows keyboard instructions', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    expect(screen.getByText(/Keyboard: Space to pick up a word/)).toBeInTheDocument()
  })

  it('disables Check answers until a word is placed', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Check answers' })).toBeDisabled()
  })

  it('calls onExit when Exit sort is clicked', () => {
    const onExit = vi.fn()
    render(<SortActivity list={list} onExit={onExit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Exit sort' }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('has a live region for screen reader announcements', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    const live = document.querySelector('[aria-live="polite"][role="status"]')
    expect(live).toBeInTheDocument()
  })

  it('word cards have touch-action none for smartboard dragging', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    const card = screen.getByRole('button', { name: 'Drag the word cake' })
    expect(card).toHaveStyle({ touchAction: 'none' })
  })

  it('shows a floating card in the drag overlay while dragging', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    dndHandlers.onDragStart?.({ active: { id: 'p1:cake' } })
    await waitFor(() => {
      expect(screen.getByText('cake')).toBeInTheDocument()
    })
  })

  it('removes placement when a word is dropped back in the word bank', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    dndHandlers.onDragEnd?.({ active: { id: 'p1:cake' }, over: { id: 'p1' } })
    const live = document.querySelector('[aria-live="polite"][role="status"]')
    await waitFor(() => {
      expect(live?.textContent).toContain("Dropped 'cake' in column a_e")
    })
    dndHandlers.onDragEnd?.({ active: { id: 'p1:cake' }, over: { id: 'word-bank' } })
    await waitFor(() => {
      expect(live?.textContent).toContain('back in the word bank')
    })
  })
})
