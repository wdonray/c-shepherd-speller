import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import PatternListsManager from './PatternListsManager'
import { ErrorToaster } from './error-toaster'
import type { WordList, SpellingPattern } from '@/models/WordList'

const { getLists, deleteList, notifyListsChanged } = vi.hoisted(() => ({
  getLists: vi.fn(),
  deleteList: vi.fn(),
  notifyListsChanged: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({
  getLists,
  deleteList,
  notifyListsChanged,
  LISTS_CHANGED_EVENT: 'shepherd-speller:lists-changed',
}))

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const patternA: SpellingPattern = {
  id: 'p1',
  sound: 'long a',
  pattern: 'a_e',
  frequency: 'common',
  words: ['cake', 'bake'],
}
const patternB: SpellingPattern = {
  id: 'p2',
  sound: 'long a',
  pattern: 'ay',
  frequency: 'rare',
  words: ['day'],
}

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5: Long A',
  gradeLevel: '1',
  patterns: [patternA],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}
const list2: WordList = {
  id: 'l2',
  userId: 'u1',
  name: 'Week 6',
  patterns: [patternB],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('PatternListsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows loading skeletons, then the lists', async () => {
    getLists.mockResolvedValue([list, list2])
    render(<PatternListsManager />)

    expect(screen.getByRole('status', { name: 'Loading word lists' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText('My word lists (2)')).toBeInTheDocument()
    })
    expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
  })

  it('shows an error card and retries when loading fails', async () => {
    getLists.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce([list])
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Could not load your lists')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => {
      expect(screen.getByText('My word lists (1)')).toBeInTheDocument()
    })
    expect(getLists).toHaveBeenCalledTimes(2)
  })

  it('shows the empty state when there are no lists', async () => {
    getLists.mockResolvedValue([])
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('No word lists yet')).toBeInTheDocument()
    })
  })

  it('renders exactly one New list control in each overview state', async () => {
    getLists.mockResolvedValue([])
    const { unmount } = render(<PatternListsManager />)

    await screen.findByText('No word lists yet')
    // Only the empty-state CTA renders; the header-row button is hidden.
    expect(screen.getAllByRole('button', { name: /new list/i })).toHaveLength(1)
    unmount()

    getLists.mockResolvedValue([list, list2])
    render(<PatternListsManager />)

    await screen.findByText('My word lists (2)')
    // Only the header-row button renders; there is no second CTA.
    expect(screen.getAllByRole('button', { name: /new list/i })).toHaveLength(1)
  })

  it('navigates to the new-list page from the overview', async () => {
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)

    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('button', { name: 'New list' }))

    expect(mockPush).toHaveBeenCalledWith('/lists/new')
  })

  it('navigates to the new-list page from the empty state', async () => {
    getLists.mockResolvedValue([])
    render(<PatternListsManager />)

    await screen.findByText('No word lists yet')
    fireEvent.click(screen.getByRole('button', { name: 'New list' }))

    expect(mockPush).toHaveBeenCalledWith('/lists/new')
  })

  it('confirms and deletes a list', async () => {
    getLists.mockResolvedValue([list, list2])
    deleteList.mockResolvedValue(undefined)
    render(<PatternListsManager />)

    await screen.findByText('My word lists (2)')
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])

    expect(screen.getByRole('heading', { name: 'Delete this list?' })).toBeInTheDocument()
    expect(
      screen.getByText('Delete "Week 5: Long A" with its 1 pattern and 2 words? This cannot be undone.')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(deleteList).toHaveBeenCalledWith('l1')
    })
    expect(notifyListsChanged).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByText('My word lists (1)')).toBeInTheDocument()
    })
    expect(screen.queryByText('Week 5: Long A')).not.toBeInTheDocument()
  })

  it('uses singular counts in the list delete dialog', async () => {
    getLists.mockResolvedValue([list2])
    render(<PatternListsManager />)

    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(
      screen.getByText('Delete "Week 6" with its 1 pattern and 1 word? This cannot be undone.')
    ).toBeInTheDocument()
  })

  it('closes the list delete dialog with Escape', async () => {
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)

    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByRole('heading', { name: 'Delete this list?' })

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete this list?' })).not.toBeInTheDocument()
    })
    expect(deleteList).not.toHaveBeenCalled()
  })

  it('uses the plural when deleting a multi-pattern list', async () => {
    const big: WordList = { ...list, patterns: [{ ...patternA }, { ...patternB }] }
    getLists.mockResolvedValue([big])
    deleteList.mockResolvedValue(undefined)
    render(<PatternListsManager />)

    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(
      screen.getByText('Delete "Week 5: Long A" with its 2 patterns and 3 words? This cannot be undone.')
    ).toBeInTheDocument()
  })

  it('keeps the list when the list delete is cancelled', async () => {
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)

    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete this list?' })).not.toBeInTheDocument()
    })
    expect(deleteList).not.toHaveBeenCalled()
    expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
  })

  it('renders list cards in a responsive multi-column grid', async () => {
    getLists.mockResolvedValue([list, list2])
    render(<PatternListsManager />)

    await screen.findByText('My word lists (2)')
    const grid = screen.getByTestId('lists-grid')
    expect(grid).toHaveClass('grid', 'gap-4', 'sm:grid-cols-2', 'lg:grid-cols-3')
    expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    expect(screen.getByText('Week 6')).toBeInTheDocument()
  })

  it('navigates to the list page when Edit list is clicked', async () => {
    getLists.mockResolvedValue([list, list2])
    render(<PatternListsManager />)

    await screen.findByText('My word lists (2)')
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit list' })[0])

    expect(mockPush).toHaveBeenCalledWith('/lists/l1')
  })

  it('shows a toast when deleting a list fails', async () => {
    getLists.mockResolvedValue([list])
    deleteList.mockRejectedValue(new Error('network down'))
    render(
      <>
        <PatternListsManager />
        <ErrorToaster />
      </>
    )

    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
    })
    expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
  })
})
