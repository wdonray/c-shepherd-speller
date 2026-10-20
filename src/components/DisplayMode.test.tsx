import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within, act } from '@testing-library/react'
import DisplayMode from './DisplayMode'
import type { WordList } from '@/models/WordList'

const { getListWithClassroom, getLists, updateList } = vi.hoisted(() => ({
  getListWithClassroom: vi.fn(),
  getLists: vi.fn(),
  updateList: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({
  getListWithClassroom,
  getLists,
  updateList,
  invalidateListClassroomCache: vi.fn(),
}))

const { useBlockedVideos } = vi.hoisted(() => ({ useBlockedVideos: vi.fn() }))
vi.mock('@/hooks/useBlockedVideos', () => ({ useBlockedVideos }))

// useBlockedVideos reads the session via useSession, which throws without a
// SessionProvider; stub the hook so these tests render the real components.
useBlockedVideos.mockReturnValue({
  blockedVideos: [],
  blockedVideoIds: new Set<string>(),
  isLoaded: true,
  userId: null,
  blockVideo: vi.fn(),
  unblockVideo: vi.fn(),
})

const mockSearchParams = vi.hoisted(() => ({ get: vi.fn() }))

/** Mock ?list=<id>: returns the id for 'list', null for everything else. */
function mockListParam(id: string) {
  mockSearchParams.get.mockImplementation((key: string) => (key === 'list' ? id : null))
}
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

  it('shows a centered spinner, never a page-mimicking skeleton, while the picker loads (issue #366)', () => {
    getLists.mockImplementation(() => new Promise(() => {}))
    render(<DisplayMode />)
    const loading = screen.getByRole('status', { name: 'Loading lists' })
    expect(loading).toBeInTheDocument()
    // The picker's layout is unknowable while loading (list count, badges,
    // week chips), so the loading state must not mimic page geometry:
    // nothing may shift when the real picker arrives.
    expect(loading.querySelector('.sticky')).not.toBeInTheDocument()
    expect(loading).not.toHaveTextContent('Choose a list to show its pattern chart on the big screen.')
    expect(loading).not.toHaveTextContent('Present a list')
  })

  it('shows a centered spinner, never a page-mimicking skeleton, while a list loads (issue #366)', () => {
    mockListParam('l1')
    getListWithClassroom.mockImplementation(() => new Promise(() => {}))
    render(<DisplayMode />)
    const loading = screen.getByRole('status', { name: 'Loading chart' })
    expect(loading).toBeInTheDocument()
    // The chart's layout is unknowable while loading (pattern count, word
    // counts, rule text, keyword media), so the loading state
    // must not mimic page geometry: nothing may shift when the chart arrives.
    expect(loading.querySelector('.sticky')).not.toBeInTheDocument()
    expect(loading.querySelector('[data-chart-columns]')).not.toBeInTheDocument()
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

  it('gives picker cards the hover lift (issue #268)', async () => {
    getLists.mockResolvedValue([list])
    const { container } = render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('Week 5')).toBeInTheDocument()
    })
    const card = container.querySelector('[data-slot="card"]')
    expect(card).toHaveClass('hover:scale-[1.05]', 'hover:shadow-xl')
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
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: list, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(within(screen.getByRole('main')).getByText('Week 5')).toBeInTheDocument()
    })
    // Issue #379: the pattern sound always renders under the pattern name.
    expect(screen.getAllByText('long a')).toHaveLength(1)
    expect(screen.getByRole('region', { name: 'Pattern a_e' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Analyze the word cake' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hear the word cake' })).toBeInTheDocument()
  })

  it('links to the print view from the display header', async () => {
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: list, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(within(screen.getByRole('main')).getByText('Week 5')).toBeInTheDocument()
    })
    // Issue #379: the pattern sound always renders under the pattern name.
    expect(screen.getAllByText('long a')).toHaveLength(1)
    const printLink = screen.getByRole('link', { name: 'Print chart' })
    expect(printLink).toHaveAttribute('href', '/lists/l1/print')
  })

  it('enters sort mode directly from the Sort words button, with no class picker', async () => {
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: list, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(within(screen.getByRole('main')).getByText('Week 5')).toBeInTheDocument()
    })
    // Issue #379: the pattern sound always renders under the pattern name.
    expect(screen.getAllByText('long a')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Sort words' }))
    // Issue #263: no "Who is sorting?" picker; the list's classroom flows silently.
    expect(screen.queryByText('Who is sorting?')).not.toBeInTheDocument()
    // Issue #482: SortActivity is a dynamically imported chunk, so the sort
    // surface arrives asynchronously after the tap.
    await waitFor(() => {
      expect(screen.getByLabelText('Word tray')).toBeInTheDocument()
    })
    // Issue #379: the pattern sound always renders under the pattern name.
    expect(screen.getAllByText('long a')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Exit sort' }))
    await waitFor(() => {
      expect(within(screen.getByRole('main')).getByText('Week 5')).toBeInTheDocument()
    })
    // Issue #379: the pattern sound always renders under the pattern name.
    expect(screen.getAllByText('long a')).toHaveLength(1)
  })

  it('shows a full screen button in the chart header when supported', async () => {
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: list, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enter full screen' })).toBeInTheDocument()
    })
  })

  it('shows an error state when the selected list fails to load', async () => {
    mockListParam('l1')
    getListWithClassroom.mockRejectedValue(new Error('offline'))
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not load the word list')
    })
  })

  it('shows a Home breadcrumb link on the list picker', async () => {
    getLists.mockResolvedValue([list])
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Present a list' })).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/home')
  })

  it('links the picker breadcrumb to home with a plain link, never browser history', async () => {
    getLists.mockResolvedValue([list])
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/home')
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('shows a Present a list breadcrumb on the chart header', async () => {
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Week 5' })).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: 'Present a list' })).toHaveAttribute('href', '/display')
  })

  it('does not navigate on Escape from the list picker', async () => {
    getLists.mockResolvedValue([list])
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument()
    })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('does not navigate on Escape from the chart', async () => {
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: list, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(within(screen.getByRole('main')).getByText('Week 5')).toBeInTheDocument()
    })
    // Issue #379: the pattern sound always renders under the pattern name.
    expect(screen.getAllByText('long a')).toHaveLength(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(mockPush).not.toHaveBeenCalled()
    expect(mockBack).not.toHaveBeenCalled()
  })

  it('ignores non-Escape keys', async () => {
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: list, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(within(screen.getByRole('main')).getByText('Week 5')).toBeInTheDocument()
    })
    // Issue #379: the pattern sound always renders under the pattern name.
    expect(screen.getAllByText('long a')).toHaveLength(1)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(mockPush).not.toHaveBeenCalledWith('/display')
  })

  it('shows the chart rule display-only, with no edit affordances', async () => {
    const listWithRule = {
      ...twoPatternList,
      patterns: [{ ...twoPatternList.patterns[0], rule: 'Magic e.' }, twoPatternList.patterns[1]],
    }
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: listWithRule, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('Magic e.')).toBeInTheDocument()
    })
    // Issue #411: the filled slot and the empty slot both show the label.
    expect(screen.getAllByText('The rule:')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('shows the classroom rule on the chart when the list has a class', async () => {
    const listWithClass = { ...twoPatternList, classId: 'c1' }
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({
      list: listWithClass,
      classroom: { name: 'Period 2', rules: { a_e: 'ai never ends a word.' } },
    })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('ai never ends a word.')).toBeInTheDocument()
    })
    expect(screen.getByText('Our class figured out:')).toBeInTheDocument()
    // The classroom is clearly shown in the present header (issue #263).
    expect(screen.getByText('Period 2')).toBeInTheDocument()
  })

  it('renders the classroom pill and rules with the first paint, never flashing "No class" (issue #388)', async () => {
    const listWithClass = { ...twoPatternList, classId: 'c1' }
    mockListParam('l1')
    const fetchMock = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    vi.stubGlobal('fetch', fetchMock)
    getListWithClassroom.mockResolvedValue({
      list: listWithClass,
      classroom: { name: 'Period 2', rules: { a_e: 'ai never ends a word.' } },
    })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('Period 2')).toBeInTheDocument()
    })
    // The classroom arrives with the list, inside the single loading state:
    // no second fetch fires after the chart renders, so the pill and the
    // rule text cannot shift the loaded page.
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('/api/classes/c1'), expect.anything())
    expect(screen.queryByText('No class')).not.toBeInTheDocument()
    expect(screen.getByText('ai never ends a word.')).toBeInTheDocument()
  })

  it('shows "No class" in the present header when the list has no classroom', async () => {
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: twoPatternList, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('No class')).toBeInTheDocument()
    })
  })

  it('keeps the chart rule visible when there is no classroom rule', async () => {
    const listWithRule: WordList = {
      ...twoPatternList,
      patterns: [{ ...twoPatternList.patterns[0], rule: 'Magic e.' }, twoPatternList.patterns[1]],
    }
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: listWithRule, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('Magic e.')).toBeInTheDocument()
    })
    // Display-only: no delete affordance exists on the chart anymore.
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it('locks a pattern optimistically and persists via updateList', async () => {
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: twoPatternList, classroom: null })
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
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: twoPatternList, classroom: null })
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
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: twoPatternList, classroom: null })
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
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: twoPatternList, classroom: null })
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
      getListWithClassroom.mockResolvedValue({ list: list, classroom: null })
      const { rerender } = render(<DisplayMode />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument()
      })
      fireEvent.click(screen.getByRole('button', { name: '5' }))
      expect(screen.queryByText('No week list')).not.toBeInTheDocument()

      // Present a chart, then come back to a list set with no week 5.
      mockListParam('l1')
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
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: list, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Presenting tips' })).toBeInTheDocument()
    })
    expect(screen.getByText(/Press the fullscreen button for the biggest chart/)).toBeInTheDocument()
  })

  it('shows the "Why this chart?" button next to the list name', async () => {
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: list, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Why this chart?' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Why this chart?' }))
    expect(screen.getByRole('dialog', { name: 'Why this chart?' })).toBeInTheDocument()
  })

  it('truncates a long list name so it cannot push the header controls off (issue #312)', async () => {
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({
      list: { ...list, name: 'A very long list name that would crowd every control' },
      classroom: null,
    })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'A very long list name that would crowd every control' })
      ).toBeInTheDocument()
    })
    const heading = screen.getByRole('heading', { name: 'A very long list name that would crowd every control' })
    expect(heading).toHaveClass('min-w-0', 'flex-1', 'truncate')
  })

  it('shows the mobile chart options menu trigger in the chart header (issue #312)', async () => {
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: list, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Week 5' })).toBeInTheDocument()
    })
    // The trigger hides at sm and up; the desktop control bar hides below sm.
    expect(screen.getByRole('button', { name: 'Open chart options' })).toHaveClass('sm:hidden')
  })

  it('toggles the rules display from the mobile chart options menu (issue #312)', async () => {
    const ruledList: WordList = {
      ...list,
      patterns: [
        {
          id: 'p1',
          sound: 'long a',
          pattern: 'a_e',
          frequency: 'common',
          words: ['cake'],
          rule: 'Magic e.',
        },
      ],
    }
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: ruledList, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('The rule:')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open chart options' }))
    const sheet = await screen.findByRole('dialog', { name: 'Chart options' })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Show rules' }))
    // Issue #374: hiding animates the slot out, so it leaves the DOM after
    // the exit transition instead of vanishing synchronously.
    await waitFor(() => expect(screen.queryByText('The rule:')).not.toBeInTheDocument())
  })

  it('toggles word underlines from the mobile chart options menu (issue #312)', async () => {
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: list, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Analyze the word cake' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Open chart options' }))
    const sheet = await screen.findByRole('dialog', { name: 'Chart options' })
    const toggle = within(sheet).getByRole('button', { name: 'Show word underlines' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    // The open sheet hides the chart from the accessibility tree; close it
    // before asserting on the chart.
    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Chart options' })).not.toBeInTheDocument()
    })
    expect(
      screen.getByRole('button', { name: 'Analyze the word cake' }).querySelectorAll('span').length
    ).toBeGreaterThan(0)
  })

  it('hides the chart header while in full screen (issue #380)', async () => {
    Object.defineProperty(document.documentElement, 'requestFullscreen', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: list, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enter full screen' })).toBeInTheDocument()
    })
    // Full screen engaged outside the button: the header tracks reality via
    // fullscreenchange, the same event a real browser fires.
    act(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        writable: true,
        value: document.documentElement,
      })
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    // The top header is gone, including the full screen button itself; the
    // chart stays on screen.
    expect(screen.queryByRole('link', { name: 'Present a list' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Exit full screen' })).not.toBeInTheDocument()
    expect(within(screen.getByRole('main')).getByText('Week 5')).toBeInTheDocument()
    // Leaving full screen brings the header back.
    act(() => {
      Object.defineProperty(document, 'fullscreenElement', { configurable: true, writable: true, value: null })
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    expect(screen.getByRole('button', { name: 'Enter full screen' })).toBeInTheDocument()
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, writable: true, value: null })
  })

  it('exits full screen on Escape (issue #380)', async () => {
    const exitFullscreen = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, writable: true, value: exitFullscreen })
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: list, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(within(screen.getByRole('main')).getByText('Week 5')).toBeInTheDocument()
    })
    act(() => {
      Object.defineProperty(document, 'fullscreenElement', {
        configurable: true,
        writable: true,
        value: document.documentElement,
      })
      document.dispatchEvent(new Event('fullscreenchange'))
    })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(exitFullscreen).toHaveBeenCalledTimes(1)
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, writable: true, value: null })
  })
})

describe('DisplayMode sort-mode chrome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.get.mockReturnValue(null)
  })

  it('hides the present header and tips bar while sorting', async () => {
    window.localStorage.removeItem('patternspell-presenting-tips-dismissed')
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: list, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('region', { name: 'Presenting tips' })).toBeInTheDocument()
    })
    // The chart header shows the list name and the Sort words entry point.
    expect(screen.getByRole('heading', { name: 'Week 5' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sort words' }))

    // Sort mode: the sort surface fills the area, no header, no subheader.
    // Issue #482: SortActivity is a dynamically imported chunk, so the sort
    // surface arrives asynchronously after the tap.
    await waitFor(() => {
      expect(screen.getByLabelText('Word tray')).toBeInTheDocument()
    })
    expect(screen.queryByRole('heading', { name: 'Week 5' })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Presenting tips' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Print chart' })).not.toBeInTheDocument()
    // The sort surface brings its own Exit control.
    expect(screen.getByRole('button', { name: 'Exit sort' })).toBeInTheDocument()
  })

  it('shows the list classroom as a static pill in sort mode', async () => {
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({
      list: { ...list, classId: 'c1' },
      classroom: { name: 'Period 2', rules: {} },
    })
    // SortActivity loads the active class itself for rule recall; the
    // present page's joined classroom does not change that flow.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/classes/c1') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ class: { id: 'c1', name: 'Period 2', rules: {} } }),
          })
        }
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
      })
    )
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sort words' })).toBeInTheDocument()
    })
    // Issue #263: no picker; the list's classroom flows silently into sort.
    fireEvent.click(screen.getByRole('button', { name: 'Sort words' }))
    expect(screen.queryByText('Who is sorting?')).not.toBeInTheDocument()
    // Issue #482: SortActivity is a dynamically imported chunk, so the sort
    // surface arrives asynchronously after the tap.
    await waitFor(() => {
      expect(screen.getByLabelText('Word tray')).toBeInTheDocument()
    })
    // Sort mode shows the classroom as a display-only pill.
    const pill = await screen.findByText('Period 2')
    expect(pill.tagName).not.toBe('BUTTON')
    expect(pill.closest('button')).toBeNull()
    vi.unstubAllGlobals()
  })

  it('restores the present header and tips bar after exiting sort', async () => {
    window.localStorage.removeItem('patternspell-presenting-tips-dismissed')
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: list, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sort words' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sort words' }))
    // Issue #482: SortActivity is a dynamically imported chunk, so the sort
    // surface arrives asynchronously after the tap.
    await waitFor(() => {
      expect(screen.getByLabelText('Word tray')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Exit sort' }))
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Week 5' })).toBeInTheDocument()
    })
    expect(screen.getByRole('region', { name: 'Presenting tips' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sort words' })).toBeInTheDocument()
  })
})

describe('DisplayMode classroom rules loading', () => {
  it('continues without classroom rules when the classroom join degrades', async () => {
    // The server degrades a failed classroom read to classroom: null; the
    // chart still renders and the pill shows "No class".
    const listWithClass = { ...twoPatternList, classId: 'c1' }
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: listWithClass, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('No class')).toBeInTheDocument()
    })
    // The chart still renders; no classroom rule is shown.
    expect(screen.queryByText('Our class figured out:')).not.toBeInTheDocument()
  })

  it('shows the classroom with no classroom rule when the class has no rules yet', async () => {
    const listWithClass = { ...twoPatternList, classId: 'c1' }
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: listWithClass, classroom: { name: 'Period 2', rules: {} } })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('Period 2')).toBeInTheDocument()
    })
    // No rule rows: the chart falls back to the patterns' own rules.
    expect(screen.queryByText('Our class figured out:')).not.toBeInTheDocument()
  })
})

describe('DisplayMode chart display toggles', () => {
  it('toggles the rule display on the present chart', async () => {
    const ruledList: WordList = {
      ...list,
      patterns: [
        {
          id: 'p1',
          sound: 'long a',
          pattern: 'a_e',
          frequency: 'common',
          words: ['cake'],
          rule: 'Magic e.',
        },
      ],
    }
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: ruledList, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('The rule:')).toBeInTheDocument()
    })
    const toggle = screen.getByRole('button', { name: 'Show rules' })
    fireEvent.click(toggle)
    // Issue #374: hiding animates the slot out, so it leaves the DOM after
    // the exit transition instead of vanishing synchronously.
    await waitFor(() => expect(screen.queryByText('The rule:')).not.toBeInTheDocument())
    fireEvent.click(toggle)
    expect(screen.getByText('The rule:')).toBeInTheDocument()
  })

  it('toggles word underlines on the present chart, default off (issue #264)', async () => {
    mockListParam('l1')
    getListWithClassroom.mockResolvedValue({ list: list, classroom: null })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Analyze the word cake' })).toBeInTheDocument()
    })

    const toggle = screen.getByRole('button', { name: 'Show word underlines' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    // Underlines start off: the word button holds plain text, no spans.
    expect(screen.getByRole('button', { name: 'Analyze the word cake' }).querySelectorAll('span')).toHaveLength(0)

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    const underlined = screen.getByRole('button', { name: 'Analyze the word cake' })
    expect(underlined.querySelectorAll('span').length).toBeGreaterThan(0)
    // The word itself is unchanged.
    expect(underlined).toHaveTextContent('cake')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Analyze the word cake' }).querySelectorAll('span')).toHaveLength(0)
  })
})

describe('DisplayMode present-chart rule editing (issue #372)', () => {
  const KIDS_WORDS_LABEL = 'Rule, in the kids’ words'

  const classList: WordList = { ...twoPatternList, classId: 'c1' }

  // The classroom arrives joined into the list response (issue #388); only
  // rule saves/deletes still hit the classes API.
  const classroom = { name: 'Period 2', rules: { a_e: 'Class rule.' } }

  function stubClassFetch(rulesResponse: { ok: boolean; json?: () => Promise<unknown> }) {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/classes/c1/rules') {
        return Promise.resolve({ ok: rulesResponse.ok, json: rulesResponse.json ?? (async () => ({})) })
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockListParam('l1')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves an edited classroom rule with PUT and updates the chart', async () => {
    getListWithClassroom.mockResolvedValue({ list: classList, classroom })
    const fetchMock = stubClassFetch({ ok: true })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('Our class figured out:')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Edit rule for a_e' }))
    fireEvent.change(screen.getByLabelText(KIDS_WORDS_LABEL), { target: { value: 'Edited rule.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/classes/c1/rules',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ rules: { a_e: { rule: 'Edited rule.' } } }),
        })
      )
    })
    expect(screen.getByText('Edited rule.')).toBeInTheDocument()
  })

  it('deletes the classroom rule with DELETE when the teacher clears it', async () => {
    getListWithClassroom.mockResolvedValue({ list: classList, classroom })
    const fetchMock = stubClassFetch({ ok: true })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('Our class figured out:')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Edit rule for a_e' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/classes/c1/rules',
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ patternText: 'a_e' }),
        })
      )
    })
    // The class rule is gone and the pattern has no unscoped rule: the
    // callout disappears.
    expect(screen.queryByText('Our class figured out:')).not.toBeInTheDocument()
  })

  it('keeps the modal open with an error when saving the classroom rule fails', async () => {
    getListWithClassroom.mockResolvedValue({ list: classList, classroom })
    stubClassFetch({ ok: false })
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('Our class figured out:')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Edit rule for a_e' }))
    fireEvent.change(screen.getByLabelText(KIDS_WORDS_LABEL), { target: { value: 'Edited rule.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    await waitFor(() => {
      expect(screen.getByText('Could not save the rule. Try again.')).toBeInTheDocument()
    })
    expect(screen.getByRole('dialog', { name: 'Rule for a_e' })).toBeInTheDocument()
    // The displayed rule is unchanged.
    expect(screen.getByText('Class rule.')).toBeInTheDocument()
  })

  it('saves the unscoped rule on the pattern when the list has no classroom', async () => {
    const noClassList: WordList = {
      ...twoPatternList,
      patterns: [
        { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake'], rule: 'Magic e.' },
        { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'less-common', words: ['rain'] },
      ],
    }
    getListWithClassroom.mockResolvedValue({ list: noClassList, classroom: null })
    updateList.mockImplementation((id: string, patch: Partial<WordList>) =>
      Promise.resolve({ ...noClassList, ...patch, id })
    )
    render(<DisplayMode />)

    await waitFor(() => {
      // Issue #411: the filled slot and the empty slot both show the label.
      expect(screen.getAllByText('The rule:')).toHaveLength(2)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Edit rule for a_e' }))
    fireEvent.change(screen.getByLabelText(KIDS_WORDS_LABEL), { target: { value: 'New unscoped rule.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({
          patterns: expect.arrayContaining([
            expect.objectContaining({ id: 'p1', pattern: 'a_e', rule: 'New unscoped rule.' }),
          ]),
        })
      )
    })
    expect(screen.getByText('New unscoped rule.')).toBeInTheDocument()
  })

  it('clears the unscoped rule on the pattern when the teacher clears it without a classroom', async () => {
    const noClassList: WordList = {
      ...twoPatternList,
      patterns: [
        { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake'], rule: 'Magic e.' },
        { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'less-common', words: ['rain'] },
      ],
    }
    getListWithClassroom.mockResolvedValue({ list: noClassList, classroom: null })
    updateList.mockImplementation((id: string, patch: Partial<WordList>) =>
      Promise.resolve({ ...noClassList, ...patch, id })
    )
    render(<DisplayMode />)

    await waitFor(() => {
      // Issue #411: the filled slot and the empty slot both show the label.
      expect(screen.getAllByText('The rule:')).toHaveLength(2)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Edit rule for a_e' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({
          patterns: expect.arrayContaining([expect.objectContaining({ id: 'p1', rule: undefined })]),
        })
      )
    })
    // The rule text is gone, but the empty slots still show the label (issue #411).
    expect(screen.queryByText('Magic e.')).not.toBeInTheDocument()
    expect(screen.getAllByText('The rule:')).toHaveLength(2)
  })
})

describe('DisplayMode present-chart rule editing without cached class rules (issue #372)', () => {
  const KIDS_WORDS_LABEL = 'Rule, in the kids’ words'

  // The list has a classroom, but the classroom join degrades (classroom:
  // null), so the chart falls back to the patterns' unscoped rules. Saving
  // still targets the classroom, which starts from no cached rules.
  const classListNoRules: WordList = {
    ...twoPatternList,
    classId: 'c1',
    patterns: [
      { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake'], rule: 'Magic e.' },
      { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'less-common', words: ['rain'] },
    ],
  }

  // The classroom join degraded (classroom: null despite classId); only
  // rule saves/deletes still hit the classes API.
  function stubRulesOnly(rulesOk: boolean) {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/classes/c1/rules') {
        return Promise.resolve({ ok: rulesOk, json: async () => ({}) })
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockListParam('l1')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('saves to the classroom with PUT when there are no cached class rules', async () => {
    getListWithClassroom.mockResolvedValue({ list: classListNoRules, classroom: null })
    const fetchMock = stubRulesOnly(true)
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('No class')).toBeInTheDocument()
    })
    // The chart falls back to the unscoped rule, still editable.
    // Issue #411: the filled slot and the empty slot both show the label.
    expect(screen.getAllByText('The rule:')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Edit rule for a_e' }))
    expect(screen.getByLabelText(KIDS_WORDS_LABEL)).toHaveValue('Magic e.')
    fireEvent.change(screen.getByLabelText(KIDS_WORDS_LABEL), { target: { value: 'Edited rule.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/classes/c1/rules',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ rules: { a_e: { rule: 'Edited rule.' } } }),
        })
      )
    })
    expect(screen.getByText('Edited rule.')).toBeInTheDocument()
    expect(screen.getByText('Our class figured out:')).toBeInTheDocument()
  })

  it('clears the classroom rule with DELETE when there are no cached class rules', async () => {
    getListWithClassroom.mockResolvedValue({ list: classListNoRules, classroom: null })
    const fetchMock = stubRulesOnly(true)
    render(<DisplayMode />)

    await waitFor(() => {
      // Issue #411: the filled slot and the empty slot both show the label.
      expect(screen.getAllByText('The rule:')).toHaveLength(2)
    })
    fireEvent.click(screen.getByRole('button', { name: 'Edit rule for a_e' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/classes/c1/rules',
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ patternText: 'a_e' }),
        })
      )
    })
    // The unscoped fallback remains; only the (absent) class rule was cleared.
    expect(screen.getAllByText('The rule:')).toHaveLength(2)
    expect(screen.getByText('Magic e.')).toBeInTheDocument()
  })

  it('keeps the modal open with an error when clearing the classroom rule fails', async () => {
    const classList: WordList = { ...twoPatternList, classId: 'c1' }
    getListWithClassroom.mockResolvedValue({
      list: classList,
      classroom: { name: 'Period 2', rules: { a_e: 'Class rule.' } },
    })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/classes/c1/rules') {
          return Promise.resolve({ ok: false, status: 500, json: async () => ({}) })
        }
        return Promise.resolve({ ok: false, status: 404, json: async () => ({}) })
      })
    )
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('Our class figured out:')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Edit rule for a_e' }))
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))

    await waitFor(() => {
      expect(screen.getByText('Could not save the rule. Try again.')).toBeInTheDocument()
    })
    expect(screen.getByRole('dialog', { name: 'Rule for a_e' })).toBeInTheDocument()
    // The chart and the modal draft both still show the old rule.
    expect(screen.getAllByText('Class rule.')).toHaveLength(2)
  })
})

describe('DisplayMode song videos (issue #401)', () => {
  const video = {
    videoId: 'GdmcWQCbqY8',
    title: 'When Two Vowels Go Walking | Jack Hartmann Vowel Teams Song | Vowels Song',
    channel: 'Jack Hartmann Kids Music Channel',
    source: 'curated' as const,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockListParam('l1')
  })

  async function openVideoModal(current: WordList = twoPatternList) {
    getListWithClassroom.mockResolvedValue({ list: current, classroom: null })
    render(<DisplayMode />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Song videos for pattern ai' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Song videos for pattern ai' }))
    return screen.getByRole('dialog', { name: 'Song videos for pattern ai' })
  }

  it('attaches a suggested video optimistically and persists via updateList', async () => {
    const saved: WordList = {
      ...twoPatternList,
      patterns: [twoPatternList.patterns[0], { ...twoPatternList.patterns[1], videos: [video] }],
      updatedAt: '2026-10-09T00:00:00.000Z',
    }
    updateList.mockResolvedValue(saved)
    const dialogEl = await openVideoModal()

    fireEvent.click(within(dialogEl).getByRole('button', { name: `Add ${video.title}` }))
    const expectedPatterns = [twoPatternList.patterns[0], { ...twoPatternList.patterns[1], videos: [video] }]
    expect(updateList).toHaveBeenCalledWith('l1', { patterns: expectedPatterns })
    // The saved list flows back into the chart and the open modal.
    await waitFor(() => {
      expect(within(dialogEl).getByText('Attached videos (1)')).toBeInTheDocument()
    })
  })

  it('drops the videos field when the last video is removed', async () => {
    const withVideo: WordList = {
      ...twoPatternList,
      patterns: [twoPatternList.patterns[0], { ...twoPatternList.patterns[1], videos: [video] }],
    }
    updateList.mockResolvedValue(twoPatternList)
    const dialogEl = await openVideoModal(withVideo)

    fireEvent.click(within(dialogEl).getByRole('button', { name: `Remove ${video.title}` }))
    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith('l1', {
        patterns: [twoPatternList.patterns[0], twoPatternList.patterns[1]],
      })
    })
  })

  it('reverts the optimistic update and shows the error when the save fails', async () => {
    updateList.mockRejectedValue(new Error('offline'))
    const dialogEl = await openVideoModal()

    fireEvent.click(within(dialogEl).getByRole('button', { name: `Add ${video.title}` }))
    // The error shows inside the open modal: the DisplayMode alert renders
    // behind the dialog (aria-hidden) while it is open.
    await waitFor(() => {
      expect(within(dialogEl).getByRole('alert')).toHaveTextContent(
        'Could not save the videos. Check your connection and try again.'
      )
    })
    // The optimistic attach is reverted: the modal is back to zero videos.
    await waitFor(() => {
      expect(within(dialogEl).getByText('Attached videos (0)')).toBeInTheDocument()
    })
  })
})

describe('DisplayMode prebuilt weeks (issue #463)', () => {
  const prebuiltParams = (id: string | null) =>
    mockSearchParams.get.mockImplementation((key: string) => {
      if (key === 'prebuilt') return id
      return null
    })

  it('renders a prebuilt week chart with the Prebuilt badge and no API fetch', async () => {
    prebuiltParams('prebuilt-g2-w06')
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Grade 2 - Week 6/ })).toBeInTheDocument()
    })
    // The badge marks the prebuilt distinction in present mode.
    expect(screen.getByText('Ready-made')).toBeInTheDocument()
    // No API fetch for prebuilt weeks.
    expect(getLists).not.toHaveBeenCalled()
    expect(getListWithClassroom).not.toHaveBeenCalled()
  })

  it('renders the prebuilt chart read-only: no lock toggle control', async () => {
    prebuiltParams('prebuilt-g2-w06')
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Grade 2 - Week 6/ })).toBeInTheDocument()
    })
    // Lock toggles render as buttons named "Lock <pattern>" when the
    // onToggleLock callback is provided; prebuilt passes undefined.
    expect(screen.queryByRole('button', { name: /lock/i })).not.toBeInTheDocument()
  })

  it('shows the load error for an unknown prebuilt week id', async () => {
    prebuiltParams('prebuilt-nope')
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
    })
  })
})
