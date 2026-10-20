import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import ListsMobileFilterBar from './ListsMobileFilterBar'
import type { ListSort } from '@/lib/list-organize'

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

const props = {
  view: 'all' as const,
  onViewChange: vi.fn(),
  showFavoritesTab: true,
  searching: false,
  sort: 'recent' as ListSort,
  onSortChange: vi.fn(),
  showSort: true,
  query: '',
  onQueryChange: vi.fn(),
  searchExpanded: false,
  onSearchExpandedChange: vi.fn(),
}

const bar = () => within(screen.getByTestId('mobile-filter-bar'))

describe('ListsMobileFilterBar (issue #484)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMatchMedia(false)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders compact tabs, the sort icon, and the search toggle in one row', () => {
    render(<ListsMobileFilterBar {...props} />)
    expect(bar().getByRole('tablist', { name: 'List views' })).toBeInTheDocument()
    expect(bar().getByRole('tab', { name: 'All' })).toHaveAttribute('aria-selected', 'true')
    expect(bar().getByRole('tab', { name: 'Favorites' })).toHaveAttribute('aria-selected', 'false')
    expect(bar().getByRole('button', { name: 'Sort lists' })).toBeInTheDocument()
    expect(bar().getByRole('button', { name: 'Search lists' })).toBeInTheDocument()
    expect(bar().queryByTestId('mobile-search-expanded')).not.toBeInTheDocument()
  })

  it('hides the tabs when there are no favorites', () => {
    render(<ListsMobileFilterBar {...props} showFavoritesTab={false} />)
    expect(bar().queryByRole('tablist', { name: 'List views' })).not.toBeInTheDocument()
    expect(bar().getByRole('button', { name: 'Sort lists' })).toBeInTheDocument()
    expect(bar().getByRole('button', { name: 'Search lists' })).toBeInTheDocument()
  })

  it('hides the tabs while searching', () => {
    render(<ListsMobileFilterBar {...props} searching />)
    expect(bar().queryByRole('tablist', { name: 'List views' })).not.toBeInTheDocument()
  })

  it('hides the sort control when showSort is false', () => {
    render(<ListsMobileFilterBar {...props} showSort={false} />)
    expect(bar().queryByRole('button', { name: 'Sort lists' })).not.toBeInTheDocument()
    expect(bar().getByRole('button', { name: 'Search lists' })).toBeInTheDocument()
  })

  it('switches the view when a tab is tapped', () => {
    render(<ListsMobileFilterBar {...props} />)
    fireEvent.click(bar().getByRole('tab', { name: 'Favorites' }))
    expect(props.onViewChange).toHaveBeenCalledWith('favorites')
  })

  it('expands the search field and focuses it when the toggle is tapped', () => {
    const { rerender } = render(<ListsMobileFilterBar {...props} />)
    fireEvent.click(bar().getByRole('button', { name: 'Search lists' }))
    expect(props.onSearchExpandedChange).toHaveBeenCalledWith(true)

    rerender(<ListsMobileFilterBar {...props} searchExpanded />)
    const input = bar().getByRole('textbox', { name: 'Search lists' })
    expect(input).toBeInTheDocument()
    expect(input).toHaveFocus()
  })

  it('reports the query as the teacher types in the expanded field', () => {
    render(<ListsMobileFilterBar {...props} searchExpanded />)
    fireEvent.change(bar().getByRole('textbox', { name: 'Search lists' }), { target: { value: 'cake' } })
    expect(props.onQueryChange).toHaveBeenCalledWith('cake')
  })

  it('clears the query and collapses when the X is tapped', () => {
    render(<ListsMobileFilterBar {...props} searchExpanded query="cake" />)
    fireEvent.click(bar().getByRole('button', { name: 'Clear search and close' }))
    expect(props.onQueryChange).toHaveBeenCalledWith('')
    expect(props.onSearchExpandedChange).toHaveBeenCalledWith(false)
  })

  it('collapses on Escape in the expanded field', () => {
    render(<ListsMobileFilterBar {...props} searchExpanded query="cake" />)
    fireEvent.keyDown(bar().getByRole('textbox', { name: 'Search lists' }), { key: 'Escape' })
    expect(props.onQueryChange).toHaveBeenCalledWith('')
    expect(props.onSearchExpandedChange).toHaveBeenCalledWith(false)
  })

  it('ignores non-Escape keys in the expanded field', () => {
    render(<ListsMobileFilterBar {...props} searchExpanded />)
    fireEvent.keyDown(bar().getByRole('textbox', { name: 'Search lists' }), { key: 'Enter' })
    expect(props.onSearchExpandedChange).not.toHaveBeenCalled()
    expect(bar().getByTestId('mobile-search-expanded')).toBeInTheDocument()
  })

  it('returns focus to the search toggle after collapsing', () => {
    const { rerender } = render(<ListsMobileFilterBar {...props} />)
    fireEvent.click(bar().getByRole('button', { name: 'Search lists' }))

    rerender(<ListsMobileFilterBar {...props} searchExpanded />)
    expect(bar().getByRole('textbox', { name: 'Search lists' })).toHaveFocus()

    rerender(<ListsMobileFilterBar {...props} searchExpanded={false} />)
    expect(bar().getByRole('button', { name: 'Search lists' })).toHaveFocus()
  })

  it('does not steal focus on first render', () => {
    render(<ListsMobileFilterBar {...props} />)
    expect(document.activeElement).toBe(document.body)
  })

  it('does not yank focus back to the field on re-renders while expanded', () => {
    const { rerender } = render(<ListsMobileFilterBar {...props} searchExpanded />)
    const input = bar().getByRole('textbox', { name: 'Search lists' })
    expect(input).toHaveFocus()

    // The teacher tabs to the clear button; a re-render (e.g. a parent state
    // update) must not steal focus back to the input.
    bar().getByRole('button', { name: 'Clear search and close' }).focus()
    rerender(<ListsMobileFilterBar {...props} searchExpanded query="cake" />)
    expect(bar().getByRole('button', { name: 'Clear search and close' })).toHaveFocus()
  })

  it('marks the search toggle active when a query is set but the field is collapsed', () => {
    render(<ListsMobileFilterBar {...props} query="cake" />)
    const toggle = bar().getByRole('button', { name: 'Search lists' })
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle.className).toContain('bg-ink')
  })

  it('opens the sort bottom sheet from the icon button on mobile', () => {
    mockMatchMedia(true)
    render(<ListsMobileFilterBar {...props} />)
    fireEvent.click(bar().getByRole('button', { name: 'Sort lists' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Name A-Z' }))
    expect(props.onSortChange).toHaveBeenCalledWith('name')
  })
})
