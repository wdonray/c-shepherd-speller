import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import PracticePage from './page'
import type { WordList } from '@/models/WordList'

const { getList, getLists } = vi.hoisted(() => ({
  getList: vi.fn(),
  getLists: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({ getList, getLists }))

const mockSearchParams = vi.hoisted(() => ({ get: vi.fn() }))
const mockPush = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({ push: mockPush }),
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
  buildSentencePrompt: (word: string) => `The word is ${word}. Can you spell ${word}?`,
}))
const { logActivity } = vi.hoisted(() => ({ logActivity: vi.fn() }))
vi.mock('@/lib/activity', () => ({ logActivity }))

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5',
  patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake'] }],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('PracticePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.get.mockReturnValue(null)
  })

  it('shows the list picker when no list is selected', async () => {
    getLists.mockResolvedValue([list])
    render(<PracticePage />)

    await waitFor(() => {
      expect(screen.getByText('Choose a list to practice')).toBeInTheDocument()
    })
    expect(screen.getByText('Week 5')).toBeInTheDocument()
  })

  it('hides the Present link on practice picker cards', async () => {
    getLists.mockResolvedValue([list])
    render(<PracticePage />)

    await waitFor(() => {
      expect(screen.getByText('Week 5')).toBeInTheDocument()
    })
    expect(screen.queryByRole('link', { name: 'Present' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Start practice' })).toBeInTheDocument()
  })

  it('opens practice for the chosen list', async () => {
    const { fireEvent } = await import('@testing-library/react')
    getLists.mockResolvedValue([list])
    render(<PracticePage />)

    await waitFor(() => {
      expect(screen.getByText('Week 5')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Start practice' }))
    expect(mockPush).toHaveBeenCalledWith('/practice?list=l1')
  })

  it('shows an empty state when there are no lists', async () => {
    getLists.mockResolvedValue([])
    render(<PracticePage />)

    await waitFor(() => {
      expect(screen.getByText(/no word lists yet/i)).toBeInTheDocument()
    })
  })

  it('links the empty state CTA to new list creation', async () => {
    getLists.mockResolvedValue([])
    render(<PracticePage />)

    await waitFor(() => {
      expect(screen.getByText(/no word lists yet/i)).toBeInTheDocument()
    })
    const newListLink = screen.getByRole('link', { name: 'New list' })
    expect(newListLink).toHaveAttribute('href', '/lists/new')
    expect(screen.queryByRole('link', { name: 'Back to home' })).not.toBeInTheDocument()
  })

  it('shows the practice mode when a list is selected', async () => {
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockResolvedValue(list)
    render(<PracticePage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Practice: Week 5' })).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Spell the word you hear')).toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockRejectedValue(new Error('network down'))
    render(<PracticePage />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not load the word list')
    })
  })

  it('navigates back to the picker when exiting practice', async () => {
    const { fireEvent } = await import('@testing-library/react')
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockResolvedValue(list)
    render(<PracticePage />)

    await waitFor(() => {
      expect(screen.getByLabelText('Spell the word you hear')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Exit practice' }))
    expect(mockPush).toHaveBeenCalledWith('/practice')
  })
})
