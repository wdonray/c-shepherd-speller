import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
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
    expect(within(placedButton).getByText('a').getAttribute('style')).toContain('border-bottom')
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
    render(<SortActivity list={list} onExit={vi.fn()} />)
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
    // "Tell the rule" dismisses the overlay (rule capture lands in a later phase).
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tell the rule' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    // Win again and dismiss with the other action.
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    placeViaBar('cake', 'a_e')
    placeViaBar('bake', 'a_e')
    placeViaBar('rain', 'ai')
    placeViaBar('said', 'odd')
    const secondDialog = await screen.findByRole('dialog')
    fireEvent.click(within(secondDialog).getByRole('button', { name: 'Skip for now' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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
