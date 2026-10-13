import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react'
import DisplayMode from './DisplayMode'
import type { WordList } from '@/models/WordList'

const { getList, getLists, updateList } = vi.hoisted(() => ({
  getList: vi.fn(),
  getLists: vi.fn(),
  updateList: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({ getList, getLists, updateList }))

const mockSearchParams = vi.hoisted(() => ({ get: vi.fn() }))
const mockPush = vi.hoisted(() => vi.fn())
const mockBack = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: mockPush, back: mockBack }),
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

vi.mock('@/lib/tts', () => ({
  speak: vi.fn(),
}))

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5',
  patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake'] }],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

// Two-pattern list for the lock toggle tests, so the toggle mapping covers
// both the matching and the non-matching pattern.
const twoPatternList: WordList = {
  ...list,
  patterns: [
    { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake'] },
    { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'less-common', words: ['rain'] },
  ],
}

describe('DisplayMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.get.mockReturnValue(null)
  })

  it('shows a loading state initially', () => {
    getLists.mockImplementation(() => new Promise(() => {}))
    render(<DisplayMode />)
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('shows the list picker when no list is selected', async () => {
    getLists.mockResolvedValue([list])
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Present a list' })).toBeInTheDocument()
    })
    expect(screen.getByText('Week 5')).toBeInTheDocument()
  })

  it('shows a single whole-card link per list on the picker', async () => {
    getLists.mockResolvedValue([list])
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('Week 5')).toBeInTheDocument()
    })
    const cardLink = screen.getByRole('link', { name: 'Present chart: Week 5' })
    expect(cardLink).toHaveAttribute('href', '/display?list=l1')
    expect(screen.queryByRole('button', { name: 'Present chart' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Present' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Spelling patterns')).not.toBeInTheDocument()
  })

  it('links each picker card to its chart', async () => {
    getLists.mockResolvedValue([list])
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('Week 5')).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: 'Present chart: Week 5' })).toHaveAttribute('href', '/display?list=l1')
  })

  it('shows an empty state when there are no lists', async () => {
    getLists.mockResolvedValue([])
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('No word lists yet')).toBeInTheDocument()
    })
  })

  it('shows an error state when loading fails', async () => {
    getLists.mockRejectedValue(new Error('offline'))
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not load the word list')
    })
  })

  it('shows the pattern chart for the selected list', async () => {
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockResolvedValue(list)
    render(<DisplayMode />)

    await waitFor(() => {
      expect(within(screen.getByRole('main')).getByText('Week 5')).toBeInTheDocument()
    })
    expect(screen.queryByText('long a')).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Pattern a_e' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyze the word cake' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hear the word cake' })).toBeInTheDocument()
  })

  it('links to the print view from the display header', async () => {
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockResolvedValue(list)
    render(<DisplayMode />)

    await waitFor(() => {
      expect(within(screen.getByRole('main')).getByText('Week 5')).toBeInTheDocument()
    })
    expect(screen.queryByText('long a')).not.toBeInTheDocument()
    const printLink = screen.getByRole('link', { name: 'Print chart' })
    expect(printLink).toHaveAttribute('href', '/lists/l1/print')
  })

  it('enters sort mode from the Sort words button and exits back', async () => {
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockResolvedValue(list)
    render(<DisplayMode />)

    await waitFor(() => {
      expect(within(screen.getByRole('main')).getByText('Week 5')).toBeInTheDocument()
    })
    expect(screen.queryByText('long a')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Sort words' }))
    expect(screen.getByText('Sort the words')).toBeInTheDocument()
    expect(screen.queryByText('long a')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Exit sort' }))
    await waitFor(() => {
      expect(within(screen.getByRole('main')).getByText('Week 5')).toBeInTheDocument()
    })
    expect(screen.queryByText('long a')).not.toBeInTheDocument()
  })

  it('shows a full screen button in the chart header when supported', async () => {
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockResolvedValue(list)
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enter full screen' })).toBeInTheDocument()
    })
  })

  it('shows an error state when the selected list fails to load', async () => {
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockRejectedValue(new Error('offline'))
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not load the word list')
    })
  })

  it('shows a Back button on the list picker', async () => {
    getLists.mockResolvedValue([list])
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Present a list' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
  })

  it('always goes home from the picker Back button', async () => {
    getLists.mockResolvedValue([list])
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(mockPush).toHaveBeenCalledWith('/home')
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('does not navigate on Escape from the list picker', async () => {
    getLists.mockResolvedValue([list])
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument()
    })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('does not navigate on Escape from the chart', async () => {
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockResolvedValue(list)
    render(<DisplayMode />)

    await waitFor(() => {
      expect(within(screen.getByRole('main')).getByText('Week 5')).toBeInTheDocument()
    })
    expect(screen.queryByText('long a')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('ignores non-Escape keys', async () => {
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockResolvedValue(list)
    render(<DisplayMode />)

    await waitFor(() => {
      expect(within(screen.getByRole('main')).getByText('Week 5')).toBeInTheDocument()
    })
    expect(screen.queryByText('long a')).not.toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(mockPush).not.toHaveBeenCalledWith('/display')
  })

  it('locks a pattern optimistically and persists via updateList', async () => {
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockResolvedValue(twoPatternList)
    // Keep the save pending so the optimistic update is observable.
    updateList.mockImplementation(() => new Promise(() => {}))
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Lock pattern a_e' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Lock pattern a_e' }))

    // Optimistic: the locked placeholder shows immediately, before the save resolves.
    expect(screen.getByRole('region', { name: 'Locked pattern' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Analyze the word cake' })).not.toBeInTheDocument()
    // The other pattern is untouched.
    expect(screen.getByRole('region', { name: 'Pattern ai' })).toBeInTheDocument()
    expect(updateList).toHaveBeenCalledWith('l1', {
      patterns: [{ ...twoPatternList.patterns[0], isLocked: true }, twoPatternList.patterns[1]],
    })
  })

  it('keeps the lock after a successful save', async () => {
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockResolvedValue(twoPatternList)
    const saved: WordList = {
      ...twoPatternList,
      patterns: [{ ...twoPatternList.patterns[0], isLocked: true }, twoPatternList.patterns[1]],
      updatedAt: '2026-10-09T00:00:00.000Z',
    }
    updateList.mockResolvedValue(saved)
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Lock pattern a_e' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Lock pattern a_e' }))

    await waitFor(() => {
      expect(updateList).toHaveBeenCalled()
    })
    // Still locked once the save resolves; the unlock toggle is available.
    expect(screen.getByRole('button', { name: 'Unlock pattern a_e' })).toBeInTheDocument()
  })

  it('reverts the lock and shows an error when saving fails', async () => {
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockResolvedValue(twoPatternList)
    updateList.mockRejectedValue(new Error('offline'))
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Lock pattern a_e' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Lock pattern a_e' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not load the word list')
    })
    // Reverted: the unlocked column is back, no locked placeholder.
    expect(screen.getByRole('region', { name: 'Pattern a_e' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Locked pattern' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyze the word cake' })).toBeInTheDocument()
  })

  it('dismisses the lock save error', async () => {
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockResolvedValue(twoPatternList)
    updateList.mockRejectedValue(new Error('offline'))
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Lock pattern a_e' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Lock pattern a_e' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  describe('week filter chips', () => {
    const weekFive: WordList = { ...list, id: 'w5', name: 'Week 5 list', week: '5' }
    const weekTen: WordList = { ...list, id: 'w10', name: 'Week 10 list', week: '10' }
    const weekTwo: WordList = { ...list, id: 'w2', name: 'Week 2 list', week: '2' }
    const noWeek: WordList = { ...list, id: 'nw', name: 'No week list' }

    it('shows All weeks plus one chip per assigned week, in numeric order', async () => {
      getLists.mockResolvedValue([weekTen, weekTwo, weekFive])
      render(<DisplayMode />)

      await waitFor(() => {
        expect(screen.getByRole('group', { name: 'Filter lists by week' })).toBeInTheDocument()
      })
      const chips = within(screen.getByRole('group', { name: 'Filter lists by week' })).getAllByRole('button')
      expect(chips.map((chip) => chip.textContent)).toEqual(['All weeks', '2', '5', '10'])
      expect(screen.getByRole('button', { name: 'All weeks' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('hides the chip row when no list has a week', async () => {
      getLists.mockResolvedValue([noWeek])
      render(<DisplayMode />)

      await waitFor(() => {
        expect(screen.getByText('No week list')).toBeInTheDocument()
      })
      expect(screen.queryByRole('group', { name: 'Filter lists by week' })).not.toBeInTheDocument()
    })

    it('filters to one week and hides unassigned lists', async () => {
      getLists.mockResolvedValue([weekFive, weekTwo, noWeek])
      render(<DisplayMode />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: '5' }))

      expect(screen.getByText('Week 5 list')).toBeInTheDocument()
      expect(screen.queryByText('Week 2 list')).not.toBeInTheDocument()
      expect(screen.queryByText('No week list')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: '5' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'All weeks' })).toHaveAttribute('aria-pressed', 'false')
    })

    it('All weeks shows every list again', async () => {
      getLists.mockResolvedValue([weekFive, noWeek])
      render(<DisplayMode />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: '5' }))
      expect(screen.queryByText('No week list')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'All weeks' }))

      expect(screen.getByText('Week 5 list')).toBeInTheDocument()
      expect(screen.getByText('No week list')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'All weeks' })).toHaveAttribute('aria-pressed', 'true')
    })

    it('resets the filter when the selected week no longer exists', async () => {
      getLists.mockResolvedValue([weekFive, noWeek])
      getList.mockResolvedValue(list)
      const { rerender } = render(<DisplayMode />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: '5' }))
      expect(screen.queryByText('No week list')).not.toBeInTheDocument()

      // Present a chart, then come back to a list set with no week 5.
      mockSearchParams.get.mockReturnValue('l1')
      rerender(<DisplayMode />)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Week 5' })).toBeInTheDocument()
      })
      getLists.mockResolvedValue([noWeek])
      mockSearchParams.get.mockReturnValue(null)
      rerender(<DisplayMode />)

      // Stale week 5 filter is gone; the unassigned list is visible again.
      await waitFor(() => {
        expect(screen.getByText('No week list')).toBeInTheDocument()
      })
      expect(screen.queryByRole('group', { name: 'Filter lists by week' })).not.toBeInTheDocument()
    })
  })

  it('adds presenting guidance under the picker intro', async () => {
    getLists.mockResolvedValue([list])
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Present a list' })).toBeInTheDocument()
    })
    expect(screen.getByText(/One column per pattern, all words visible at once/)).toBeInTheDocument()
    expect(screen.getByText(/try Sort words to turn the chart into a class sorting activity/)).toBeInTheDocument()
  })

  it('shows the presenting tips bar on the chart view', async () => {
    window.localStorage.removeItem('patternspell-presenting-tips-dismissed')
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockResolvedValue(list)
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Presenting tips' })).toBeInTheDocument()
    })
    expect(screen.getByText(/Press the fullscreen button for the biggest chart/)).toBeInTheDocument()
  })

  it('shows the "Why this chart?" button next to the list name', async () => {
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockResolvedValue(list)
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Why this chart?' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Why this chart?' }))
    expect(screen.getByRole('dialog', { name: 'Why this chart?' })).toBeInTheDocument()
  })
})
