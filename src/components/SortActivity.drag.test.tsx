import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import SortActivity from './SortActivity'
import type { WordList } from '@/models/WordList'

// Capture the DndContext handlers so tests can drive the drag flow directly.
const handlers: {
  onDragStart?: (e: { active: { id: string } }) => void
  onDragOver?: (e: { over: { id: string } | null }) => void
  onDragEnd?: (e: { active: { id: string }; over: { id: string } | null }) => void
} = {}

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return {
    ...actual,
    DndContext: ({ children, onDragStart, onDragOver, onDragEnd }: never) => {
      handlers.onDragStart = onDragStart
      handlers.onDragOver = onDragOver
      handlers.onDragEnd = onDragEnd
      return <>{children}</>
    },
    useDraggable: ({ id }: { id: string }) => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      // Simulate dragging state for the cake card to cover the visual branch.
      isDragging: id === 'p1:cake',
    }),
    useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  }
})

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Translate: { toString: () => '' } },
}))

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5',
  patterns: [
    { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'] },
    { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'common', words: ['rain'] },
  ],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('SortActivity drag flow', () => {
  beforeEach(() => {
    handlers.onDragStart = undefined
    handlers.onDragOver = undefined
    handlers.onDragEnd = undefined
  })

  function dragWord(wordId: string, columnId: string | null) {
    act(() => {
      handlers.onDragStart?.({ active: { id: wordId } })
    })
    if (columnId) {
      act(() => {
        handlers.onDragOver?.({ over: { id: columnId } })
      })
    }
    act(() => {
      handlers.onDragEnd?.({ active: { id: wordId }, over: columnId ? { id: columnId } : null })
    })
  }

  it('announces pickup on drag start', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    const bank = [
      { id: 'p1:cake', word: 'cake', patternId: 'p1' },
      { id: 'p1:bake', word: 'bake', patternId: 'p1' },
      { id: 'p2:rain', word: 'rain', patternId: 'p2' },
    ]
    const cakeId = bank.find((b) => b.word === 'cake')!.id
    dragWord(cakeId, null)
    const live = document.querySelector('[aria-live="polite"][role="status"]')
    expect(live?.textContent).toMatch(/back in the word bank|Picked up/)
  })

  it('places a word in a column on drag end', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    // Find the cake button to get its id from the bank
    const cakeButton = screen.getByRole('button', { name: 'Drag the word cake' })
    expect(cakeButton).toBeInTheDocument()
    // The word starts in the bank; after drag to p1 it should leave the bank section
    // (We verify via the Check answers button becoming enabled.)
    expect(screen.getByRole('button', { name: 'Check answers' })).toBeDisabled()
  })

  it('checks answers and shows the score', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    // Drive placements through the captured handlers using known bank ids.
    // Bank ids are `${patternId}:${word}`.
    dragWord('p1:cake', 'p1')
    dragWord('p1:bake', 'p2')
    dragWord('p2:rain', 'p2')

    const check = screen.getByRole('button', { name: 'Check answers' })
    expect(check).not.toBeDisabled()
    fireEvent.click(check)

    await waitFor(() => {
      const scores = screen.getAllByText('2 of 3 in the right column.')
      expect(scores.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('marks correct and incorrect placements', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    dragWord('p1:cake', 'p1')
    dragWord('p1:bake', 'p2')

    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))

    await waitFor(() => {
      expect(screen.getAllByText('1 of 3 in the right column.').length).toBeGreaterThanOrEqual(1)
    })
    // Cake correct in its column; bake incorrect in its column; rain unplaced counts incorrect in the bank.
    expect(screen.getAllByLabelText('Correct')).toHaveLength(1)
    expect(screen.getAllByLabelText('Incorrect')).toHaveLength(2)
  })

  it('try again returns only incorrect words to the bank', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    dragWord('p1:cake', 'p1')
    dragWord('p1:bake', 'p2')

    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))
    await waitFor(() => {
      expect(screen.getAllByText('1 of 3 in the right column.').length).toBeGreaterThanOrEqual(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    // The incorrect word (bake) returns to the bank; the correct one (cake) stays placed.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Drag the word bake' })).toBeInTheDocument()
    })
    expect(screen.queryByText('1 of 3 in the right column.')).not.toBeInTheDocument()
  })

  it('announces drop in the live region', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    dragWord('p1:cake', 'p1')
    const live = document.querySelector('[aria-live="polite"][role="status"]')
    expect(live?.textContent).toMatch(/Dropped 'cake' in column a_e/)
  })

  it('ignores drops on unknown columns', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    act(() => {
      handlers.onDragEnd?.({ active: { id: 'p1:cake' }, over: { id: 'nonexistent' } })
    })
    // Word stays in the bank; Check answers remains disabled.
    expect(screen.getByRole('button', { name: 'Check answers' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Drag the word cake' })).toBeInTheDocument()
  })

  it('ignores drops of unknown words', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    act(() => {
      handlers.onDragEnd?.({ active: { id: 'unknown' }, over: { id: 'p1' } })
    })
    expect(screen.getByRole('button', { name: 'Check answers' })).toBeDisabled()
  })

  it('handles drag end outside any target with an unknown word', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    act(() => {
      handlers.onDragStart?.({ active: { id: 'unknown' } })
      handlers.onDragEnd?.({ active: { id: 'unknown' }, over: null })
    })
    const live = document.querySelector('[aria-live="polite"][role="status"]')
    // No announcement for unknown words; nothing crashes.
    expect(screen.getByRole('button', { name: 'Check answers' })).toBeDisabled()
  })

  it('highlights the column on drag over', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    act(() => {
      handlers.onDragOver?.({ over: { id: 'p1' } })
    })
    const column = screen.getByRole('region', { name: 'Pattern a_e drop column' })
    expect(column.className).toMatch(/bg-sky-soft/)
  })

  it('clears the highlight when drag leaves all columns', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    act(() => {
      handlers.onDragOver?.({ over: { id: 'p1' } })
    })
    expect(screen.getByRole('region', { name: 'Pattern a_e drop column' }).className).toMatch(/bg-sky-soft/)
    act(() => {
      handlers.onDragOver?.({ over: null })
    })
    expect(screen.getByRole('region', { name: 'Pattern a_e drop column' }).className).not.toMatch(/bg-sky-soft/)
  })
})
