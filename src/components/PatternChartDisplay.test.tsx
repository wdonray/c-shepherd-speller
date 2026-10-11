import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import PatternChartDisplay from './PatternChartDisplay'
import type { WordList } from '@/models/WordList'

const { speak } = vi.hoisted(() => ({ speak: vi.fn() }))
vi.mock('@/lib/tts', () => ({ speak }))

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5: Long A',
  patterns: [
    { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'] },
    { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'less-common', words: ['rain'] },
    { id: 'p3', sound: 'long a', pattern: 'eigh', frequency: 'rare', words: ['eight'], isOddDuck: true },
  ],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('PatternChartDisplay', () => {
  it('shows the list name as the header, not a sound', () => {
    render(<PatternChartDisplay list={list} />)
    expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    expect(screen.queryByText('long a')).not.toBeInTheDocument()
  })

  it('shows the list name even when patterns disagree on sound', () => {
    const mixed: WordList = {
      ...list,
      patterns: [
        { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake'] },
        { id: 'p2', sound: 'short e', pattern: 'e', frequency: 'common', words: ['bed'] },
        { id: 'p3', sound: 'long a', pattern: 'ai', frequency: 'common', words: ['rain'] },
      ],
    }
    render(<PatternChartDisplay list={mixed} />)
    expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    expect(screen.queryByText('long a')).not.toBeInTheDocument()
    expect(screen.queryByText('short e')).not.toBeInTheDocument()
  })

  it('falls back to Untitled list when the list has no name', () => {
    render(<PatternChartDisplay list={{ ...list, name: '' }} />)
    expect(screen.getByText('Untitled list')).toBeInTheDocument()
  })

  it('renders one column per pattern, most common first, all equal width', () => {
    render(<PatternChartDisplay list={list} />)
    const aE = screen.getByRole('region', { name: 'Pattern a_e' })
    const ai = screen.getByRole('region', { name: 'Pattern ai' })
    const eigh = screen.getByRole('region', { name: 'Pattern eigh' })
    expect(aE).toBeInTheDocument()
    expect(ai).toBeInTheDocument()
    // Common sorts before less-common before rare.
    expect(aE.compareDocumentPosition(ai) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(ai.compareDocumentPosition(eigh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    // Equal widths regardless of frequency: the grid caps at 3 columns per
    // row and wraps, so every column takes an equal grid track.
    const columns = document.querySelector('[data-chart-columns]')
    expect(columns).toHaveClass('grid', 'grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3')
    // Power bars and frequency labels encode commonness.
    expect(within(aE).getByRole('img', { name: 'Frequency: Common' })).toBeInTheDocument()
    expect(within(aE).getByText('Common')).toBeInTheDocument()
    expect(within(ai).getByText('Less common')).toBeInTheDocument()
    expect(within(eigh).getByText('Rare')).toBeInTheDocument()
  })

  it('explains the frequency encoding in the caption', () => {
    render(<PatternChartDisplay list={list} />)
    expect(
      screen.getByText(/Patterns are ordered by how common the spelling is; longer bars mean more common/)
    ).toBeInTheDocument()
  })

  it('opens the word analysis when a word card is tapped', () => {
    render(<PatternChartDisplay list={list} />)
    fireEvent.click(screen.getByRole('button', { name: 'Analyze the word cake' }))
    expect(screen.getByRole('dialog', { name: 'Word analysis for cake' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Close word analysis' }))
    expect(screen.queryByRole('dialog', { name: 'Word analysis for cake' })).not.toBeInTheDocument()
  })

  it('speaks the word when the hear button is pressed', () => {
    render(<PatternChartDisplay list={list} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hear the word cake' }))
    expect(speak).toHaveBeenCalledWith('cake')
    expect(screen.queryByRole('dialog', { name: 'Word analysis for cake' })).not.toBeInTheDocument()
  })

  it('does not show an odd duck band even when a pattern has isOddDuck set', () => {
    render(<PatternChartDisplay list={list} />)
    expect(screen.queryByRole('region', { name: 'Odd ducks' })).not.toBeInTheDocument()
    // The pattern gets a regular column instead
    expect(screen.getByRole('region', { name: 'Pattern eigh' })).toBeInTheDocument()
  })

  it('marks word-level odd ducks in the print variant', () => {
    const oddList: WordList = {
      ...list,
      patterns: [
        { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'], oddDucks: ['cake'] },
      ],
    }
    render(<PatternChartDisplay list={oddList} variant="print" />)
    expect(screen.getByRole('region', { name: 'Odd ducks' })).toBeInTheDocument()
    // Print variant renders words as plain list items, odd ducks get plum styling.
    const items = screen.getAllByRole('listitem')
    const cakeItem = items.find((li) => li.textContent === 'cake')
    expect(cakeItem?.className).toMatch(/border-plum/)
  })

  it('marks word-level odd ducks with plum styling and an odd ducks section', () => {
    const oddList: WordList = {
      ...list,
      patterns: [
        { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'], oddDucks: ['cake'] },
        { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'less-common', words: ['rain'] },
      ],
    }
    render(<PatternChartDisplay list={oddList} />)
    const section = screen.getByRole('region', { name: 'Odd ducks' })
    expect(section).toBeInTheDocument()
    expect(section).toHaveTextContent('cake')
    expect(section).toHaveTextContent('these spellings do not follow the patterns')
    // The odd-duck word card gets plum styling in its column.
    const cakeCard = screen.getByRole('button', { name: 'Analyze the word cake' }).closest('li')
    expect(cakeCard?.className).toMatch(/border-plum/)
    const bakeCard = screen.getByRole('button', { name: 'Analyze the word bake' }).closest('li')
    expect(bakeCard?.className).not.toMatch(/border-plum/)
  })

  it('shows an empty state when the list has no patterns', () => {
    render(<PatternChartDisplay list={{ ...list, patterns: [] }} />)
    expect(screen.getByText(/No patterns in this list yet/)).toBeInTheDocument()
  })

  it('stays light inside the force-light wrapper', () => {
    const { container } = render(<PatternChartDisplay list={list} />)
    expect(container.firstChild).toHaveClass('force-light')
  })

  it('gives word cards a visible hover and matching focus-visible treatment, motion-free', () => {
    render(<PatternChartDisplay list={list} />)
    const card = screen.getByRole('button', { name: 'Analyze the word cake' })
    expect(card).toHaveClass(
      'hover:bg-sky-soft',
      'focus-visible:bg-sky-soft',
      'focus-visible:ring-[3px]',
      'focus-visible:ring-ring/60'
    )
    // No hover translate/lift: it would fight the press effect and break the
    // flat-card convention on projectors.
    expect(card.className).not.toMatch(/hover:translate-/)
  })

  it('renders no lock toggles when onToggleLock is absent', () => {
    render(<PatternChartDisplay list={list} />)
    expect(screen.queryByRole('button', { name: /lock pattern/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /unlock pattern/i })).not.toBeInTheDocument()
  })

  it('renders a lock toggle in each column header when onToggleLock is provided', () => {
    render(<PatternChartDisplay list={list} onToggleLock={vi.fn()} />)
    const toggle = screen.getByRole('button', { name: 'Lock pattern a_e' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    // 44px minimum touch target.
    expect(toggle).toHaveClass('min-h-[44px]', 'min-w-[44px]')
  })

  it('calls onToggleLock with the pattern id when a header toggle is pressed', () => {
    const onToggleLock = vi.fn()
    render(<PatternChartDisplay list={list} onToggleLock={onToggleLock} />)
    fireEvent.click(screen.getByRole('button', { name: 'Lock pattern ai' }))
    expect(onToggleLock).toHaveBeenCalledTimes(1)
    expect(onToggleLock).toHaveBeenCalledWith('p2')
  })

  it('renders a locked pattern as a locked placeholder that keeps its position and width', () => {
    const locked: WordList = {
      ...list,
      patterns: [
        { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'] },
        { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'less-common', words: ['rain'], isLocked: true },
        { id: 'p3', sound: 'long a', pattern: 'eigh', frequency: 'rare', words: ['eight'] },
      ],
    }
    render(<PatternChartDisplay list={locked} onToggleLock={vi.fn()} />)

    // Pattern name and words hidden.
    expect(screen.queryByRole('region', { name: 'Pattern ai' })).not.toBeInTheDocument()
    expect(screen.queryByText('ai')).not.toBeInTheDocument()
    expect(screen.queryByText('rain')).not.toBeInTheDocument()

    // Placeholder present with lock icon and label.
    const placeholders = screen.getAllByRole('region', { name: 'Locked pattern' })
    expect(placeholders).toHaveLength(1)
    expect(within(placeholders[0]).getByText('Locked')).toBeInTheDocument()

    // Position kept: still between a_e and eigh, in frequency order.
    const aE = screen.getByRole('region', { name: 'Pattern a_e' })
    const eigh = screen.getByRole('region', { name: 'Pattern eigh' })
    expect(aE.compareDocumentPosition(placeholders[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(placeholders[0].compareDocumentPosition(eigh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    // Same equal-width footprint in the grid, so toggling causes no layout
    // reflow: no flex sizing leaks into the grid columns.
    expect(placeholders[0].style.flexGrow).toBe('')
    expect(placeholders[0]).toHaveClass('min-w-0')
  })

  it('shows an unlock toggle for a locked pattern', () => {
    const onToggleLock = vi.fn()
    const locked: WordList = {
      ...list,
      patterns: list.patterns.map((p) => (p.id === 'p2' ? { ...p, isLocked: true } : p)),
    }
    render(<PatternChartDisplay list={locked} onToggleLock={onToggleLock} />)
    const toggle = screen.getByRole('button', { name: 'Unlock pattern ai' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(toggle)
    expect(onToggleLock).toHaveBeenCalledWith('p2')
  })

  it('renders a locked placeholder without an unlock button when onToggleLock is absent', () => {
    const locked: WordList = {
      ...list,
      patterns: [{ ...list.patterns[0], isLocked: true }],
    }
    render(<PatternChartDisplay list={locked} />)
    expect(screen.getByRole('region', { name: 'Locked pattern' })).toBeInTheDocument()
    expect(screen.getByText('Locked')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /unlock pattern/i })).not.toBeInTheDocument()
  })

  it('shows a friendly message when every pattern is locked', () => {
    const allLocked: WordList = {
      ...list,
      patterns: list.patterns.map((p) => ({ ...p, isLocked: true })),
    }
    render(<PatternChartDisplay list={allLocked} onToggleLock={vi.fn()} />)
    expect(screen.getByText('All patterns are locked. Unlock a pattern to begin.')).toBeInTheDocument()
    // Locked placeholders still render so each pattern can be unlocked.
    expect(screen.getAllByRole('region', { name: 'Locked pattern' })).toHaveLength(3)
  })

  it('renders the keyword emoji large above the pattern name when set', () => {
    const withEmoji: WordList = {
      ...list,
      patterns: [{ ...list.patterns[0], keywordEmoji: '🐝' }, ...list.patterns.slice(1)],
    }
    render(<PatternChartDisplay list={withEmoji} onToggleLock={vi.fn()} />)
    const column = screen.getByRole('region', { name: 'Pattern a_e' })
    const emoji = within(column).getByRole('img', { name: 'Keyword image for pattern a_e' })
    expect(emoji).toHaveTextContent('🐝')
    expect(emoji).toHaveClass('text-5xl')
    // It sits above the pattern name inside the same header.
    const heading = within(column).getByRole('heading', { name: 'a_e' })
    expect(emoji.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('renders the uploaded photo in the header, taking precedence over the emoji', () => {
    const withPhoto: WordList = {
      ...list,
      patterns: [
        { ...list.patterns[0], keywordImage: 'data:image/jpeg;base64,photo', keywordEmoji: '🐝' },
        ...list.patterns.slice(1),
      ],
    }
    render(<PatternChartDisplay list={withPhoto} onToggleLock={vi.fn()} />)
    const column = screen.getByRole('region', { name: 'Pattern a_e' })
    const photo = within(column).getByRole('img', { name: 'Keyword image for pattern a_e' })
    expect(photo.tagName).toBe('IMG')
    expect(photo).toHaveAttribute('src', 'data:image/jpeg;base64,photo')
    // The emoji is not rendered when a photo is present.
    expect(within(column).queryByText('🐝')).not.toBeInTheDocument()
    // It sits above the pattern name inside the same header.
    const heading = within(column).getByRole('heading', { name: 'a_e' })
    expect(photo.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('hides the keyword photo behind the locked placeholder when the pattern is locked', () => {
    const locked: WordList = {
      ...list,
      patterns: [{ ...list.patterns[0], keywordImage: 'data:image/jpeg;base64,photo', isLocked: true }],
    }
    render(<PatternChartDisplay list={locked} onToggleLock={vi.fn()} />)
    expect(screen.queryByRole('img', { name: /keyword image/i })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Locked pattern' })).toBeInTheDocument()
  })

  it('renders the keyword photo in the print variant', () => {
    const withPhoto: WordList = {
      ...list,
      patterns: [{ ...list.patterns[0], keywordImage: 'data:image/jpeg;base64,photo' }, ...list.patterns.slice(1)],
    }
    render(<PatternChartDisplay list={withPhoto} variant="print" onToggleLock={vi.fn()} />)
    const photo = screen.getByRole('img', { name: 'Keyword image for pattern a_e' })
    expect(photo.tagName).toBe('IMG')
    expect(photo).toHaveAttribute('src', 'data:image/jpeg;base64,photo')
  })

  it('renders no keyword image and keeps the header layout when unset', () => {
    render(<PatternChartDisplay list={list} onToggleLock={vi.fn()} />)
    const column = screen.getByRole('region', { name: 'Pattern a_e' })
    expect(within(column).queryByRole('img', { name: /keyword image/i })).not.toBeInTheDocument()
    // Header is unchanged: name, lock toggle, and power bar all present.
    expect(within(column).getByRole('heading', { name: 'a_e' })).toBeInTheDocument()
    expect(within(column).getByRole('button', { name: 'Lock pattern a_e' })).toBeInTheDocument()
    expect(within(column).getByRole('img', { name: 'Frequency: Common' })).toBeInTheDocument()
  })

  it('hides the keyword emoji behind the locked placeholder when the pattern is locked', () => {
    const locked: WordList = {
      ...list,
      patterns: [{ ...list.patterns[0], keywordEmoji: '🐝', isLocked: true }],
    }
    render(<PatternChartDisplay list={locked} onToggleLock={vi.fn()} />)
    expect(screen.queryByRole('img', { name: /keyword image/i })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Locked pattern' })).toBeInTheDocument()
  })

  describe('print variant', () => {
    const withEmoji: WordList = {
      ...list,
      patterns: [{ ...list.patterns[0], keywordEmoji: '🐝' }, ...list.patterns.slice(1)],
    }

    it('keeps the side-by-side flex row instead of the wrapping grid', () => {
      render(<PatternChartDisplay list={withEmoji} variant="print" onToggleLock={vi.fn()} />)
      const columns = document.querySelector('[data-chart-columns]')
      expect(columns).toHaveClass('flex', 'lg:flex-row')
      expect(columns).not.toHaveClass('grid', 'lg:grid-cols-3')
      const firstColumn = screen.getByRole('region', { name: 'Pattern a_e' })
      expect(firstColumn).toHaveStyle({ flexGrow: '1', flexBasis: '0' })
    })

    it('renders words as plain text with no buttons, speakers, or lock toggles', () => {
      render(<PatternChartDisplay list={withEmoji} variant="print" onToggleLock={vi.fn()} />)
      expect(screen.queryByRole('button')).not.toBeInTheDocument()
      const cake = screen.getByText('cake')
      expect(cake).toBeInTheDocument()
      expect(cake.closest('li')?.tagName).toBe('LI')
      expect(cake.closest('button')).toBeNull()
      // Lock toggles are interactive, so they are hidden even with onToggleLock.
      expect(screen.queryByRole('button', { name: /lock pattern/i })).not.toBeInTheDocument()
    })

    it('excludes locked patterns entirely from the printed poster', () => {
      const locked: WordList = {
        ...list,
        patterns: [{ ...list.patterns[0], isLocked: true }, ...list.patterns.slice(1)],
      }
      render(<PatternChartDisplay list={locked} variant="print" />)
      expect(screen.queryByRole('region', { name: 'Pattern a_e' })).not.toBeInTheDocument()
      expect(screen.queryByText('cake')).not.toBeInTheDocument()
      // Unlocked patterns still render in frequency order.
      const ai = screen.getByRole('region', { name: 'Pattern ai' })
      const eigh = screen.getByRole('region', { name: 'Pattern eigh' })
      expect(ai.compareDocumentPosition(eigh) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      // No locked placeholder in print.
      expect(screen.queryByRole('region', { name: 'Locked pattern' })).not.toBeInTheDocument()
    })

    it('shows a message instead of an empty chart when every pattern is locked', () => {
      const allLocked: WordList = {
        ...list,
        patterns: list.patterns.map((p) => ({ ...p, isLocked: true })),
      }
      render(<PatternChartDisplay list={allLocked} variant="print" />)
      expect(screen.getByText(/All patterns are locked, so there is nothing to print/)).toBeInTheDocument()
      expect(screen.queryByRole('region')).not.toBeInTheDocument()
    })

    it('shows the no-patterns message in print when the list is empty', () => {
      render(<PatternChartDisplay list={{ ...list, patterns: [] }} variant="print" />)
      expect(screen.getByText(/No patterns in this list yet/)).toBeInTheDocument()
    })

    it('shows the list name, large emoji, power bar, and frequency label per column', () => {
      render(<PatternChartDisplay list={withEmoji} variant="print" />)
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
      expect(screen.queryByText('long a')).not.toBeInTheDocument()
      const column = screen.getByRole('region', { name: 'Pattern a_e' })
      const emoji = within(column).getByRole('img', { name: 'Keyword image for pattern a_e' })
      expect(emoji).toHaveTextContent('🐝')
      expect(emoji).toHaveClass('text-5xl')
      expect(within(column).getByRole('img', { name: 'Frequency: Common' })).toBeInTheDocument()
      expect(within(column).getByText('Common')).toBeInTheDocument()
      // Columns stay in frequency order, most common first.
      const ai = screen.getByRole('region', { name: 'Pattern ai' })
      expect(column.compareDocumentPosition(ai) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    })

    it('hides the interactive caption in print', () => {
      render(<PatternChartDisplay list={list} variant="print" />)
      expect(screen.queryByText(/Tap a word to see its analysis/)).not.toBeInTheDocument()
    })

    it('adds the print-chart hook class to the root', () => {
      const { container } = render(<PatternChartDisplay list={list} variant="print" />)
      expect(container.firstChild).toHaveClass('print-chart', 'force-light')
    })
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

    it('colors columns by sound type: vowels green, consonants red, bossy R blue', () => {
      render(<PatternChartDisplay list={mixedList} />)
      expect(screen.getByRole('region', { name: 'Pattern ee' })).toHaveClass('border-leaf')
      expect(screen.getByRole('region', { name: 'Pattern sh' })).toHaveClass('border-coral')
      expect(screen.getByRole('region', { name: 'Pattern ar' })).toHaveClass('border-sky')
    })

    it('keeps the sound-type border on locked columns', () => {
      const locked: WordList = {
        ...mixedList,
        patterns: [{ id: 'p1', sound: 'sh', pattern: 'sh', frequency: 'common', words: ['ship'], isLocked: true }],
      }
      render(<PatternChartDisplay list={locked} />)
      expect(screen.getByRole('region', { name: 'Locked pattern' })).toHaveClass('border-coral')
    })

    it('renders power bars in a neutral color: frequency is length-only', () => {
      const { container } = render(<PatternChartDisplay list={mixedList} />)
      const filled = container.querySelectorAll('[data-power-segment][data-filled="true"]')
      expect(filled.length).toBeGreaterThan(0)
      for (const seg of filled) {
        expect(seg).toHaveClass('bg-ink')
      }
    })
  })
})
