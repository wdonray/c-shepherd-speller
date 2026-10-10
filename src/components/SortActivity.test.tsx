import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import SortActivity from './SortActivity'
import type { WordList } from '@/models/WordList'

const dndHandlers: {
  onDragStart?: (e: { active: { id: string } }) => void
  onDragOver?: (e: { over: { id: string } | null }) => void
  onDragEnd?: (e: { active: { id: string }; over: { id: string } | null }) => void
} = {}
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return {
    ...actual,
    DndContext: ({
      children,
      onDragStart,
      onDragOver,
      onDragEnd,
    }: {
      children: React.ReactNode
      onDragStart?: (e: { active: { id: string } }) => void
      onDragOver?: (e: { over: { id: string } | null }) => void
      onDragEnd?: (e: { active: { id: string }; over: { id: string } | null }) => void
    }) => {
      dndHandlers.onDragStart = onDragStart
      dndHandlers.onDragOver = onDragOver
      dndHandlers.onDragEnd = onDragEnd
      return <>{children}</>
    },
    DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

const { playCorrectSound, playIncorrectSound } = vi.hoisted(() => ({
  playCorrectSound: vi.fn(),
  playIncorrectSound: vi.fn(),
}))
vi.mock('@/lib/sound-effects', () => ({
  playCorrectSound,
  playIncorrectSound,
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
    { id: 'p3', sound: 'long a', pattern: 'odd', frequency: 'rare', words: ['said'], isOddDuck: true },
  ],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('SortActivity', () => {
  beforeEach(() => {
    playCorrectSound.mockClear()
    playIncorrectSound.mockClear()
  })

  it('starts with all sortable words in the bank and empty columns', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    expect(screen.getByText('Sort the words')).toBeInTheDocument()
    expect(screen.getByText('Word bank')).toBeInTheDocument()
    // All 3 sortable words in the bank.
    expect(screen.getByRole('button', { name: 'Drag the word cake' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drag the word bake' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drag the word rain' })).toBeInTheDocument()
    // Former odd duck words are now in the bank like any other word.
    expect(screen.getByRole('button', { name: 'Drag the word said' })).toBeInTheDocument()
    // Columns show drop targets.
    expect(screen.getAllByText('Drop words here')).toHaveLength(3)
  })

  it('does not show an odd ducks section even when a pattern has isOddDuck set', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    expect(screen.queryByText('Odd ducks, already placed')).not.toBeInTheDocument()
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

  it('highlights the word bank when dragging over it', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    dndHandlers.onDragStart?.({ active: { id: 'p1:cake' } })
    dndHandlers.onDragOver?.({ over: { id: 'word-bank' } })
    await waitFor(() => {
      const bank = screen.getByLabelText('Word bank drop area')
      expect(bank.className).toContain('border-sky-deep')
    })
  })

  it('does nothing when an unplaced word is dropped in the word bank', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    const live = document.querySelector('[aria-live="polite"][role="status"]')
    dndHandlers.onDragEnd?.({ active: { id: 'p1:cake' }, over: { id: 'word-bank' } })
    await waitFor(() => {
      expect(live?.textContent).toContain('back in the word bank')
    })
    expect(screen.getByRole('button', { name: 'Check answers' })).toBeDisabled()
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

  it('plays the correct sound when all answers are right', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    act(() => {
      dndHandlers.onDragEnd?.({ active: { id: 'p1:cake' }, over: { id: 'p1' } })
      dndHandlers.onDragEnd?.({ active: { id: 'p1:bake' }, over: { id: 'p1' } })
      dndHandlers.onDragEnd?.({ active: { id: 'p2:rain' }, over: { id: 'p2' } })
      dndHandlers.onDragEnd?.({ active: { id: 'p3:said' }, over: { id: 'p3' } })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))

    await waitFor(() => {
      expect(screen.getAllByText('4 of 4 in the right column.').length).toBeGreaterThanOrEqual(1)
    })
    expect(playCorrectSound).toHaveBeenCalledTimes(1)
    expect(playIncorrectSound).not.toHaveBeenCalled()
  })

  it('plays the incorrect sound when any answer is wrong', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    act(() => {
      dndHandlers.onDragEnd?.({ active: { id: 'p1:cake' }, over: { id: 'p2' } })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))

    await waitFor(() => {
      expect(screen.getAllByText('0 of 4 in the right column.').length).toBeGreaterThanOrEqual(1)
    })
    expect(playIncorrectSound).toHaveBeenCalledTimes(1)
    expect(playCorrectSound).not.toHaveBeenCalled()
  })

  it('try again returns all words to the word bank', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    act(() => {
      dndHandlers.onDragEnd?.({ active: { id: 'p1:cake' }, over: { id: 'p1' } })
      dndHandlers.onDragEnd?.({ active: { id: 'p1:bake' }, over: { id: 'p2' } })
    })

    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Drag the word cake' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Drag the word bake' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Drag the word rain' })).toBeInTheDocument()
    })
    // Placements cleared, so Check answers is disabled again and the score is gone.
    expect(screen.getByRole('button', { name: 'Check answers' })).toBeDisabled()
    expect(screen.queryByText(/in the right column\./)).not.toBeInTheDocument()
    const live = document.querySelector('[aria-live="polite"][role="status"]')
    expect(live?.textContent).toContain('All words returned to the word bank')
  })

  describe('sound-type column colors', () => {
    const mixedList: WordList = {
      id: 'l2',
      userId: 'u1',
      name: 'Mixed sounds',
      patterns: [
        { id: 'p1', sound: 'long e', pattern: 'ee', frequency: 'common', words: ['see'] },
        { id: 'p2', sound: 'sh', pattern: 'sh', frequency: 'common', words: ['ship'] },
        { id: 'p3', sound: 'ar', pattern: 'ar', frequency: 'common', words: ['car'] },
      ],
      createdAt: '2026-10-06T00:00:00.000Z',
      updatedAt: '2026-10-06T00:00:00.000Z',
    }

    it('colors drop columns by sound type, matching the display page', () => {
      render(<SortActivity list={mixedList} onExit={vi.fn()} />)
      expect(screen.getByRole('region', { name: 'Pattern ee drop column' })).toHaveClass('border-leaf')
      expect(screen.getByRole('region', { name: 'Pattern sh drop column' })).toHaveClass('border-coral')
      expect(screen.getByRole('region', { name: 'Pattern ar drop column' })).toHaveClass('border-sky')
    })

    it('renders power bars in a neutral color', () => {
      const { container } = render(<SortActivity list={mixedList} onExit={vi.fn()} />)
      const filled = container.querySelectorAll('[data-power-segment][data-filled="true"]')
      expect(filled.length).toBeGreaterThan(0)
      for (const seg of filled) {
        expect(seg).toHaveClass('bg-ink')
      }
    })
  })
})
