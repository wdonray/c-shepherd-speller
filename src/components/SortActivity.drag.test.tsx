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
      isDragging: id === 'p1:cake',
    }),
    useDroppable: () => ({ setNodeRef: vi.fn(), isOver: false }),
  }
})

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Translate: { toString: () => '' } },
}))

const playCorrectSound = vi.fn()
const playIncorrectSound = vi.fn()

vi.mock('@/lib/sound-effects', () => ({
  playCorrectSound,
  playIncorrectSound,
  playPickupSound: vi.fn(),
  playDropSound: vi.fn(),
  playWinFanfare: vi.fn(),
  isSoundEnabled: () => true,
  setSoundEnabled: vi.fn(),
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
    vi.clearAllMocks()
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
    dragWord('p1:cake', null)
    const live = document.querySelector('[aria-live="polite"][role="status"]')
    expect(live?.textContent).toMatch(/back in the word bank|Picked up/)
  })

  it('places a word in a column on drag end', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    const cakeButton = screen.getByRole('button', { name: 'Drag the word cake' })
    expect(cakeButton).toBeInTheDocument()
    dragWord('p1:cake', 'p1')
    // Word leaves the tray; feedback appears immediately.
    await waitFor(() => {
      expect(playCorrectSound).toHaveBeenCalledTimes(1)
    })
  })

  it('gives immediate correct feedback on a correct drop', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    dragWord('p1:cake', 'p1')
    await waitFor(() => {
      expect(playCorrectSound).toHaveBeenCalledTimes(1)
      expect(playIncorrectSound).not.toHaveBeenCalled()
    })
    const live = document.querySelector('[aria-live="polite"][role="status"]')
    expect(live?.textContent).toContain('cake is correct in a_e')
    // Correct badge appears.
    expect(screen.getAllByLabelText('Correct')).toHaveLength(1)
  })

  it('gives immediate incorrect feedback on a wrong drop', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    dragWord('p1:cake', 'p2')
    await waitFor(() => {
      expect(playIncorrectSound).toHaveBeenCalledTimes(1)
      expect(playCorrectSound).not.toHaveBeenCalled()
    })
    const live = document.querySelector('[aria-live="polite"][role="status"]')
    expect(live?.textContent).toContain('does not go with')
    // Incorrect badge appears; tile stays in the column.
    expect(screen.getAllByLabelText('Incorrect')).toHaveLength(1)
  })

  it('try again returns all words to the bank', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    dragWord('p1:cake', 'p1')
    dragWord('p1:bake', 'p2')

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Drag the word cake' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Drag the word bake' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Drag the word rain' })).toBeInTheDocument()
    })
  })

  it('announces drop in the live region', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    dragWord('p1:cake', 'p1')
    const live = document.querySelector('[aria-live="polite"][role="status"]')
    expect(live?.textContent).toMatch(/cake is correct in a_e/)
  })

  it('ignores drops on unknown columns', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    act(() => {
      handlers.onDragEnd?.({ active: { id: 'p1:cake' }, over: { id: 'nonexistent' } })
    })
    // Word stays in the bank.
    expect(screen.getByRole('button', { name: 'Drag the word cake' })).toBeInTheDocument()
  })

  it('ignores drops of unknown words', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    act(() => {
      handlers.onDragEnd?.({ active: { id: 'unknown' }, over: { id: 'p1' } })
    })
    expect(screen.getByRole('button', { name: 'Drag the word cake' })).toBeInTheDocument()
  })

  it('handles drag end outside any target with an unknown word', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    act(() => {
      handlers.onDragStart?.({ active: { id: 'unknown' } })
      handlers.onDragEnd?.({ active: { id: 'unknown' }, over: null })
    })
    // Nothing crashes.
    expect(screen.getByRole('button', { name: 'Drag the word cake' })).toBeInTheDocument()
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
