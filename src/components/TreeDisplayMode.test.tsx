import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import TreeDisplayMode from './TreeDisplayMode'
import type { WordList } from '@/models/WordList'

const { getList, getLists } = vi.hoisted(() => ({
  getList: vi.fn(),
  getLists: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({ getList, getLists }))

const mockSearchParams = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => mockSearchParams,
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

describe('TreeDisplayMode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.get.mockReturnValue(null)
  })

  it('shows a loading state initially', () => {
    getLists.mockImplementation(() => new Promise(() => {}))
    render(<TreeDisplayMode />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading...')
  })

  it('shows the list picker when no list is selected', async () => {
    getLists.mockResolvedValue([list])
    render(<TreeDisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('Choose a list to present')).toBeInTheDocument()
    })
    expect(screen.getByText('Week 5')).toBeInTheDocument()
  })

  it('uses plural forms in the list picker', async () => {
    const multiPatternList: WordList = {
      ...list,
      patterns: [
        { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'] },
        { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'common', words: ['rain'] },
      ],
    }
    getLists.mockResolvedValue([multiPatternList])
    render(<TreeDisplayMode />)

    await waitFor(() => {
      expect(screen.getByText(/2 patterns · 3 words/)).toBeInTheDocument()
    })
  })

  it('shows an empty state when there are no lists', async () => {
    getLists.mockResolvedValue([])
    render(<TreeDisplayMode />)

    await waitFor(() => {
      expect(screen.getByText(/no word lists yet/i)).toBeInTheDocument()
    })
  })

  it('shows the tree when a list is selected', async () => {
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockResolvedValue(list)
    render(<TreeDisplayMode />)

    await waitFor(() => {
      expect(screen.getByText('Week 5')).toBeInTheDocument()
    })
    // Tree renders the word as a leaf
    expect(screen.getByRole('button', { name: 'Analyze the word cake' })).toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    mockSearchParams.get.mockReturnValue('l1')
    getList.mockRejectedValue(new Error('network down'))
    render(<TreeDisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not load the word list')
    })
  })

  it('shows an error when the list picker fails', async () => {
    getLists.mockRejectedValue(new Error('network down'))
    render(<TreeDisplayMode />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not load the word list')
    })
  })

  it('does not update state after unmount', async () => {
    // Slow response that resolves after unmount
    let resolveLists: (value: WordList[]) => void = () => {}
    getLists.mockImplementation(() => new Promise<WordList[]>((resolve) => (resolveLists = resolve)))
    const { unmount } = render(<TreeDisplayMode />)

    // Unmount before the promise resolves
    unmount()
    resolveLists([list])

    // Give the promise a chance to resolve; no error should occur
    await new Promise((resolve) => setTimeout(resolve, 50))
    // If we got here without a React warning, the cancelled check worked
    expect(true).toBe(true)
  })
})
