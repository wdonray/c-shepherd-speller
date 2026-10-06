import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import Dashboard from './Dashboard'
import type { WordList } from '@/models/WordList'

const { getLists } = vi.hoisted(() => ({
  getLists: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({ getLists }))

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
  patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake'] }],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('Dashboard', () => {
  const defaultProps = {
    onNewList: vi.fn(),
    onEditList: vi.fn(),
    onDeleteList: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading state', () => {
    getLists.mockImplementation(() => new Promise(() => {}))
    render(<Dashboard {...defaultProps} />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading your dashboard...')
  })

  it('shows quick action buttons', async () => {
    getLists.mockResolvedValue([])
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New list' })).toBeInTheDocument()
    })
    expect(screen.getByRole('link', { name: /practice/i })).toHaveAttribute('href', '/practice')
    expect(screen.getByRole('link', { name: /present/i })).toHaveAttribute('href', '/display')
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

  it('shows the getting started guide when there are no lists', async () => {
    getLists.mockResolvedValue([])
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('No word lists yet.')).toBeInTheDocument()
    })
    expect(screen.getByText(/Getting started with pattern-based spelling/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create your first list' })).toBeInTheDocument()
  })

  it('calls onNewList from the getting started guide', async () => {
    const onNewList = vi.fn()
    getLists.mockResolvedValue([])
    render(<Dashboard {...defaultProps} onNewList={onNewList} />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create your first list' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create your first list' }))
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

  it('calls onEditList when Edit is clicked on a card', async () => {
    const onEditList = vi.fn()
    getLists.mockResolvedValue([list])
    render(<Dashboard {...defaultProps} onEditList={onEditList} />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    expect(onEditList).toHaveBeenCalledWith(list)
  })

  it('calls onDeleteList when Delete is clicked on a card', async () => {
    const onDeleteList = vi.fn()
    getLists.mockResolvedValue([list])
    render(<Dashboard {...defaultProps} onDeleteList={onDeleteList} />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    expect(onDeleteList).toHaveBeenCalledWith(list)
  })

  it('shows an empty dashboard when loading fails', async () => {
    getLists.mockRejectedValue(new Error('network down'))
    render(<Dashboard {...defaultProps} />)

    await waitFor(() => {
      expect(screen.getByText('My word lists (0)')).toBeInTheDocument()
    })
  })
})
