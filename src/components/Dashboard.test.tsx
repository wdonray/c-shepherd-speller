import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import Dashboard from './Dashboard'
import { clearActivity, logActivity } from '@/lib/activity'
import { LISTS_CHANGED_EVENT } from '@/lib/lists-api'
import { HttpError } from '@/lib/error-toast'
import { getAllPatternGroups } from '@/data/pattern-videos'
import type { WordList } from '@/models/WordList'

const { getLists } = vi.hoisted(() => ({
  getLists: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({ getLists, LISTS_CHANGED_EVENT: 'shepherd-speller:lists-changed' }))
const { getVideoLibrary } = vi.hoisted(() => ({
  getVideoLibrary: vi.fn(),
}))
vi.mock('@/lib/video-library-api', () => ({ getVideoLibrary }))
vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }))
vi.mock('@/lib/report-error', () => ({ reportError }))

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
    getVideoLibrary.mockResolvedValue([])
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

  it('does not fetch lists when signed out', async () => {
    mockSession()
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('My word lists (0)')).toBeInTheDocument()
    })
    expect(getLists).not.toHaveBeenCalled()
    expect(getVideoLibrary).not.toHaveBeenCalled()
    expect(reportError).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByText('No word lists yet')).toBeInTheDocument()
  })

  it('does not fetch lists while the session is still loading', async () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: 'loading',
      update: async () => null,
    } as never)
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByRole('status', { name: 'Loading dashboard' })).toBeInTheDocument()
    })
    expect(getLists).not.toHaveBeenCalled()
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

describe('Dashboard song videos (issue #401)', () => {
  const defaultProps = {
    onNewList: vi.fn(),
    onEditList: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    clearActivity()
    mockSession('Donray Williams')
    getVideoLibrary.mockResolvedValue([])
  })

  async function loadDashboard() {
    getLists.mockResolvedValue([])
    getVideoLibrary.mockResolvedValue([])
    render(<Dashboard {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Song videos (19)' })).toBeInTheDocument()
    })
  }

  it('shows the browse section below My word lists with pattern chips and video cards', async () => {
    await loadDashboard()
    const section = screen.getByRole('region', { name: 'Song videos' })
    const chips = within(screen.getByRole('group', { name: 'Filter videos by pattern' })).getAllByRole('button')
    expect(chips).toHaveLength(getAllPatternGroups().length + 1)
    expect(chips[0]).toHaveTextContent('All')
    // All 19 bank videos show under "All".
    expect(within(section).getAllByRole('button', { name: /^Play / })).toHaveLength(19)
    expect(screen.getByRole('button', { name: 'Play Digraph CK - 4 Minute Phonics' })).toBeInTheDocument()
  })

  it('filters videos by pattern chip', async () => {
    await loadDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'ck' }))
    const section = screen.getByRole('region', { name: 'Song videos' })
    expect(within(section).getAllByRole('button', { name: /^Play / })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Play Digraph CK - 4 Minute Phonics' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(within(section).getAllByRole('button', { name: /^Play / })).toHaveLength(19)
  })

  it('opens the player modal in browse-only mode from a video card', async () => {
    await loadDashboard()
    fireEvent.click(screen.getByRole('button', { name: 'Play Digraph CK - 4 Minute Phonics' }))
    const dialogEl = screen.getByRole('dialog', { name: 'Song videos' })
    // Browse-only: no suggestions, search, paste, or remove controls.
    expect(within(dialogEl).queryByRole('button', { name: /^(Add|Remove) / })).not.toBeInTheDocument()
    expect(within(dialogEl).queryByLabelText('Search videos by title or channel')).not.toBeInTheDocument()
    // The clicked video plays immediately.
    const frame = screen.getByTitle('Digraph CK - 4 Minute Phonics')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/qEgggBAF_nw?rel=0&cc_load_policy=1')
    fireEvent.click(screen.getByRole('button', { name: 'Back to videos' }))
    expect(screen.queryByTitle('Digraph CK - 4 Minute Phonics')).not.toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Song videos' })).not.toBeInTheDocument()
  })

  it('skeleton mirrors the song videos chips and cards while loading', () => {
    getLists.mockImplementation(() => new Promise(() => {}))
    render(<Dashboard {...defaultProps} />)
    const loading = screen.getByRole('status', { name: 'Loading dashboard' })
    // One chip placeholder per pattern group plus "All".
    expect(loading.querySelectorAll('div.h-9.w-16')).toHaveLength(getAllPatternGroups().length + 1)
    // One card placeholder per bank video.
    expect(loading.querySelectorAll('div.aspect-video')).toHaveLength(19)
  })

  it('counts the bank in the browse heading when the teacher never pasted a link (issue #458)', async () => {
    await loadDashboard()
    expect(screen.getByRole('heading', { name: 'Song videos (19)' })).toBeInTheDocument()
  })

  it('merges her pasted videos after the bank and counts the real library (issue #458)', async () => {
    getLists.mockResolvedValue([])
    getVideoLibrary.mockResolvedValue([
      { videoId: 'dQw4w9WgXcQ', title: 'My pasted song', channel: 'My Channel', source: 'custom' },
    ])
    render(<Dashboard {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Song videos (20)' })).toBeInTheDocument()
    })
    const section = screen.getByRole('region', { name: 'Song videos' })
    expect(within(section).getAllByRole('button', { name: /^Play / })).toHaveLength(20)
    // Her video renders as a uniform card with no pattern tags.
    const card = screen.getByRole('button', { name: 'Play My pasted song' })
    expect(within(card).getByText('My Channel')).toBeInTheDocument()
    expect(within(card).queryByText(/^Patterns:/)).not.toBeInTheDocument()
    // The bank keeps its pattern line and stays first.
    const cards = within(section).getAllByRole('button', { name: /^Play / })
    expect(cards[0]).toHaveAttribute('aria-label', expect.stringContaining('When Two Vowels Go Walking'))
    expect(cards[19]).toHaveAttribute('aria-label', 'Play My pasted song')
  })

  it('plays her video from the browse grid (issue #458)', async () => {
    getLists.mockResolvedValue([])
    getVideoLibrary.mockResolvedValue([
      { videoId: 'dQw4w9WgXcQ', title: 'My pasted song', channel: 'My Channel', source: 'custom' },
    ])
    render(<Dashboard {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Song videos (20)' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Play My pasted song' }))
    const frame = screen.getByTitle('My pasted song')
    expect(frame.tagName).toBe('IFRAME')
    expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&cc_load_policy=1')
  })

  it('keeps pattern chips on the bank: her untagged videos show under All only (issue #458)', async () => {
    getLists.mockResolvedValue([])
    getVideoLibrary.mockResolvedValue([
      { videoId: 'dQw4w9WgXcQ', title: 'My pasted song', channel: 'My Channel', source: 'custom' },
    ])
    render(<Dashboard {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Song videos (20)' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'ck' }))
    const section = screen.getByRole('region', { name: 'Song videos' })
    expect(within(section).getAllByRole('button', { name: /^Play / })).toHaveLength(1)
    expect(screen.queryByRole('button', { name: 'Play My pasted song' })).not.toBeInTheDocument()
    // The heading still counts her whole library.
    expect(screen.getByRole('heading', { name: 'Song videos (20)' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    expect(within(section).getAllByRole('button', { name: /^Play / })).toHaveLength(20)
  })

  it('degrades to the bank when the library fetch fails (issue #458)', async () => {
    getLists.mockResolvedValue([])
    getVideoLibrary.mockRejectedValue(new Error('boom'))
    render(<Dashboard {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Song videos (19)' })).toBeInTheDocument()
    })
    expect(reportError).toHaveBeenCalledWith(expect.anything(), { location: 'Dashboard.loadVideoLibrary' })
    const section = screen.getByRole('region', { name: 'Song videos' })
    expect(within(section).getAllByRole('button', { name: /^Play / })).toHaveLength(19)
  })

  it('renders her video without a channel line when oEmbed had no author (issue #458)', async () => {
    getLists.mockResolvedValue([])
    getVideoLibrary.mockResolvedValue([{ videoId: 'dQw4w9WgXcQ', title: 'Channel-less song', source: 'custom' }])
    render(<Dashboard {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Song videos (20)' })).toBeInTheDocument()
    })
    const card = screen.getByRole('button', { name: 'Play Channel-less song' })
    const lines = within(card).getAllByRole('paragraph')
    expect(lines).toHaveLength(1)
    expect(lines[0]).toHaveTextContent('Channel-less song')
  })
})
