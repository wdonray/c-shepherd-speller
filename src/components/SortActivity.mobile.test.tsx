import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react'
import SortActivity, { touchDragLiftModifier, TOUCH_DRAG_LIFT } from './SortActivity'
import type { WordList } from '@/models/WordList'
import type { ClientRect } from '@dnd-kit/core'

// Force the mobile layout: match the max-width query, nothing else.
const originalMatchMedia = window.matchMedia
function mockMobileViewport() {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  })
}

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

const { playCorrectSound, playIncorrectSound, playPickupSound, playDropSound, playWinFanfare } = vi.hoisted(() => ({
  playCorrectSound: vi.fn(),
  playIncorrectSound: vi.fn(),
  playPickupSound: vi.fn(),
  playDropSound: vi.fn(),
  playWinFanfare: vi.fn(),
}))
vi.mock('@/lib/sound-effects', () => ({
  playCorrectSound,
  playIncorrectSound,
  playPickupSound,
  playDropSound,
  playWinFanfare,
  isSoundEnabled: () => true,
  setSoundEnabled: vi.fn(),
}))

const { fireWinConfetti } = vi.hoisted(() => ({
  fireWinConfetti: vi.fn(),
}))
vi.mock('@/lib/confetti', () => ({
  fireWinConfetti,
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

describe('SortActivity on mobile', () => {
  beforeEach(() => {
    mockMobileViewport()
    playCorrectSound.mockClear()
    playIncorrectSound.mockClear()
    playPickupSound.mockClear()
    playDropSound.mockClear()
    playWinFanfare.mockClear()
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  function liveRegion() {
    return document.querySelector('[aria-live="polite"][role="status"]')
  }

  /** Place a word through the sticky bottom placement bar. */
  function placeViaBar(word: string, destination: string) {
    fireEvent.click(screen.getByRole('button', { name: `Select the word ${word}` }))
    fireEvent.click(screen.getByRole('button', { name: `Put ${word} in the ${destination} column` }))
  }

  it('shows tap instructions instead of drag instructions', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    expect(screen.getByText(/Tap a word, then choose where it goes/)).toBeInTheDocument()
    expect(screen.queryByText(/Drag each word into the column/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Keyboard:/)).not.toBeInTheDocument()
  })

  it('renders columns stacked with sound-type styling and power bars', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    expect(screen.getByRole('region', { name: 'Word bank' })).toBeInTheDocument()
    for (const pattern of ['a_e', 'ai', 'odd']) {
      expect(screen.getByLabelText(`Pattern ${pattern} column`)).toBeInTheDocument()
    }
  })

  it('shows each pattern sound under its pattern in the mobile columns (issue #379)', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    for (const pattern of ['a_e', 'ai', 'odd']) {
      const column = screen.getByLabelText(`Pattern ${pattern} column`)
      expect(within(column).getByText('long a')).toBeInTheDocument()
    }
  })

  it('selects and deselects a word on tap', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    const cake = screen.getByRole('button', { name: 'Select the word cake' })
    fireEvent.click(cake)
    expect(screen.getByRole('button', { name: 'Deselect the word cake' })).toHaveAttribute('aria-pressed', 'true')
    expect(liveRegion()?.textContent).toContain("Selected 'cake'")
    fireEvent.click(screen.getByRole('button', { name: 'Deselect the word cake' }))
    expect(screen.getByRole('button', { name: 'Select the word cake' })).toHaveAttribute('aria-pressed', 'false')
    expect(liveRegion()?.textContent).toContain("Deselected 'cake'")
  })

  it('opens the placement bar with one destination per pattern when a word is tapped', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    expect(screen.queryByRole('region', { name: 'Choose where to put cake' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Select the word cake' }))
    const bar = screen.getByRole('region', { name: 'Choose where to put cake' })
    expect(bar).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Put cake in the a_e column' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Put cake in the ai column' })).toBeInTheDocument()
    expect(within(bar).getByRole('button', { name: 'Put cake in the odd column' })).toBeInTheDocument()
    // Issue #379: the sound reads under the pattern on the placement bar too.
    const aEDestination = within(bar).getByRole('button', { name: 'Put cake in the a_e column' })
    expect(within(aEDestination).getByText('long a')).toBeInTheDocument()
    // A word straight from the bank has nowhere to go back to.
    expect(within(bar).queryByRole('button', { name: 'Put cake back in the word bank' })).not.toBeInTheDocument()
    expect(liveRegion()?.textContent).toContain('Choose where it goes.')
  })

  it('wraps placed words inside mobile columns while bank tiles stay full width', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    // Bank tiles stay full width for the tap-to-place flow.
    const bankSection = screen.getByRole('region', { name: 'Word bank' })
    expect(within(bankSection).getByRole('button', { name: 'Select the word cake' })).toHaveClass('w-full')
    // Place two words in the a_e column.
    fireEvent.click(screen.getByRole('button', { name: 'Select the word cake' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put cake in the a_e column' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select the word bake' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put bake in the a_e column' }))
    const column = screen.getByLabelText('Pattern a_e column')
    const wordList = within(column).getByRole('list')
    expect(wordList).toHaveClass('flex', 'flex-wrap')
    // Column tiles are content width so they wrap, not full width.
    const placed = within(column).getByRole('button', { name: 'Select the word cake' })
    expect(placed).not.toHaveClass('w-full')
    expect(placed).toHaveClass('min-w-[120px]')
    expect(within(placed).getByLabelText('Correct')).toBeInTheDocument()
  })

  it('places a word in a column via the bar and closes the bar', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Select the word cake' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put cake in the a_e column' }))
    // Cake left the bank and now sits in the a_e column; the bar closed.
    const bankSection = screen.getByRole('region', { name: 'Word bank' })
    expect(within(bankSection).queryByRole('button', { name: /the word cake/ })).not.toBeInTheDocument()
    const column = screen.getByLabelText('Pattern a_e column')
    expect(within(column).getByRole('button', { name: 'Select the word cake' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Choose where to put cake' })).not.toBeInTheDocument()
    // The pattern underline renders on tap-to-place too.
    const placedButton = within(column).getByRole('button', { name: 'Select the word cake' })
    expect(within(placedButton).getByText('a').getAttribute('style')).toContain('text-decoration')
    expect(within(placedButton).getByText('a').getAttribute('style')).not.toContain('border-bottom')
    await waitFor(() => {
      expect(liveRegion()?.textContent).toContain('cake is correct in a_e')
    })
  })

  it('cancels placement without moving the word', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Select the word cake' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put cake down' }))
    expect(screen.queryByRole('region', { name: 'Choose where to put cake' })).not.toBeInTheDocument()
    // Cake is still in the bank, unselected.
    const bankSection = screen.getByRole('region', { name: 'Word bank' })
    expect(within(bankSection).getByRole('button', { name: 'Select the word cake' })).toBeInTheDocument()
    expect(liveRegion()?.textContent).toContain("Deselected 'cake'")
  })

  it('moves a placed word back to the word bank via the bar', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    placeViaBar('cake', 'a_e')
    // Selecting the placed word offers the word bank as a destination.
    fireEvent.click(screen.getByRole('button', { name: 'Select the word cake' }))
    const bar = screen.getByRole('region', { name: 'Choose where to put cake' })
    fireEvent.click(within(bar).getByRole('button', { name: 'Put cake back in the word bank' }))
    expect(screen.getByRole('button', { name: 'Select the word cake' })).toBeInTheDocument()
    expect(liveRegion()?.textContent).toContain("Moved 'cake' back to the word bank")
  })

  it('moves a word between columns via the bar', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    placeViaBar('cake', 'a_e')
    fireEvent.click(screen.getByRole('button', { name: 'Select the word cake' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put cake in the ai column' }))
    const aiColumn = screen.getByLabelText('Pattern ai column')
    expect(within(aiColumn).getByRole('button', { name: 'Select the word cake' })).toBeInTheDocument()
    // Cake belongs to a_e, so the drop gives immediate incorrect feedback.
    expect(liveRegion()?.textContent).toContain('cake does not go with ai. Try another column.')
    expect(playIncorrectSound).toHaveBeenCalled()
  })

  it('switches selection to another word while the bar is open', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Select the word cake' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select the word bake' }))
    expect(screen.getByRole('region', { name: 'Choose where to put bake' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Choose where to put cake' })).not.toBeInTheDocument()
  })

  it('announces each correct drop and shows the win overlay when every word is correct', async () => {
    const onExit = vi.fn()
    render(<SortActivity list={list} onExit={onExit} />)
    placeViaBar('cake', 'a_e')
    expect(liveRegion()?.textContent).toContain('cake is correct in a_e.')
    placeViaBar('bake', 'a_e')
    placeViaBar('rain', 'ai')
    placeViaBar('said', 'odd')
    expect(playCorrectSound).toHaveBeenCalledTimes(4)
    expect(playIncorrectSound).not.toHaveBeenCalled()
    // All words placed and correct: the win cascade fires the overlay.
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Every word is sorted.')).toBeInTheDocument()
    await waitFor(() => {
      expect(liveRegion()?.textContent).toContain('Every word is sorted.')
    })
    // The win effect plays the fanfare before announcing.
    expect(playWinFanfare).toHaveBeenCalled()
    // Confetti fires alongside the fanfare.
    expect(fireWinConfetti).toHaveBeenCalledTimes(1)
    // The win dialog has no rule nudge (issue #263): Try again resets the board.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // Win again and exit from the dialog.
    placeViaBar('cake', 'a_e')
    placeViaBar('bake', 'a_e')
    placeViaBar('rain', 'ai')
    placeViaBar('said', 'odd')
    const secondDialog = await screen.findByRole('dialog')
    fireEvent.click(within(secondDialog).getByRole('button', { name: 'Exit' }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })

  it('plays the incorrect sound on a wrong drop and the correct sound on right drops', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    placeViaBar('cake', 'ai') // wrong column
    expect(playIncorrectSound).toHaveBeenCalled()
    expect(liveRegion()?.textContent).toContain('cake does not go with ai. Try another column.')
    placeViaBar('bake', 'a_e')
    placeViaBar('rain', 'ai')
    placeViaBar('said', 'odd')
    // Each correct drop plays the correct sound immediately.
    expect(playCorrectSound).toHaveBeenCalledTimes(3)
    // One word marked incorrect, three marked correct.
    expect(document.querySelectorAll('svg[aria-label="Incorrect"]')).toHaveLength(1)
    expect(document.querySelectorAll('svg[aria-label="Correct"]')).toHaveLength(3)
  })

  it('cancels the win when the board is reset before the cascade fires', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    placeViaBar('cake', 'a_e')
    placeViaBar('bake', 'a_e')
    placeViaBar('rain', 'ai')
    placeViaBar('said', 'odd')
    // Reset before the 300ms win delay elapses.
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    // Wait past the win delay: no dialog may appear and no fanfare plays.
    await new Promise((resolve) => setTimeout(resolve, 450))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(playWinFanfare).not.toHaveBeenCalled()
  })

  it('does not win when the list has no sortable words', async () => {
    const emptyList: WordList = { ...list, patterns: [] }
    render(<SortActivity list={emptyList} onExit={vi.fn()} />)
    await new Promise((resolve) => setTimeout(resolve, 450))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(playWinFanfare).not.toHaveBeenCalled()
  })

  it('does not re-win after the dialog is dismissed', async () => {
    const { rerender } = render(<SortActivity list={list} onExit={vi.fn()} />)
    placeViaBar('cake', 'a_e')
    placeViaBar('bake', 'a_e')
    placeViaBar('rain', 'ai')
    placeViaBar('said', 'odd')
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Try again' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // A parent re-render (new list object, same content) must not re-arm the win.
    rerender(<SortActivity list={{ ...list }} onExit={vi.fn()} />)
    await new Promise((resolve) => setTimeout(resolve, 450))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(playWinFanfare).toHaveBeenCalledTimes(1)
  })

  it('try again returns all words to the bank and clears the selection', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    placeViaBar('cake', 'a_e')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('button', { name: 'Select the word cake' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select the word bake' })).toBeInTheDocument()
    // Correctness marks are cleared and no win overlay is showing.
    expect(document.querySelectorAll('svg[aria-label="Correct"]')).toHaveLength(0)
    expect(document.querySelectorAll('svg[aria-label="Incorrect"]')).toHaveLength(0)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(liveRegion()?.textContent).toContain('All words returned to the word bank')
  })

  it('shows an empty-column hint in columns with no words', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    expect(screen.getAllByText('No words here yet.')).toHaveLength(3)
    // The hint stays put while a word is selected; placement happens in the bar.
    fireEvent.click(screen.getByRole('button', { name: 'Select the word cake' }))
    expect(screen.getAllByText('No words here yet.')).toHaveLength(3)
  })

  it('calls onExit when exiting', () => {
    const onExit = vi.fn()
    render(<SortActivity list={list} onExit={onExit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Exit sort' }))
    expect(onExit).toHaveBeenCalled()
  })
})

describe('SortActivity touch drag', () => {
  beforeEach(() => {
    mockMobileViewport()
    playCorrectSound.mockClear()
    playIncorrectSound.mockClear()
    playDropSound.mockClear()
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
  })

  it('makes word tiles draggable on touch layouts', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    const wordButton = screen.getByRole('button', { name: 'Select the word cake' })
    // dnd-kit draggable wiring: announced as draggable and touch-action none
    // so a finger drag starts the drag instead of scrolling.
    expect(wordButton.getAttribute('aria-roledescription')).toBe('draggable')
    expect(wordButton.style.touchAction).toBe('none')
  })

  it('drops a dragged word into a column with immediate feedback', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    act(() => {
      dndHandlers.onDragEnd?.({ active: { id: 'p1:cake' }, over: { id: 'p1' } })
    })
    const column = screen.getByLabelText('Pattern a_e column')
    expect(within(column).getByRole('button', { name: 'Select the word cake' })).toBeInTheDocument()
    await waitFor(() => {
      expect(playCorrectSound).toHaveBeenCalledTimes(1)
    })
  })

  it('drags a placed word back to the word bank', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    act(() => {
      dndHandlers.onDragEnd?.({ active: { id: 'p1:cake' }, over: { id: 'p1' } })
    })
    const column = screen.getByLabelText('Pattern a_e column')
    expect(within(column).getByRole('button', { name: 'Select the word cake' })).toBeInTheDocument()
    act(() => {
      dndHandlers.onDragEnd?.({ active: { id: 'p1:cake' }, over: { id: 'word-bank' } })
    })
    const bank = screen.getByRole('region', { name: 'Word bank' })
    expect(within(bank).getByRole('button', { name: 'Select the word cake' })).toBeInTheDocument()
    expect(within(column).queryByRole('button', { name: 'Select the word cake' })).not.toBeInTheDocument()
  })

  it('highlights the column and bank under the dragged word', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    const column = screen.getByLabelText('Pattern a_e column')
    const bank = screen.getByRole('region', { name: 'Word bank' })
    expect(column.className).not.toContain('bg-sky-soft')
    act(() => {
      dndHandlers.onDragOver?.({ over: { id: 'p1' } })
    })
    expect(column.className).toContain('bg-sky-soft')
    act(() => {
      dndHandlers.onDragOver?.({ over: { id: 'word-bank' } })
    })
    expect(column.className).not.toContain('bg-sky-soft')
    expect(bank.className).toContain('bg-sky-soft')
  })

  it('closes the placement bar when a drag completes', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Select the word cake' }))
    expect(screen.getByRole('region', { name: 'Choose where to put cake' })).toBeInTheDocument()
    act(() => {
      dndHandlers.onDragEnd?.({ active: { id: 'p1:cake' }, over: { id: 'p1' } })
    })
    expect(screen.queryByRole('region', { name: 'Choose where to put cake' })).not.toBeInTheDocument()
  })

  it('keeps tap-to-place working alongside drag', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    // A tap (no drag) still selects the word and opens the placement bar.
    fireEvent.click(screen.getByRole('button', { name: 'Select the word cake' }))
    expect(screen.getByRole('region', { name: 'Choose where to put cake' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Put cake in the a_e column' }))
    const column = screen.getByLabelText('Pattern a_e column')
    expect(within(column).getByRole('button', { name: 'Select the word cake' })).toBeInTheDocument()
  })
})

describe('touchDragLiftModifier', () => {
  const baseArgs = {
    active: null,
    activeNodeRect: null,
    draggingNodeRect: null,
    containerNodeRect: null,
    over: null,
    overlayNodeRect: null,
    scrollableAncestors: [],
    scrollableAncestorRects: [],
    windowRect: null,
  }
  const transform = { x: 10, y: 100, scaleX: 1, scaleY: 1 }

  it('lifts the overlay above the fingertip for touch drags', () => {
    const result = touchDragLiftModifier({
      ...baseArgs,
      activatorEvent: { pointerType: 'touch' } as unknown as Event,
      transform,
    })
    expect(result.y).toBe(100 - TOUCH_DRAG_LIFT)
    expect(result.x).toBe(10)
  })

  it('leaves mouse drags under the cursor', () => {
    const result = touchDragLiftModifier({
      ...baseArgs,
      activatorEvent: { pointerType: 'mouse' } as unknown as Event,
      transform,
    })
    expect(result).toBe(transform)
  })

  it('leaves the transform alone without an activator event', () => {
    const result = touchDragLiftModifier({ ...baseArgs, activatorEvent: null, transform })
    expect(result).toBe(transform)
  })

  it('keeps the grabbed point under the pointer for touch drags', () => {
    // Grabbed 20px from the left and 10px from the top of a 200x56 tile.
    const rect = { left: 100, top: 200, width: 200, height: 56 } as unknown as ClientRect
    const result = touchDragLiftModifier({
      ...baseArgs,
      activeNodeRect: rect,
      activatorEvent: { pointerType: 'touch', clientX: 120, clientY: 210 } as unknown as Event,
      transform: { x: 50, y: 30, scaleX: 1, scaleY: 1 },
    })
    // Compensation for the 1.15 overlay scale about the tile center:
    // dx = (1 - 1.15) * (20 - 100) = 12, dy = (1 - 1.15) * (10 - 28) = 2.7,
    // then the 64px touch lift.
    expect(result.x).toBeCloseTo(62)
    expect(result.y).toBeCloseTo(30 + 2.7 - TOUCH_DRAG_LIFT)
    expect(result.scaleX).toBe(1)
    expect(result.scaleY).toBe(1)
  })

  it('compensates the overlay scale for mouse drags without lifting', () => {
    // Grabbed near the right edge: the scale would push the tile left.
    const rect = { left: 100, top: 200, width: 200, height: 56 } as unknown as ClientRect
    const result = touchDragLiftModifier({
      ...baseArgs,
      activeNodeRect: rect,
      activatorEvent: { pointerType: 'mouse', clientX: 280, clientY: 220 } as unknown as Event,
      transform: { x: 50, y: 30, scaleX: 1, scaleY: 1 },
    })
    // dx = (1 - 1.15) * (180 - 100) = -12, dy = (1 - 1.15) * (20 - 28) = 1.2.
    expect(result.x).toBeCloseTo(38)
    expect(result.y).toBeCloseTo(31.2)
  })

  it('reads touch coordinates from a TouchEvent', () => {
    const rect = { left: 100, top: 200, width: 200, height: 56 } as unknown as ClientRect
    const result = touchDragLiftModifier({
      ...baseArgs,
      activeNodeRect: rect,
      activatorEvent: {
        pointerType: 'touch',
        touches: [{ clientX: 150, clientY: 205 }],
      } as unknown as Event,
      transform: { x: 50, y: 30, scaleX: 1, scaleY: 1 },
    })
    // Grabbed at (50, 5): dx = (1 - 1.15) * (50 - 100) = 7.5,
    // dy = (1 - 1.15) * (5 - 28) = 3.45, then the touch lift.
    expect(result.x).toBeCloseTo(57.5)
    expect(result.y).toBeCloseTo(30 + 3.45 - TOUCH_DRAG_LIFT)
  })

  it('falls back to changedTouches when touches is empty', () => {
    const rect = { left: 100, top: 200, width: 200, height: 56 } as unknown as ClientRect
    const result = touchDragLiftModifier({
      ...baseArgs,
      activeNodeRect: rect,
      activatorEvent: {
        pointerType: 'touch',
        changedTouches: [{ clientX: 150, clientY: 205 }],
      } as unknown as Event,
      transform: { x: 50, y: 30, scaleX: 1, scaleY: 1 },
    })
    expect(result.x).toBeCloseTo(57.5)
    expect(result.y).toBeCloseTo(30 + 3.45 - TOUCH_DRAG_LIFT)
  })
})

describe('SortActivity mobile drag visuals', () => {
  beforeEach(() => {
    mockMobileViewport()
  })

  afterEach(() => {
    window.matchMedia = originalMatchMedia
    vi.restoreAllMocks()
  })

  it('hides the original tile while it is being dragged', async () => {
    const dndKit = await import('@dnd-kit/core')
    const spy = vi.spyOn(dndKit, 'useDraggable').mockImplementation((() => ({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      isDragging: true,
    })) as never)
    render(<SortActivity list={list} onExit={vi.fn()} />)
    const wordButton = screen.getByRole('button', { name: 'Select the word cake' })
    expect(wordButton.className).toContain('invisible')
    spy.mockRestore()
  })

  it('toggles the rule cards under the mobile column headers', async () => {
    const ruledList: WordList = {
      ...list,
      patterns: [
        {
          id: 'p1',
          sound: 'long a',
          pattern: 'a_e',
          frequency: 'common',
          words: ['cake', 'bake'],
          rule: 'Magic e.',
        },
        { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'common', words: ['rain'] },
      ],
    }
    render(<SortActivity list={ruledList} onExit={vi.fn()} />)
    expect(screen.getByText('The rule:')).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: 'Show rules' })
    fireEvent.click(toggle)
    // Issue #374: hiding animates the slot out, so it leaves the DOM after
    // the exit transition instead of vanishing synchronously.
    await waitFor(() => expect(screen.queryByText('The rule:')).not.toBeInTheDocument())
    fireEvent.click(toggle)
    expect(screen.getByText('The rule:')).toBeInTheDocument()
  })
})
