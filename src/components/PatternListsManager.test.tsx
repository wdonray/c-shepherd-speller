import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import PatternListsManager from './PatternListsManager'
import { ErrorToaster } from './error-toaster'
import type { WordList, SpellingPattern } from '@/models/WordList'

const { getLists, deleteList, updateList, notifyListsChanged } = vi.hoisted(() => ({
  getLists: vi.fn(),
  deleteList: vi.fn(),
  updateList: vi.fn(),
  notifyListsChanged: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({
  getLists,
  deleteList,
  updateList,
  notifyListsChanged,
  LISTS_CHANGED_EVENT: 'shepherd-speller:lists-changed',
}))

const { logActivity } = vi.hoisted(() => ({
  logActivity: vi.fn(),
}))
vi.mock('@/lib/activity', () => ({ logActivity }))

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

const { dndProps } = vi.hoisted(() => ({
  dndProps: {} as { onDragEnd?: (event: import('@dnd-kit/core').DragEndEvent) => void },
}))

const { toggleFavoriteOverride } = vi.hoisted(() => ({
  toggleFavoriteOverride: { current: null as null | (() => null) },
}))
vi.mock('@/lib/list-organize', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/list-organize')>()
  return {
    ...actual,
    toggleFavorite: (...args: Parameters<typeof actual.toggleFavorite>) => {
      if (toggleFavoriteOverride.current) return toggleFavoriteOverride.current()
      return actual.toggleFavorite(...args)
    },
  }
})
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return {
    ...actual,
    // Capture DndContext props so tests can invoke onDragEnd directly;
    // the real context provider still drives the cards.
    DndContext: (props: React.ComponentProps<typeof actual.DndContext>) => {
      dndProps.onDragEnd = props.onDragEnd
      return <actual.DndContext {...props} />
    },
  }
})

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
    toggleFavoriteOverride.current = null
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
    expect(logActivity).toHaveBeenCalledWith('deleted', 'Week 5: Long A')
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

describe('favorites (issue #275)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('stars a list when the star button is clicked', async () => {
    getLists.mockResolvedValue([list, list2])
    updateList.mockResolvedValue({ ...list, isFavorite: true, favoriteOrder: 0 })
    render(<PatternListsManager />)
    await screen.findByText('My word lists (2)')

    fireEvent.click(screen.getByRole('button', { name: 'Add Week 5: Long A to favorites' }))
    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith('l1', { isFavorite: true, favoriteOrder: 0 })
    })
    expect(screen.getByRole('button', { name: 'Remove Week 5: Long A from favorites' })).toBeInTheDocument()
  })

  it('rolls back the star when the update fails', async () => {
    getLists.mockResolvedValue([list])
    updateList.mockRejectedValue(new Error('network down'))
    render(
      <>
        <PatternListsManager />
        <ErrorToaster />
      </>
    )
    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Add Week 5: Long A to favorites' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Add Week 5: Long A to favorites' })).toBeInTheDocument()
    })
  })

  it('shows All/Favorites tabs only when a favorite exists', async () => {
    getLists.mockResolvedValue([list, list2])
    updateList.mockResolvedValue({ ...list, isFavorite: true, favoriteOrder: 0 })
    render(<PatternListsManager />)
    await screen.findByText('My word lists (2)')
    expect(screen.queryByRole('tablist', { name: 'List views' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add Week 5: Long A to favorites' }))
    await waitFor(() => {
      expect(screen.getByRole('tablist', { name: 'List views' })).toBeInTheDocument()
    })
  })

  it('filters to favorites while keeping them in All with a filled star', async () => {
    const starred = { ...list, isFavorite: true, favoriteOrder: 0 }
    getLists.mockResolvedValue([starred, list2])
    render(<PatternListsManager />)
    await screen.findByText('My word lists (2)')

    fireEvent.click(screen.getByRole('tab', { name: 'Favorites' }))
    expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    expect(screen.queryByText('Week 6')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'All' }))
    expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    expect(screen.getByText('Week 6')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Remove Week 5: Long A from favorites' })).toBeInTheDocument()
  })

  it('persists the selected view across sessions', async () => {
    const starred = { ...list, isFavorite: true, favoriteOrder: 0 }
    getLists.mockResolvedValue([starred, list2])
    const { unmount } = render(<PatternListsManager />)
    await screen.findByText('My word lists (2)')
    fireEvent.click(screen.getByRole('tab', { name: 'Favorites' }))
    expect(window.localStorage.getItem('patternspell:lists-view')).toBe('favorites')
    unmount()

    render(<PatternListsManager />)
    await screen.findByText('My word lists (2)')
    expect(screen.getByRole('tab', { name: 'Favorites' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.queryByText('Week 6')).not.toBeInTheDocument()
  })

  it('falls back to All when the stored view is favorites but none exist', async () => {
    window.localStorage.setItem('patternspell:lists-view', 'favorites')
    getLists.mockResolvedValue([list, list2])
    render(<PatternListsManager />)
    await screen.findByText('My word lists (2)')
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByText('Week 6')).toBeInTheDocument()
  })

  it('toggles a favorite on swipe right', async () => {
    getLists.mockResolvedValue([list])
    updateList.mockResolvedValue({ ...list, isFavorite: true, favoriteOrder: 0 })
    render(<PatternListsManager />)
    await screen.findByText('My word lists (1)')

    const card = screen.getByText('Week 5: Long A').closest('[data-testid="lists-grid"] > div')!
    fireEvent.touchStart(card, { touches: [{ clientX: 100, clientY: 200 }] })
    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 180, clientY: 205 }] })
    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith('l1', { isFavorite: true, favoriteOrder: 0 })
    })
  })

  it('ignores vertical swipes and short swipes', async () => {
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)
    await screen.findByText('My word lists (1)')

    const card = screen.getByText('Week 5: Long A').closest('[data-testid="lists-grid"] > div')!
    fireEvent.touchStart(card, { touches: [{ clientX: 100, clientY: 200 }] })
    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 110, clientY: 300 }] })
    fireEvent.touchStart(card, { touches: [{ clientX: 100, clientY: 200 }] })
    fireEvent.touchEnd(card, { changedTouches: [{ clientX: 130, clientY: 202 }] })
    expect(updateList).not.toHaveBeenCalled()
  })

  it('shows drag handles in the favorites view only', async () => {
    const starred = { ...list, isFavorite: true, favoriteOrder: 0 }
    const starred2 = { ...list2, isFavorite: true, favoriteOrder: 1 }
    getLists.mockResolvedValue([starred, starred2])
    render(<PatternListsManager />)
    await screen.findByText('My word lists (2)')
    expect(screen.queryByRole('button', { name: /Drag to reorder/ })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Favorites' }))
    expect(screen.getByRole('button', { name: 'Drag to reorder Week 5: Long A' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Drag to reorder Week 6' })).toBeInTheDocument()
  })

  it('reorders favorites on drag end and persists the new order', async () => {
    const favA = { ...list, isFavorite: true, favoriteOrder: 0 }
    const favB = { ...list2, isFavorite: true, favoriteOrder: 1 }
    getLists.mockResolvedValue([favA, favB])
    updateList.mockResolvedValue({} as WordList)
    render(<PatternListsManager />)
    await screen.findByText('My word lists (2)')
    fireEvent.click(screen.getByRole('tab', { name: 'Favorites' }))

    const dragEvent = { active: { id: 'l1' }, over: { id: 'l2' } } as unknown as import('@dnd-kit/core').DragEndEvent
    await act(async () => {
      dndProps.onDragEnd?.(dragEvent)
    })

    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith('l1', { favoriteOrder: 1 })
    })
    expect(updateList).toHaveBeenCalledWith('l2', { favoriteOrder: 0 })
    const titles = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
      .filter((t) => t !== 'My word lists (2)')
    expect(titles).toEqual(['Week 6', 'Week 5: Long A'])
  })

  it('unstars a favorite when the filled star is clicked', async () => {
    const starred = { ...list, isFavorite: true, favoriteOrder: 0 }
    getLists.mockResolvedValue([starred, list2])
    updateList.mockResolvedValue({ ...starred, isFavorite: false })
    render(<PatternListsManager />)
    await screen.findByText('My word lists (2)')

    fireEvent.click(screen.getByRole('button', { name: 'Remove Week 5: Long A from favorites' }))
    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith('l1', { isFavorite: false, favoriteOrder: 0 })
    })
    expect(screen.getByRole('button', { name: 'Add Week 5: Long A to favorites' })).toBeInTheDocument()
    // The Favorites tab disappears with the last favorite.
    expect(screen.queryByRole('tablist', { name: 'List views' })).not.toBeInTheDocument()
  })

  it('ignores a favorite toggle for a list that is no longer loaded', async () => {
    toggleFavoriteOverride.current = () => null
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)
    await screen.findByText('My word lists (1)')

    fireEvent.click(screen.getByRole('button', { name: 'Add Week 5: Long A to favorites' }))
    expect(updateList).not.toHaveBeenCalled()
    // The star stays unfilled.
    expect(screen.getByRole('button', { name: 'Add Week 5: Long A to favorites' })).toBeInTheDocument()
  })

  it('ignores drag end for unknown list ids', async () => {
    const favA = { ...list, isFavorite: true, favoriteOrder: 0 }
    getLists.mockResolvedValue([favA])
    render(<PatternListsManager />)
    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('tab', { name: 'Favorites' }))

    const unknown = { active: { id: 'nope' }, over: { id: 'l1' } } as unknown as import('@dnd-kit/core').DragEndEvent
    await act(async () => {
      dndProps.onDragEnd?.(unknown)
    })
    expect(updateList).not.toHaveBeenCalled()
  })

  it('ignores drag end without a drop target or movement', async () => {
    const favA = { ...list, isFavorite: true, favoriteOrder: 0 }
    getLists.mockResolvedValue([favA])
    render(<PatternListsManager />)
    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('tab', { name: 'Favorites' }))

    const noTarget = { active: { id: 'l1' }, over: null } as unknown as import('@dnd-kit/core').DragEndEvent
    const noMove = { active: { id: 'l1' }, over: { id: 'l1' } } as unknown as import('@dnd-kit/core').DragEndEvent
    await act(async () => {
      dndProps.onDragEnd?.(noTarget)
      dndProps.onDragEnd?.(noMove)
    })
    expect(updateList).not.toHaveBeenCalled()
  })

  it('rolls back the reorder when persisting fails', async () => {
    const favA = { ...list, isFavorite: true, favoriteOrder: 0 }
    const favB = { ...list2, isFavorite: true, favoriteOrder: 1 }
    getLists.mockResolvedValue([favA, favB])
    updateList.mockRejectedValue(new Error('network down'))
    render(
      <>
        <PatternListsManager />
        <ErrorToaster />
      </>
    )
    await screen.findByText('My word lists (2)')
    fireEvent.click(screen.getByRole('tab', { name: 'Favorites' }))

    const dragEvent = { active: { id: 'l1' }, over: { id: 'l2' } } as unknown as import('@dnd-kit/core').DragEndEvent
    await act(async () => {
      dndProps.onDragEnd?.(dragEvent)
    })

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
    })
    const titles = screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
      .filter((t) => t !== 'My word lists (2)')
    expect(titles).toEqual(['Week 5: Long A', 'Week 6'])
  })
})

describe('sorting (issue #275)', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  const listA: WordList = {
    id: 'a',
    userId: 'u1',
    name: 'Zebra',
    patterns: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-10T00:00:00.000Z',
  }
  const listB: WordList = {
    id: 'b',
    userId: 'u1',
    name: 'Apple',
    patterns: [],
    createdAt: '2026-10-03T00:00:00.000Z',
    updatedAt: '2026-10-12T00:00:00.000Z',
  }

  function cardTitles() {
    return screen
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent)
      .filter((t) => !t?.startsWith('My word lists'))
  }

  async function openSortMenu() {
    fireEvent.pointerDown(screen.getByRole('button', { name: /Sort:/ }), { pointerType: 'mouse' })
  }

  it('sorts by recently modified by default', async () => {
    getLists.mockResolvedValue([listA, listB])
    render(<PatternListsManager />)
    await screen.findByText('My word lists (2)')
    expect(cardTitles()).toEqual(['Apple', 'Zebra'])
  })

  it('changes the sort order from the menu', async () => {
    getLists.mockResolvedValue([listA, listB])
    render(<PatternListsManager />)
    await screen.findByText('My word lists (2)')

    await openSortMenu()
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Name A-Z' }))
    expect(cardTitles()).toEqual(['Apple', 'Zebra'])

    await openSortMenu()
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Recently created' }))
    expect(cardTitles()).toEqual(['Apple', 'Zebra'])
  })

  it('persists the sort choice across sessions', async () => {
    getLists.mockResolvedValue([listA, listB])
    const { unmount } = render(<PatternListsManager />)
    await screen.findByText('My word lists (2)')

    await openSortMenu()
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Name A-Z' }))
    expect(window.localStorage.getItem('patternspell:lists-sort')).toBe('name')
    unmount()

    render(<PatternListsManager />)
    await screen.findByText('My word lists (2)')
    expect(screen.getByRole('button', { name: 'Sort: Name A-Z' })).toBeInTheDocument()
  })

  it('hides the sort menu in the Favorites view', async () => {
    const starred = { ...listA, isFavorite: true, favoriteOrder: 0 }
    getLists.mockResolvedValue([starred, listB])
    render(<PatternListsManager />)
    await screen.findByText('My word lists (2)')
    expect(screen.getByRole('button', { name: /Sort:/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: 'Favorites' }))
    expect(screen.queryByRole('button', { name: /Sort:/ })).not.toBeInTheDocument()
  })

  it('does nothing when the current sort is re-selected', async () => {
    getLists.mockResolvedValue([listA, listB])
    render(<PatternListsManager />)
    await screen.findByText('My word lists (2)')

    await openSortMenu()
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Recently modified' }))
    expect(updateList).not.toHaveBeenCalled()
    expect(cardTitles()).toEqual(['Apple', 'Zebra'])
  })

  it('initializes custom order from the current view and persists it', async () => {
    getLists.mockResolvedValue([listA, listB])
    updateList.mockResolvedValue({} as WordList)
    render(<PatternListsManager />)
    await screen.findByText('My word lists (2)')

    await openSortMenu()
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Custom order' }))

    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith('b', { sortOrder: 0 })
    })
    expect(updateList).toHaveBeenCalledWith('a', { sortOrder: 1 })
    // Drag handles appear for custom order.
    expect(screen.getByRole('button', { name: 'Drag to reorder Apple' })).toBeInTheDocument()
  })

  it('rolls back when initializing custom order fails', async () => {
    getLists.mockResolvedValue([listA, listB])
    updateList.mockRejectedValue(new Error('network down'))
    render(
      <>
        <PatternListsManager />
        <ErrorToaster />
      </>
    )
    await screen.findByText('My word lists (2)')

    await openSortMenu()
    fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Custom order' }))

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
    })
    // Sort reverts to the previous choice.
    expect(screen.getByRole('button', { name: 'Sort: Recently modified' })).toBeInTheDocument()
  })

  it('reorders the custom sort on drag end', async () => {
    const withOrderA = { ...listA, sortOrder: 0 }
    const withOrderB = { ...listB, sortOrder: 1 }
    getLists.mockResolvedValue([withOrderA, withOrderB])
    updateList.mockResolvedValue({} as WordList)
    window.localStorage.setItem('patternspell:lists-sort', 'custom')
    render(<PatternListsManager />)
    await screen.findByText('My word lists (2)')
    expect(cardTitles()).toEqual(['Zebra', 'Apple'])

    const dragEvent = { active: { id: 'a' }, over: { id: 'b' } } as unknown as import('@dnd-kit/core').DragEndEvent
    await act(async () => {
      dndProps.onDragEnd?.(dragEvent)
    })

    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith('a', { sortOrder: 1 })
    })
    expect(updateList).toHaveBeenCalledWith('b', { sortOrder: 0 })
    expect(cardTitles()).toEqual(['Apple', 'Zebra'])
  })
})
