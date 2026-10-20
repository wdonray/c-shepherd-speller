import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import PatternChartDisplay from './PatternChartDisplay'
import type { WordList } from '@/models/WordList'

const { speak } = vi.hoisted(() => ({ speak: vi.fn() }))
vi.mock('@/lib/tts', () => ({ speak }))

const { useBlockedVideos } = vi.hoisted(() => ({ useBlockedVideos: vi.fn() }))
vi.mock('@/hooks/useBlockedVideos', () => ({ useBlockedVideos }))

function mockBlockedVideos(
  overrides: {
    blockedVideoIds?: Set<string>
    userId?: string | null
    blockVideo?: ReturnType<typeof vi.fn>
  } = {}
) {
  const blockVideo = overrides.blockVideo ?? vi.fn()
  useBlockedVideos.mockReturnValue({
    blockedVideos: [],
    blockedVideoIds: overrides.blockedVideoIds ?? new Set<string>(),
    isLoaded: true,
    userId: overrides.userId ?? null,
    blockVideo,
    unblockVideo: vi.fn(),
  })
  return { blockVideo }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockBlockedVideos()
})

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5: Long A',
  patterns: [
    { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'] },
    { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'less-common', words: ['rain'] },
    { id: 'p3', sound: 'long a', pattern: 'eigh', frequency: 'rare', words: ['eight'] },
  ],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('PatternChartDisplay', () => {
  it('shows the list name as the chart header, with each pattern sound under its pattern (issue #379)', () => {
    render(<PatternChartDisplay list={list} />)
    expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    const aE = screen.getByRole('region', { name: 'Pattern a_e' })
    expect(within(aE).getByText('long a')).toBeInTheDocument()
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
    // Issue #379: each column shows its own pattern's sound under the pattern.
    expect(within(screen.getByRole('region', { name: 'Pattern a_e' })).getByText('long a')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Pattern e' })).getByText('short e')).toBeInTheDocument()
  })

  it('does not show pattern sounds in the print variant (issue #379 scopes to present and sort)', () => {
    render(<PatternChartDisplay list={list} variant="print" />)
    expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    expect(screen.queryByText('long a')).not.toBeInTheDocument()
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
    expect(columns).toHaveClass(
      'grid',
      'grid-cols-1',
      'sm:grid-cols-[repeat(2,minmax(0,420px))]',
      'lg:grid-cols-[repeat(3,minmax(0,420px))]'
    )
    // Power bars and frequency labels encode commonness.
    expect(within(aE).getByRole('img', { name: 'Frequency: Common' })).toBeInTheDocument()
    expect(within(aE).getByText('Common')).toBeInTheDocument()
    expect(within(ai).getByText('Less common')).toBeInTheDocument()
    expect(within(eigh).getByText('Rare')).toBeInTheDocument()
  })

  describe('present-mode column sizing', () => {
    const [firstPattern, secondPattern] = list.patterns

    it('renders a single pattern as one centered, width-capped track', () => {
      render(<PatternChartDisplay list={{ ...list, patterns: [firstPattern] }} />)
      const row = document.querySelector('[data-chart-columns]')
      expect(row).toHaveClass('mx-auto', 'max-w-[1400px]', 'justify-center', 'sm:grid-cols-[minmax(0,420px)]')
      expect(row).not.toHaveClass('lg:grid-cols-[repeat(3,minmax(0,420px))]')
    })

    it('renders two patterns as two centered, width-capped tracks', () => {
      render(<PatternChartDisplay list={{ ...list, patterns: [firstPattern, secondPattern] }} />)
      const row = document.querySelector('[data-chart-columns]')
      expect(row).toHaveClass('mx-auto', 'max-w-[1400px]', 'justify-center', 'sm:grid-cols-[repeat(2,minmax(0,420px))]')
      expect(row).not.toHaveClass('lg:grid-cols-[repeat(3,minmax(0,420px))]')
    })

    it('keeps the print poster on the uncapped flex row', () => {
      render(<PatternChartDisplay list={list} variant="print" />)
      const row = document.querySelector('[data-chart-columns]')
      expect(row).toHaveClass('flex')
      expect(row).not.toHaveClass('grid', 'mx-auto', 'max-w-[1400px]', 'justify-center')
    })
  })

  it('does not render a helper caption under the chart (issue #373)', () => {
    render(<PatternChartDisplay list={list} />)
    expect(screen.queryByText(/Tap a word to see its analysis/)).not.toBeInTheDocument()
    expect(screen.queryByText(/longer bars mean more common/)).not.toBeInTheDocument()
  })

  it('renders words as chips in a responsive grid (issue #488)', () => {
    render(<PatternChartDisplay list={list} />)
    // 2 columns on mobile, 3 on desktop, nested inside each pattern column.
    const column = screen.getByRole('region', { name: 'Pattern a_e' })
    const grid = column.querySelector('ul')
    expect(grid).toHaveClass('grid', 'grid-cols-2', 'md:grid-cols-3')
    // Each word is one chip; the whole chip is the audio tap target.
    const chip = screen.getByRole('button', { name: 'Hear the word cake' })
    expect(chip.closest('li')).not.toBeNull()
  })

  it('speaks the word when the chip is tapped (issue #488)', () => {
    render(<PatternChartDisplay list={list} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hear the word cake' }))
    expect(speak).toHaveBeenCalledWith('cake')
  })

  it('gives every chip a visible audio affordance and a 44px-plus touch target (issue #488)', () => {
    render(<PatternChartDisplay list={list} />)
    const chip = screen.getByRole('button', { name: 'Hear the word cake' })
    // The speaker icon tells teachers the chip is tappable.
    expect(chip.querySelector('svg')).not.toBeNull()
    // Present-mode chips run larger than the 44px minimum for arm's-length
    // tapping on the projector.
    expect(chip).toHaveClass('min-h-[56px]')
  })

  it('opens no word analysis from the chart: chips are audio-only (issue #488)', () => {
    render(<PatternChartDisplay list={list} />)
    fireEvent.click(screen.getByRole('button', { name: 'Hear the word cake' }))
    expect(screen.queryByRole('dialog', { name: 'Word analysis for cake' })).not.toBeInTheDocument()
  })

  it('does not show an odd ducks section', () => {
    render(<PatternChartDisplay list={list} />)
    expect(screen.queryByRole('region', { name: 'Odd ducks' })).not.toBeInTheDocument()
    // Every pattern gets a regular column.
    expect(screen.getByRole('region', { name: 'Pattern eigh' })).toBeInTheDocument()
  })

  it('shows an empty state when the list has no patterns', () => {
    render(<PatternChartDisplay list={{ ...list, patterns: [] }} />)
    expect(screen.getByText(/No patterns in this list yet/)).toBeInTheDocument()
  })

  it('stays light inside the force-light wrapper', () => {
    const { container } = render(<PatternChartDisplay list={list} />)
    expect(container.firstChild).toHaveClass('force-light')
  })

  it('keeps word chips flat on hover with matching focus-visible treatment', () => {
    render(<PatternChartDisplay list={list} />)
    const button = screen.getByRole('button', { name: 'Hear the word cake' })
    expect(button).toHaveClass(
      'hover:bg-sky-soft',
      'focus-visible:bg-sky-soft',
      'focus-visible:ring-[3px]',
      'focus-visible:ring-ring/60'
    )
    // Issue #268 moved the hover lift from present-mode word cards to the
    // list picker, so the chip no longer grows or casts a shadow on hover.
    const item = button.closest('li')
    expect(item).not.toHaveClass(
      'hover:z-10',
      'hover:scale-[1.05]',
      'hover:shadow-xl',
      'motion-reduce:hover:scale-100',
      'motion-reduce:hover:shadow-none'
    )
  })

  it('wraps long words inside their chips instead of overflowing (issue #415)', () => {
    const longWord = 'antidisestablishmentarianism'
    const longList: WordList = {
      ...list,
      patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: [longWord] }],
    }
    render(<PatternChartDisplay list={longList} />)
    const button = screen.getByRole('button', { name: `Hear the word ${longWord}` })
    // The chip must be allowed to shrink inside the grid track (min-w-0)
    // and the long word must wrap (break-words); without both, the chip
    // keeps its max-content width and bleeds past the grid track on the
    // projector.
    expect(button).toHaveClass('min-w-0', 'break-words')
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

  it('reserves the keyword visual slot in every column when any pattern has one (issue #420)', () => {
    const withEmoji: WordList = {
      ...list,
      patterns: [{ ...list.patterns[0], keywordEmoji: '🐝' }, ...list.patterns.slice(1)],
    }
    render(<PatternChartDisplay list={withEmoji} onToggleLock={vi.fn()} />)
    // Every column reserves the same fixed-height slot above the rule
    // callout, so the rule boxes share a top edge whether or not the
    // column has its own visual.
    for (const name of ['a_e', 'ai', 'eigh']) {
      const column = screen.getByRole('region', { name: `Pattern ${name}` })
      expect(within(column).getByTestId('keyword-visual-slot')).toHaveClass('h-12')
    }
    // The column with the emoji still shows it inside its slot.
    const emojiColumn = screen.getByRole('region', { name: 'Pattern a_e' })
    expect(within(emojiColumn).getByRole('img', { name: 'Keyword image for pattern a_e' })).toHaveTextContent('🐝')
  })

  it('renders no visual slot when no pattern has a keyword image or emoji (issue #420)', () => {
    render(<PatternChartDisplay list={list} onToggleLock={vi.fn()} />)
    expect(screen.queryByTestId('keyword-visual-slot')).not.toBeInTheDocument()
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

  describe('rule display', () => {
    const listWithRule: WordList = {
      ...list,
      patterns: [
        { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake'], rule: 'Magic e.' },
        { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'less-common', words: ['rain'] },
      ],
    }

    it('shows the unscoped rule under the chart header, display-only', () => {
      render(<PatternChartDisplay list={listWithRule} />)
      // Issue #411: one label per column, on the filled slot and the empty one.
      expect(screen.getAllByText('The rule:')).toHaveLength(2)
      expect(screen.getByText('Magic e.')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
    })

    it('prefers the classroom rule over the unscoped rule', () => {
      render(<PatternChartDisplay list={listWithRule} classRules={{ a_e: 'ai never ends a word.' }} />)
      expect(screen.getByText('Our class figured out:')).toBeInTheDocument()
      expect(screen.getByText('ai never ends a word.')).toBeInTheDocument()
      expect(screen.queryByText('Magic e.')).not.toBeInTheDocument()
    })

    it('shows a No rule yet placeholder when there is no rule', () => {
      render(<PatternChartDisplay list={list} />)
      // One placeholder per pattern column, keeping every column the same size.
      // Issue #411: the empty slot still shows the label so columns line up
      // with the filled rule cards.
      expect(screen.getAllByText('No rule yet')).toHaveLength(3)
      expect(screen.getAllByText('The rule:')).toHaveLength(3)
      expect(screen.queryByText('Our class figured out:')).not.toBeInTheDocument()
    })

    it('shows no placeholder in the print variant', () => {
      render(<PatternChartDisplay list={list} variant="print" />)
      expect(screen.queryByText('No rule yet')).not.toBeInTheDocument()
    })

    it('shows no placeholder when showRules is false', () => {
      render(<PatternChartDisplay list={list} showRules={false} />)
      expect(screen.queryByText('No rule yet')).not.toBeInTheDocument()
    })

    it('hides rules in the print variant', () => {
      render(<PatternChartDisplay list={listWithRule} variant="print" />)
      expect(screen.queryByText('The rule:')).not.toBeInTheDocument()
    })

    it('hides rules when showRules is false', () => {
      render(<PatternChartDisplay list={listWithRule} showRules={false} />)
      expect(screen.queryByText('The rule:')).not.toBeInTheDocument()
      expect(screen.queryByText('Magic e.')).not.toBeInTheDocument()
    })

    it('shows rules by default when showRules is not provided', () => {
      render(<PatternChartDisplay list={listWithRule} />)
      // Issue #411: the empty slot shows the label too.
      expect(screen.getAllByText('The rule:')).toHaveLength(2)
      expect(screen.getByText('Magic e.')).toBeInTheDocument()
    })

    it('shows a pencil edit icon at the right of the callout when onSaveRule is provided (issue #372)', () => {
      const onSaveRule = vi.fn().mockResolvedValue(undefined)
      render(<PatternChartDisplay list={listWithRule} onSaveRule={onSaveRule} />)
      const pencil = screen.getByRole('button', { name: 'Edit rule for a_e' })
      expect(pencil).toBeInTheDocument()
      // The caption sits at the left of the same row.
      const figcaption = pencil.closest('figcaption')
      expect(figcaption).toHaveTextContent('The rule:')
    })

    it('shows no pencil icon without onSaveRule', () => {
      render(<PatternChartDisplay list={listWithRule} />)
      expect(screen.queryByRole('button', { name: 'Edit rule for a_e' })).not.toBeInTheDocument()
    })

    it('shows no pencil icon in the print variant even with onSaveRule', () => {
      render(<PatternChartDisplay list={listWithRule} variant="print" onSaveRule={vi.fn()} />)
      expect(screen.queryByRole('button', { name: 'Edit rule for a_e' })).not.toBeInTheDocument()
    })

    it('shows a pencil icon for a pattern without a rule when onSaveRule is provided (issue #410)', () => {
      const onSaveRule = vi.fn().mockResolvedValue(undefined)
      render(<PatternChartDisplay list={listWithRule} onSaveRule={onSaveRule} />)
      // Pattern ai has no rule; the pencil opens the same editor with an empty draft.
      expect(screen.getByRole('button', { name: 'Edit rule for ai' })).toBeInTheDocument()
    })

    it('opens the rule editor modal from the empty-slot pencil and saves the new rule (issue #410)', async () => {
      const onSaveRule = vi.fn().mockResolvedValue(undefined)
      render(<PatternChartDisplay list={listWithRule} onSaveRule={onSaveRule} />)
      fireEvent.click(screen.getByRole('button', { name: 'Edit rule for ai' }))
      expect(screen.getByRole('dialog', { name: 'Rule for ai' })).toBeInTheDocument()
      expect(screen.getByLabelText('Rule, in the kids’ words')).toHaveValue('')
      fireEvent.change(screen.getByLabelText('Rule, in the kids’ words'), { target: { value: 'New rule.' } })
      fireEvent.click(screen.getByRole('button', { name: 'Done' }))
      await waitFor(() => {
        expect(onSaveRule).toHaveBeenCalledWith('p2', 'ai', 'New rule.')
      })
    })

    it('opens the rule editor modal from the pencil and saves per pattern (issue #372)', async () => {
      const onSaveRule = vi.fn().mockResolvedValue(undefined)
      render(<PatternChartDisplay list={listWithRule} onSaveRule={onSaveRule} />)
      fireEvent.click(screen.getByRole('button', { name: 'Edit rule for a_e' }))
      expect(screen.getByRole('dialog', { name: 'Rule for a_e' })).toBeInTheDocument()
      fireEvent.change(screen.getByLabelText('Rule, in the kids’ words'), { target: { value: 'New rule.' } })
      fireEvent.click(screen.getByRole('button', { name: 'Done' }))
      await waitFor(() => {
        expect(onSaveRule).toHaveBeenCalledWith('p1', 'a_e', 'New rule.')
      })
    })

    it('opens the classroom rule in the modal when the rule is shared', async () => {
      const onSaveRule = vi.fn().mockResolvedValue(undefined)
      render(
        <PatternChartDisplay
          list={listWithRule}
          classRules={{ a_e: 'ai never ends a word.' }}
          className="Period 2"
          onSaveRule={onSaveRule}
        />
      )
      fireEvent.click(screen.getByRole('button', { name: 'Edit rule for a_e' }))
      expect(screen.getByRole('dialog', { name: 'Rule for a_e' })).toBeInTheDocument()
      expect(screen.getByLabelText('Rule, in the kids’ words')).toHaveValue('ai never ends a word.')
      expect(screen.getByText('Shared with Period 2')).toBeInTheDocument()
    })
  })

  describe('word underlines (issue #264)', () => {
    const underlineList: WordList = {
      id: 'l1',
      userId: 'u1',
      name: 'Underlines',
      patterns: [
        { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake'] },
        { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'less-common', words: ['rain'] },
        { id: 'p3', sound: 'long e', pattern: 'ee', frequency: 'common', words: ['bed', 'eel'] },
      ],
      createdAt: '2026-10-06T00:00:00.000Z',
      updatedAt: '2026-10-06T00:00:00.000Z',
    }

    /** The underlined letter runs inside a word button, in order. */
    const underlinedText = (button: HTMLElement): string[] =>
      Array.from(button.querySelectorAll('span'))
        .filter((s) => (s as HTMLElement).style.textDecorationLine === 'underline')
        .map((s) => s.textContent ?? '')

    it('shows no underlines by default', () => {
      render(<PatternChartDisplay list={underlineList} />)
      const button = screen.getByRole('button', { name: 'Hear the word cake' })
      expect(underlinedText(button)).toEqual([])
      expect(button).toHaveTextContent('cake')
    })

    it('underlines the pattern letters when showUnderlines is true', () => {
      render(<PatternChartDisplay list={underlineList} showUnderlines />)
      const cake = screen.getByRole('button', { name: 'Hear the word cake' })
      expect(underlinedText(cake)).toEqual(['a', 'e'])
      const rain = screen.getByRole('button', { name: 'Hear the word rain' })
      expect(underlinedText(rain)).toEqual(['ai'])
      // A pattern at the very start of the word underlines without a
      // leading text span.
      const eel = screen.getByRole('button', { name: 'Hear the word eel' })
      expect(underlinedText(eel)).toEqual(['ee'])
      // The full word text stays in the button; the accessible name is unchanged.
      expect(cake).toHaveTextContent('cake')
      expect(rain).toHaveTextContent('rain')
      expect(eel).toHaveTextContent('eel')
    })

    it('leaves words plain when the pattern does not occur in them', () => {
      render(<PatternChartDisplay list={underlineList} showUnderlines />)
      const bed = screen.getByRole('button', { name: 'Hear the word bed' })
      expect(underlinedText(bed)).toEqual([])
      expect(bed).toHaveTextContent('bed')
    })

    it('keeps underlines off the printed poster', () => {
      const { container } = render(<PatternChartDisplay list={underlineList} variant="print" showUnderlines />)
      expect(
        Array.from(container.querySelectorAll('span')).filter(
          (s) => (s as HTMLElement).style.textDecorationLine === 'underline'
        )
      ).toHaveLength(0)
    })
  })
})

describe('PatternChartDisplay song videos (issue #401)', () => {
  const video = {
    videoId: 'GdmcWQCbqY8',
    title: 'When Two Vowels Go Walking | Jack Hartmann Vowel Teams Song | Vowels Song',
    channel: 'Jack Hartmann Kids Music Channel',
    source: 'curated' as const,
  }

  it('shows a play button in each unlocked column header when onSaveVideos is provided', () => {
    render(<PatternChartDisplay list={list} onSaveVideos={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Song videos for pattern a_e' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Song videos for pattern ai' })).toBeInTheDocument()
  })

  it('shows no play button without onSaveVideos', () => {
    render(<PatternChartDisplay list={list} />)
    expect(screen.queryByRole('button', { name: 'Song videos for pattern a_e' })).not.toBeInTheDocument()
  })

  it('shows no play button on the printed poster', () => {
    render(<PatternChartDisplay list={list} variant="print" onSaveVideos={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Song videos for pattern a_e' })).not.toBeInTheDocument()
  })

  it('shows no play button on a locked column', () => {
    const locked = {
      ...list,
      patterns: list.patterns.map((p) => (p.id === 'p1' ? { ...p, isLocked: true } : p)),
    }
    render(<PatternChartDisplay list={locked} onSaveVideos={vi.fn()} />)
    expect(screen.queryByRole('button', { name: 'Song videos for pattern a_e' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Song videos for pattern ai' })).toBeInTheDocument()
  })

  it('opens the video modal and attaches a suggestion through onSaveVideos', async () => {
    const onSaveVideos = vi.fn().mockResolvedValue(undefined)
    render(<PatternChartDisplay list={list} onSaveVideos={onSaveVideos} />)
    fireEvent.click(screen.getByRole('button', { name: 'Song videos for pattern ai' }))

    const dialogEl = screen.getByRole('dialog', { name: 'Song videos for pattern ai' })
    expect(within(dialogEl).getByText('Attached videos (0)')).toBeInTheDocument()
    fireEvent.click(within(dialogEl).getByRole('button', { name: `Add ${video.title}` }))
    expect(onSaveVideos).toHaveBeenCalledWith('p2', [expect.objectContaining({ videoId: video.videoId })])
    await waitFor(() => expect(onSaveVideos).toHaveBeenCalledTimes(1))
  })

  it('shows attached videos in the modal and closes it', () => {
    const onSaveVideos = vi.fn().mockResolvedValue(undefined)
    const withVideo = {
      ...list,
      patterns: list.patterns.map((p) => (p.id === 'p2' ? { ...p, videos: [video] } : p)),
    }
    render(<PatternChartDisplay list={withVideo} onSaveVideos={onSaveVideos} />)
    fireEvent.click(screen.getByRole('button', { name: 'Song videos for pattern ai' }))
    const dialogEl = screen.getByRole('dialog', { name: 'Song videos for pattern ai' })
    expect(within(dialogEl).getByText('Attached videos (1)')).toBeInTheDocument()
    expect(within(dialogEl).getByText(video.title)).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Song videos for pattern ai' })).not.toBeInTheDocument()
  })

  it('resolves the modal pattern against the live list, so saves refresh the modal', () => {
    const onSaveVideos = vi.fn().mockResolvedValue(undefined)
    const { rerender } = render(<PatternChartDisplay list={list} onSaveVideos={onSaveVideos} />)
    fireEvent.click(screen.getByRole('button', { name: 'Song videos for pattern ai' }))
    expect(screen.getByText('Attached videos (0)')).toBeInTheDocument()

    const withVideo = {
      ...list,
      patterns: list.patterns.map((p) => (p.id === 'p2' ? { ...p, videos: [video] } : p)),
    }
    rerender(<PatternChartDisplay list={withVideo} onSaveVideos={onSaveVideos} />)
    expect(screen.getByText('Attached videos (1)')).toBeInTheDocument()
  })
})

describe('PatternChartDisplay song video save errors (issue #401)', () => {
  const video = {
    videoId: 'GdmcWQCbqY8',
    title: 'When Two Vowels Go Walking | Jack Hartmann Vowel Teams Song | Vowels Song',
    channel: 'Jack Hartmann Kids Music Channel',
    source: 'curated' as const,
  }

  it('shows a save error inside the modal when onSaveVideos rejects', async () => {
    const onSaveVideos = vi.fn().mockRejectedValue(new Error('offline'))
    render(<PatternChartDisplay list={list} onSaveVideos={onSaveVideos} />)
    fireEvent.click(screen.getByRole('button', { name: 'Song videos for pattern ai' }))
    const dialogEl = screen.getByRole('dialog', { name: 'Song videos for pattern ai' })
    fireEvent.click(within(dialogEl).getByRole('button', { name: `Add ${video.title}` }))
    await waitFor(() => {
      expect(within(dialogEl).getByRole('alert')).toHaveTextContent(
        'Could not save the videos. Check your connection and try again.'
      )
    })
  })

  it('clears the save error when the modal reopens', async () => {
    const onSaveVideos = vi.fn().mockRejectedValue(new Error('offline'))
    render(<PatternChartDisplay list={list} onSaveVideos={onSaveVideos} />)
    fireEvent.click(screen.getByRole('button', { name: 'Song videos for pattern ai' }))
    const dialogEl = screen.getByRole('dialog', { name: 'Song videos for pattern ai' })
    fireEvent.click(within(dialogEl).getByRole('button', { name: `Add ${video.title}` }))
    await waitFor(() => {
      expect(within(dialogEl).getByRole('alert')).toBeInTheDocument()
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Song videos for pattern ai' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('filters hidden videos out of the present-mode suggestions', () => {
    mockBlockedVideos({ blockedVideoIds: new Set(['GdmcWQCbqY8', '1ZZ6mVwuvRE', 'lhikrG4PJfQ']), userId: 'u1' })
    render(<PatternChartDisplay list={list} onSaveVideos={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Song videos for pattern ai' }))
    const dialogEl = screen.getByRole('dialog', { name: 'Song videos for pattern ai' })
    expect(within(dialogEl).queryByRole('region', { name: 'Suggestions' })).not.toBeInTheDocument()
  })

  it('hides a present-mode video through the modal Hide button', () => {
    const { blockVideo } = mockBlockedVideos({ userId: 'u1' })
    const onSaveVideos = vi.fn().mockResolvedValue(undefined)
    const withVideo = {
      ...list,
      patterns: list.patterns.map((p) => (p.id === 'p2' ? { ...p, videos: [video] } : p)),
    }
    render(<PatternChartDisplay list={withVideo} onSaveVideos={onSaveVideos} />)
    fireEvent.click(screen.getByRole('button', { name: 'Song videos for pattern ai' }))
    const dialogEl = screen.getByRole('dialog', { name: 'Song videos for pattern ai' })
    fireEvent.click(within(dialogEl).getByRole('button', { name: `Hide ${video.title}` }))
    // Hiding an attached video also unattaches it from the pattern.
    expect(onSaveVideos).toHaveBeenCalledWith('p2', [])
    expect(blockVideo).toHaveBeenCalledWith(expect.objectContaining({ videoId: video.videoId }))
  })
})
