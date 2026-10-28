import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { DndContext } from '@dnd-kit/core'
import ListsMobileSearchOverlay from './ListsMobileSearchOverlay'
import type { WordList } from '@/models/WordList'

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
  patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'] }],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}
const list2: WordList = {
  id: 'l2',
  userId: 'u1',
  name: 'Week 6',
  patterns: [{ id: 'p2', sound: 'long a', pattern: 'ay', frequency: 'rare', words: ['day'] }],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

const props = {
  query: '',
  onQueryChange: vi.fn(),
  onClose: vi.fn(),
  results: [list, list2],
  onOpen: vi.fn(),
  onDelete: vi.fn(),
  onToggleFavorite: vi.fn(),
}

const overlay = () => within(screen.getByTestId('mobile-search-overlay'))

function renderOverlay(overrides: Partial<typeof props> = {}) {
  render(
    <DndContext>
      <ListsMobileSearchOverlay {...props} {...overrides} />
    </DndContext>
  )
}

describe('ListsMobileSearchOverlay (issue #555)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    document.body.style.overflow = ''
  })

  it('renders a dialog with a back arrow, a Cancel label, and a focused field', () => {
    renderOverlay()
    const dialog = screen.getByTestId('mobile-search-overlay')
    expect(dialog).toHaveAttribute('role', 'dialog')
    expect(dialog).toHaveClass('h-dvh', 'md:hidden')
    expect(overlay().getByRole('button', { name: 'Back' })).toBeInTheDocument()
    expect(overlay().getByRole('button', { name: 'Cancel search' })).toHaveTextContent('Cancel')
    const input = overlay().getByRole('textbox', { name: 'Search lists' })
    expect(input).toHaveFocus()
  })

  it('shows the results passed in', () => {
    renderOverlay()
    expect(overlay().getByText('Week 5: Long A')).toBeInTheDocument()
    expect(overlay().getByText('Week 6')).toBeInTheDocument()
  })

  it('reports the query as the teacher types', () => {
    renderOverlay()
    fireEvent.change(overlay().getByRole('textbox', { name: 'Search lists' }), { target: { value: 'cake' } })
    expect(props.onQueryChange).toHaveBeenCalledWith('cake')
  })

  it('shows the result count while searching', () => {
    renderOverlay({ query: 'cake', results: [list] })
    expect(overlay().getByText('1 result for "cake".')).toBeInTheDocument()
  })

  it('pluralizes the result count', () => {
    renderOverlay({ query: 'long', results: [list, list2] })
    expect(overlay().getByText('2 results for "long".')).toBeInTheDocument()
  })

  it('shows the no-results text when nothing matches', () => {
    renderOverlay({ query: 'xyz', results: [] })
    expect(overlay().getByText('No lists match "xyz".')).toBeInTheDocument()
  })

  it('closes when Cancel is tapped', () => {
    renderOverlay({ query: 'cake' })
    fireEvent.click(overlay().getByRole('button', { name: 'Cancel search' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when the back arrow is tapped', () => {
    renderOverlay({ query: 'cake' })
    fireEvent.click(overlay().getByRole('button', { name: 'Back' }))
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on Escape in the field', () => {
    renderOverlay()
    fireEvent.keyDown(overlay().getByRole('textbox', { name: 'Search lists' }), { key: 'Escape' })
    expect(props.onClose).toHaveBeenCalledTimes(1)
  })

  it('ignores non-Escape keys in the field', () => {
    renderOverlay()
    fireEvent.keyDown(overlay().getByRole('textbox', { name: 'Search lists' }), { key: 'Enter' })
    expect(props.onClose).not.toHaveBeenCalled()
  })

  it('locks body scroll while open and restores it on unmount', () => {
    const { unmount } = render(
      <DndContext>
        <ListsMobileSearchOverlay {...props} />
      </DndContext>
    )
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
