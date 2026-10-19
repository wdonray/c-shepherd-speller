import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import Dashboard from './Dashboard'
import { clearActivity, logActivity } from '@/lib/activity'
import { LISTS_CHANGED_EVENT } from '@/lib/lists-api'
import { HttpError } from '@/lib/error-toast'
import { searchSongVideos } from '@/data/pattern-videos'
import type { WordList } from '@/models/WordList'

const { getLists } = vi.hoisted(() => ({
  getLists: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({ getLists, LISTS_CHANGED_EVENT: 'shepherd-speller:lists-changed' }))
vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }))
vi.mock('@/lib/report-error', () => ({ reportError }))

const { useBlockedVideos } = vi.hoisted(() => ({ useBlockedVideos: vi.fn() }))
vi.mock('@/hooks/useBlockedVideos', () => ({ useBlockedVideos }))

interface MockBlockedVideos {
  blockedVideos: { videoId: string; title: string; channel?: string }[]
  blockedVideoIds: Set<string>
  isLoaded: boolean
  userId: string | null
  blockVideo: ReturnType<typeof vi.fn>
  unblockVideo: ReturnType<typeof vi.fn>
}

function mockBlockedVideos(overrides: Partial<MockBlockedVideos> = {}) {
  const blockVideo = vi.fn()
  const unblockVideo = vi.fn()
  useBlockedVideos.mockReturnValue({
    blockedVideos: [],
    blockedVideoIds: new Set<string>(),
    isLoaded: true,
    userId: 'u1',
    blockVideo,
    unblockVideo,
    ...overrides,
  })
  return { blockVideo, unblockVideo }
}

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5: Long A',
  gradeLevel: '1',
  patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake'] }],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

function mockSession(name?: string) {
  vi.mocked(useSession).mockReturnValue({
    data: name ? { user: { id: 'u1', name } } : null,
    status: name ? 'authenticated' : 'unauthenticated',
    update: async () => null,
  } as never)
}

describe('Dashboard', () => {
  const defaultProps = {
    onNewList: vi.fn(),
    onEditList: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    clearActivity()
    mockSession('Donray Williams')
    mockBlockedVideos()
  })

  it('greets the teacher by first name', async () => {
    getLists.mockResolvedValue([])
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /good (morning|afternoon|evening), donray/i })).toBeInTheDocument()
    })
    expect(screen.queryByText('Here is your spelling toolkit for this week.')).not.toBeInTheDocument()
  })

  it('greets without a name when the session has none', async () => {
    mockSession()
    getLists.mockResolvedValue([])
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /^good (morning|afternoon|evening)$/i })).toBeInTheDocument()
    })
  })

  it('shows a loading state', () => {
    getLists.mockImplementation(() => new Promise(() => {}))
    render(<Dashboard {...defaultProps} />)
    expect(screen.getByRole('status', { name: 'Loading dashboard' })).toBeInTheDocument()
  })

  it('shows quick action buttons', async () => {
    getLists.mockResolvedValue([])
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New list' })).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: 'Practice' })).toHaveAttribute('href', '/practice')
    expect(screen.getByRole('link', { name: 'Present' })).toHaveAttribute('href', '/display')
  })

  it('calls onNewList when New list is clicked', async () => {
    const onNewList = vi.fn()
    getLists.mockResolvedValue([])
    render(<Dashboard {...defaultProps} onNewList={onNewList} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New list' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'New list' }))
    expect(onNewList).toHaveBeenCalled()
  })

  it('shows the empty state with the getting started guide', async () => {
    getLists.mockResolvedValue([])
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('No word lists yet')).toBeInTheDocument()
    })
    expect(screen.getAllByRole('button', { name: 'Create your first list' })).toHaveLength(2)
    expect(screen.getByText(/Getting started with pattern-based spelling/)).toBeInTheDocument()
    expect(screen.getByText(/One pattern learned is dozens of words spelled/)).toBeInTheDocument()
    expect(screen.getByText(/PatternSpell works with the program you already teach/)).toBeInTheDocument()
    expect(screen.getByText('Create a list')).toBeInTheDocument()
    expect(screen.getByText('Add patterns')).toBeInTheDocument()
    expect(screen.getByText('Present and practice')).toBeInTheDocument()
  })

  it('calls onNewList from the empty state', async () => {
    const onNewList = vi.fn()
    getLists.mockResolvedValue([])
    render(<Dashboard {...defaultProps} onNewList={onNewList} />)

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: 'Create your first list' })[0]).toBeInTheDocument()
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Create your first list' })[0])
    expect(onNewList).toHaveBeenCalled()
  })

  it('lists existing word lists', async () => {
    getLists.mockResolvedValue([list])
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('My word lists (1)')).toBeInTheDocument()
    })
    expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
  })

  it('links to the full lists page', async () => {
    getLists.mockResolvedValue([list])
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'View all lists' })).toHaveAttribute('href', '/lists')
    })
  })

  it('ranks the three shown lists by most recent activity, not last-updated', async () => {
    const makeList = (id: string, name: string, updatedAt: string): WordList => ({
      ...list,
      id,
      name,
      updatedAt,
    })
    getLists.mockResolvedValue([
      makeList('l1', 'Recently edited', '2026-10-05T00:00:00.000Z'),
      makeList('l2', 'Old but practiced today', '2026-10-01T00:00:00.000Z'),
      makeList('l3', 'Middle', '2026-10-03T00:00:00.000Z'),
      makeList('l4', 'Second newest', '2026-10-04T00:00:00.000Z'),
      makeList('l5', 'Never touched', '2026-09-01T00:00:00.000Z'),
    ])
    // Practicing the old list now outranks the more recently edited one.
    logActivity('practiced', 'Practiced Old but practiced today', 'l2')
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('My word lists (5)')).toBeInTheDocument()
    })
    const listsSection = screen.getByRole('region', { name: 'My word lists' })
    const cards = within(listsSection).getAllByText(
      /Recently edited|Old but practiced today|Middle|Second newest|Never touched/
    )
    expect(cards.map((c) => c.textContent)).toEqual(['Old but practiced today', 'Recently edited', 'Second newest'])
  })

  it('explains the preview and names the total when more than three lists exist', async () => {
    const makeList = (id: string, name: string, updatedAt: string): WordList => ({
      ...list,
      id,
      name,
      updatedAt,
    })
    getLists.mockResolvedValue([
      makeList('l1', 'First', '2026-10-01T00:00:00.000Z'),
      makeList('l2', 'Second', '2026-10-02T00:00:00.000Z'),
      makeList('l3', 'Third', '2026-10-03T00:00:00.000Z'),
      makeList('l4', 'Fourth', '2026-10-04T00:00:00.000Z'),
    ])
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('My word lists (4)')).toBeInTheDocument()
    })
    expect(screen.getByText('Showing your three most recently used lists.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View all 4 lists' })).toHaveAttribute('href', '/lists')
  })

  it('hides the preview caption when every list fits', async () => {
    getLists.mockResolvedValue([list])
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('My word lists (1)')).toBeInTheDocument()
    })
    expect(screen.queryByText('Showing your three most recently used lists.')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View all lists' })).toHaveAttribute('href', '/lists')
  })

  it('ignores activity older than the last edit when ranking', async () => {
    const makeList = (id: string, name: string, updatedAt: string): WordList => ({
      ...list,
      id,
      name,
      updatedAt,
    })
    // A practice event from before the last edit must not move the list up.
    localStorage.setItem(
      'shepherd-speller-activity',
      JSON.stringify([
        {
          id: 'stale',
          kind: 'practiced',
          text: 'Practiced Stale practice',
          listId: 'l1',
          at: Date.parse('2026-09-01T00:00:00.000Z'),
        },
      ])
    )
    getLists.mockResolvedValue([
      makeList('l1', 'Stale practice', '2026-10-05T00:00:00.000Z'),
      makeList('l2', 'Newer edit', '2026-10-06T00:00:00.000Z'),
    ])
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('My word lists (2)')).toBeInTheDocument()
    })
    const listsSection = screen.getByRole('region', { name: 'My word lists' })
    const cards = within(listsSection).getAllByText(/Stale practice|Newer edit/)
    expect(cards.map((c) => c.textContent)).toEqual(['Newer edit', 'Stale practice'])
  })

  it('calls onEditList when Open is clicked on a card', async () => {
    const onEditList = vi.fn()
    getLists.mockResolvedValue([list])
    render(<Dashboard {...defaultProps} onEditList={onEditList} />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Edit list' }))
    expect(onEditList).toHaveBeenCalledWith(list)
  })

  it('shows an error state and retries when loading fails', async () => {
    getLists.mockRejectedValue(new Error('network down'))
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not load your lists')
    })
    expect(screen.getByText('Check your connection and try again. Your lists are safe.')).toBeInTheDocument()

    getLists.mockResolvedValue([list])
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => {
      expect(screen.getByText('My word lists (1)')).toBeInTheDocument()
    })
  })

  it('fetches lists on mount even when the session is signed out', async () => {
    // The server middleware is the real auth gate (issue #480); the client
    // starts the data fetch in parallel with the session check instead of
    // waiting for it.
    mockSession()
    getLists.mockResolvedValue([])
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('My word lists (0)')).toBeInTheDocument()
    })
    expect(getLists).toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('No word lists yet')).toBeInTheDocument()
  })

  it('clears lists when the session is lost while mounted', async () => {
    mockSession('Donray Williams')
    getLists.mockResolvedValue([list])
    const { rerender } = render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })

    // Cross-tab sign-out or session refresh flips the session to
    // unauthenticated without a page navigation; the stale lists must not
    // keep rendering as if the teacher were still signed in (issue #480).
    mockSession()
    rerender(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.queryByText('Week 5: Long A')).not.toBeInTheDocument()
    })
    expect(screen.getByText('My word lists (0)')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('starts fetching lists while the session is still loading', async () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'loading',
      update: async () => null,
    } as never)
    getLists.mockImplementation(() => new Promise(() => {}))
    render(<Dashboard {...defaultProps} />)

    // The list fetch fires before the session resolves (issue #480); the
    // dashboard skeleton covers the wait.
    expect(getLists).toHaveBeenCalled()
    expect(screen.getByRole('status', { name: 'Loading dashboard' })).toBeInTheDocument()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('treats a 401 from getLists as signed out, not an error', async () => {
    mockSession('Donray Williams')
    getLists.mockRejectedValue(new HttpError('Unauthorized', 401))
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('My word lists (0)')).toBeInTheDocument()
    })
    expect(reportError).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('No word lists yet')).toBeInTheDocument()
  })

  it('reloads lists when the lists-changed event fires', async () => {
    getLists.mockResolvedValue([])
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('My word lists (0)')).toBeInTheDocument()
    })
    getLists.mockResolvedValue([list])
    window.dispatchEvent(new Event(LISTS_CHANGED_EVENT))

    await waitFor(() => {
      expect(screen.getByText('My word lists (1)')).toBeInTheDocument()
    })
  })

  it('shows recent activity when events exist', async () => {
    logActivity('practiced', 'Practiced Week 5: Long A, 8 of 10 correct', 'l1')
    logActivity('created', 'Created Week 6: Long E', 'l2')
    logActivity('presented', 'Presented Week 5: Long A')
    logActivity('edited', 'Edited Week 5: Long A', 'l1')
    logActivity('deleted', 'Deleted Week 4: Long U')
    getLists.mockResolvedValue([])

    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('Recent activity')).toBeInTheDocument()
    })
    expect(screen.getByText(/Practiced Week 5: Long A, 8 of 10 correct/)).toBeInTheDocument()
    expect(screen.getByText(/Created Week 6: Long E/)).toBeInTheDocument()
    // Each activity kind shows a labeled chip with its color classes.
    const practicedChip = screen.getByText('Practiced', { selector: 'span' })
    expect(practicedChip).toHaveClass('bg-leaf-soft', 'text-leaf-ink')
    const createdChip = screen.getByText('Created', { selector: 'span' })
    expect(createdChip).toHaveClass('bg-plum-soft', 'text-plum-ink')
    const presentedChip = screen.getByText('Presented', { selector: 'span' })
    expect(presentedChip).toHaveClass('bg-sky-soft', 'text-sky-ink')
    const editedChip = screen.getByText('Edited', { selector: 'span' })
    expect(editedChip).toHaveClass('bg-sun-soft', 'text-sun-ink')
    const deletedChip = screen.getByText('Deleted', { selector: 'span' })
    expect(deletedChip).toHaveClass('bg-coral-soft', 'text-coral-ink')
    // Events with a list id link to the list's editor.
    expect(screen.getByRole('link', { name: 'Created Week 6: Long E' })).toHaveAttribute('href', '/lists/l2')
    expect(screen.getByRole('link', { name: 'Edited Week 5: Long A' })).toHaveAttribute('href', '/lists/l1')
    // The link must be discoverable without hover (touch devices have no
    // hover), so it carries its own visible color and underline instead of
    // revealing the underline only on hover.
    const entryLink = screen.getByRole('link', { name: 'Created Week 6: Long E' })
    expect(entryLink).toHaveClass('text-sky-deep', 'underline')
    expect(entryLink.className).not.toMatch(/hover:decoration-current/)
    expect(entryLink.className).not.toMatch(/decoration-line/)
    // Presented without a list id, and deleted lists, are plain text.
    expect(screen.queryByRole('link', { name: 'Presented Week 5: Long A' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Deleted Week 4: Long U' })).not.toBeInTheDocument()
    expect(screen.getByText(/Deleted Week 4: Long U/)).toBeInTheDocument()
  })

  it('hides the recent activity section when there are no events', async () => {
    getLists.mockResolvedValue([])
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('My word lists (0)')).toBeInTheDocument()
    })
    expect(screen.queryByText('Recent activity')).not.toBeInTheDocument()
  })
})

describe('Dashboard song videos (issues #401, #439)', () => {
  const defaultProps = {
    onNewList: vi.fn(),
    onEditList: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    clearActivity()
    mockSession('Donray Williams')
    mockBlockedVideos()
  })

  async function loadDashboard() {
    getLists.mockResolvedValue([])
    render(<Dashboard {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Song videos' })).toBeInTheDocument()
    })
  }

  it('shows the spotlight with three featured videos, a search box, and a browse-all link', async () => {
    await loadDashboard()
    const section = screen.getByRole('region', { name: 'Song videos' })
    // Three featured picks, not the whole bank.
    expect(within(section).getAllByRole('button', { name: /^Play / })).toHaveLength(3)
    expect(screen.getByRole('button', { name: /Play When Two Vowels Go Walking/ })).toBeInTheDocument()
    // One search box replaces the chip wall.
    expect(within(section).queryByRole('group', { name: 'Filter videos by pattern' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Search song videos')).toBeInTheDocument()
    // One link to the full catalog.
    const browseAll = screen.getByRole('link', { name: 'Browse all 19 song videos' })
    expect(browseAll).toHaveAttribute('href', '/videos')
  })

  it('search narrows the spotlight and the browse link carries the query', async () => {
    await loadDashboard()
    fireEvent.change(screen.getByLabelText('Search song videos'), { target: { value: 'Jack Hartmann' } })
    const section = screen.getByRole('region', { name: 'Song videos' })
    const expected = searchSongVideos('Jack Hartmann')
    expect(expected.length).toBeGreaterThan(3)
    expect(within(section).getAllByRole('button', { name: /^Play / })).toHaveLength(3)
    const link = screen.getByRole('link', { name: `See all ${expected.length} matching videos` })
    expect(link).toHaveAttribute('href', '/videos?q=Jack%20Hartmann')
  })

  it('opens the player modal in browse-only mode from a video card', async () => {
    await loadDashboard()
    fireEvent.click(screen.getByRole('button', { name: /Play When Two Vowels Go Walking/ }))
    const dialogEl = screen.getByRole('dialog', { name: 'Song videos' })
    // Browse-only: no suggestions, search, paste, or remove controls. The
    // signed-in teacher does get the add-to-list flow (issue #449).
    expect(within(dialogEl).queryByRole('button', { name: /^Remove / })).not.toBeInTheDocument()
    expect(within(dialogEl).queryByLabelText('Search videos by title or channel')).not.toBeInTheDocument()
    expect(within(dialogEl).getByRole('button', { name: 'Add to list' })).toBeInTheDocument()
    // The clicked video plays immediately.
    const frame = screen.getByTitle('When Two Vowels Go Walking | Jack Hartmann Vowel Teams Song | Vowels Song')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/GdmcWQCbqY8?rel=0&cc_load_policy=1')
    fireEvent.click(screen.getByRole('button', { name: 'Back to videos' }))
    expect(
      screen.queryByTitle('When Two Vowels Go Walking | Jack Hartmann Vowel Teams Song | Vowels Song')
    ).not.toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Song videos' })).not.toBeInTheDocument()
  })

  it('hides the Add to list button in the player modal for signed-out visitors', async () => {
    mockSession()
    render(<Dashboard {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Song videos' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /Play When Two Vowels Go Walking/ }))
    const dialogEl = screen.getByRole('dialog', { name: 'Song videos' })
    expect(within(dialogEl).queryByRole('button', { name: 'Add to list' })).not.toBeInTheDocument()
  })

  it('skeleton mirrors the song video spotlight while loading', () => {
    getLists.mockImplementation(() => new Promise(() => {}))
    render(<Dashboard {...defaultProps} />)
    const loading = screen.getByRole('status', { name: 'Loading dashboard' })
    // One search box placeholder instead of chip placeholders.
    expect(loading.querySelectorAll('div.h-12')).toHaveLength(1)
    // Three card placeholders.
    expect(loading.querySelectorAll('div.aspect-video')).toHaveLength(3)
    // One browse-all button placeholder.
    expect(loading.querySelectorAll('div.h-11.w-56')).toHaveLength(1)
  })

  describe('hidden videos (issue #443)', () => {
    it('filters hidden videos out of the spotlight', async () => {
      mockBlockedVideos({ blockedVideoIds: new Set(['GdmcWQCbqY8']) })
      await loadDashboard()
      const section = screen.getByRole('region', { name: 'Song videos' })
      expect(within(section).getAllByRole('button', { name: /^Play / })).toHaveLength(2)
      expect(screen.queryByRole('button', { name: /Play When Two Vowels Go Walking/ })).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: 'Browse all 18 song videos' })).toBeInTheDocument()
    })

    it('hides a video from its spotlight card', async () => {
      const { blockVideo } = mockBlockedVideos()
      await loadDashboard()
      fireEvent.click(screen.getByRole('button', { name: /Hide When Two Vowels Go Walking/ }))
      expect(blockVideo).toHaveBeenCalledWith(
        expect.objectContaining({
          videoId: 'GdmcWQCbqY8',
          title: 'When Two Vowels Go Walking | Jack Hartmann Vowel Teams Song | Vowels Song',
        })
      )
    })

    it('shows no Hide buttons when signed out', async () => {
      mockSession()
      mockBlockedVideos({ userId: null })
      await loadDashboard()
      expect(screen.queryByRole('button', { name: /^Hide / })).not.toBeInTheDocument()
    })

    it('holds the loading state until the hidden-video list resolves', async () => {
      mockBlockedVideos({ isLoaded: false })
      getLists.mockResolvedValue([])
      const { rerender } = render(<Dashboard {...defaultProps} />)
      await waitFor(() => expect(getLists).toHaveBeenCalled())
      // Lists are in, but the hidden-video list is not: still loading.
      expect(screen.getByRole('status', { name: 'Loading dashboard' })).toBeInTheDocument()
      mockBlockedVideos({ isLoaded: true })
      rerender(<Dashboard {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Song videos' })).toBeInTheDocument()
      })
    })

    it('does not hold the loading state for signed-out visitors', async () => {
      mockSession()
      mockBlockedVideos({ isLoaded: false, userId: null })
      getLists.mockResolvedValue([])
      render(<Dashboard {...defaultProps} />)
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Song videos' })).toBeInTheDocument()
      })
    })
  })
})
