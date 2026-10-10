import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import Dashboard from './Dashboard'
import { clearActivity, logActivity } from '@/lib/activity'
import { LISTS_CHANGED_EVENT } from '@/lib/lists-api'
import { HttpError } from '@/lib/error-toast'
import type { WordList } from '@/models/WordList'

const { getLists } = vi.hoisted(() => ({
  getLists: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({ getLists, LISTS_CHANGED_EVENT: 'shepherd-speller:lists-changed' }))
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
  })

  it('greets the teacher by first name', async () => {
    getLists.mockResolvedValue([])
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /good (morning|afternoon|evening), donray/i })).toBeInTheDocument()
    })
    expect(screen.getByText('Here is your spelling toolkit for this week.')).toBeInTheDocument()
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

  it('shows only the three most recently touched lists, newest first', async () => {
    const makeList = (id: string, name: string, updatedAt: string): WordList => ({
      ...list,
      id,
      name,
      updatedAt,
    })
    getLists.mockResolvedValue([
      makeList('l1', 'Oldest', '2026-10-01T00:00:00.000Z'),
      makeList('l2', 'Newest', '2026-10-05T00:00:00.000Z'),
      makeList('l3', 'Middle', '2026-10-03T00:00:00.000Z'),
      makeList('l4', 'Second newest', '2026-10-04T00:00:00.000Z'),
      makeList('l5', 'Second oldest', '2026-10-02T00:00:00.000Z'),
    ])
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('My word lists (5)')).toBeInTheDocument()
    })
    const cards = screen.getAllByText(/Newest|Second newest|Middle|Second oldest|Oldest/)
    expect(cards.map((c) => c.textContent)).toEqual(['Newest', 'Second newest', 'Middle'])
    expect(screen.getByRole('link', { name: 'View all lists' })).toHaveAttribute('href', '/lists')
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
    logActivity('practiced', 'Practiced Week 5: Long A, 8 of 10 correct')
    logActivity('created', 'Created Week 6: Long E')
    logActivity('presented', 'Presented Week 5: Long A')
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
