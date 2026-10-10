import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import SortActivity from './SortActivity'
import type { WordList } from '@/models/WordList'

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

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return {
    ...actual,
    DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

describe('SortActivity on mobile', () => {
  beforeEach(() => {
    mockMobileViewport()
    playCorrectSound.mockClear()
    playIncorrectSound.mockClear()
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
    // A word straight from the bank has nowhere to go back to.
    expect(within(bar).queryByRole('button', { name: 'Put cake back in the word bank' })).not.toBeInTheDocument()
    expect(liveRegion()?.textContent).toContain('Choose where it goes.')
  })

  it('places a word in a column via the bar and closes the bar', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Select the word cake' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put cake in the a_e column' }))
    // Cake left the bank and now sits in the a_e column; the bar closed.
    const bankSection = screen.getByRole('region', { name: 'Word bank' })
    expect(within(bankSection).queryByRole('button', { name: /the word cake/ })).not.toBeInTheDocument()
    const column = screen.getByLabelText('Pattern a_e column')
    expect(within(column).getByRole('button', { name: 'Select the word cake' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Choose where to put cake' })).not.toBeInTheDocument()
    expect(liveRegion()?.textContent).toContain("Placed 'cake' in a_e")
    // Check answers is now enabled.
    expect(screen.getByRole('button', { name: 'Check answers' })).not.toBeDisabled()
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
    expect(liveRegion()?.textContent).toContain("Placed 'cake' in ai")
  })

  it('switches selection to another word while the bar is open', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Select the word cake' }))
    fireEvent.click(screen.getByRole('button', { name: 'Select the word bake' }))
    expect(screen.getByRole('region', { name: 'Choose where to put bake' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Choose where to put cake' })).not.toBeInTheDocument()
  })

  it('checks answers, shows the score, and plays the correct sound', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    placeViaBar('cake', 'a_e')
    placeViaBar('bake', 'a_e')
    placeViaBar('rain', 'ai')
    placeViaBar('said', 'odd')
    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))
    // The score text appears in both the live region and the score paragraph.
    expect(screen.getAllByText('4 of 4 in the right column.').length).toBeGreaterThanOrEqual(1)
    expect(playCorrectSound).toHaveBeenCalled()
    expect(playIncorrectSound).not.toHaveBeenCalled()
  })

  it('plays the incorrect sound when any word is wrong', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    placeViaBar('cake', 'ai') // wrong column
    placeViaBar('bake', 'a_e')
    placeViaBar('rain', 'ai')
    placeViaBar('said', 'odd')
    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))
    expect(playIncorrectSound).toHaveBeenCalled()
    expect(playCorrectSound).not.toHaveBeenCalled()
    // One word marked incorrect, three marked correct.
    expect(document.querySelectorAll('svg[aria-label="Incorrect"]')).toHaveLength(1)
    expect(document.querySelectorAll('svg[aria-label="Correct"]')).toHaveLength(3)
  })

  it('try again returns all words to the bank and clears the selection', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    placeViaBar('cake', 'a_e')
    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }))
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(screen.getByRole('button', { name: 'Select the word cake' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Select the word bake' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Check answers' })).toBeDisabled()
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
