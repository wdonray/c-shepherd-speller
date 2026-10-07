import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import DisplayMode from './DisplayMode'
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
}))

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5',
  patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake'] }],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
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

  it('shows the list picker when no list is selected', async () => {
    getLists.mockResolvedValue([list])
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Present a list' })).toBeInTheDocument()
    })
    expect(screen.getByText('Week 5')).toBeInTheDocument()
  })

  it('shows a single Present chart action per card on the picker', async () => {
    getLists.mockResolvedValue([list])
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('Week 5')).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Present chart' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Present' })).not.toBeInTheDocument()
  })

  it('navigates to the chart when a list card is opened', async () => {
    getLists.mockResolvedValue([list])
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('Week 5')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Present chart' }))
    expect(mockPush).toHaveBeenCalledWith('/display?list=l1')
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
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockResolvedValue(list)
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('long a')).toBeInTheDocument()
    })
    expect(screen.getByRole('region', { name: 'Pattern a_e' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Hear and analyze the word cake' })).toBeInTheDocument()
  })

  it('enters sort mode from the Sort words button and exits back', async () => {
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockResolvedValue(list)
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('long a')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sort words' }))
    expect(screen.getByText('Sort the words')).toBeInTheDocument()
    expect(screen.queryByText('long a')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Exit sort' }))
    await waitFor(() => {
      expect(screen.getByText('long a')).toBeInTheDocument()
    })
  })

  it('shows an error state when the selected list fails to load', async () => {
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockRejectedValue(new Error('offline'))
    render(<DisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not load the word list')
    })
  })
})
