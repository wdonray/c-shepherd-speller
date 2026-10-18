import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import SongVideoBrowser from './SongVideoBrowser'

const { useBlockedVideos } = vi.hoisted(() => ({ useBlockedVideos: vi.fn() }))
vi.mock('@/hooks/useBlockedVideos', () => ({ useBlockedVideos }))
vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useSearchParams: vi.fn() }))
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const useSessionMock = vi.mocked(useSession)
const useSearchParamsMock = vi.mocked(useSearchParams)

function mockBlockedVideos(overrides: Record<string, unknown> = {}) {
  const blockVideo = vi.fn()
  useBlockedVideos.mockReturnValue({
    blockedVideos: [],
    blockedVideoIds: new Set<string>(),
    isLoaded: true,
    userId: 'u1',
    blockVideo,
    unblockVideo: vi.fn(),
    ...overrides,
  })
  return { blockVideo }
}

function mockQuery(q: string | null) {
  useSearchParamsMock.mockReturnValue({ get: (key: string) => (key === 'q' ? q : null) } as never)
}

describe('SongVideoBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSessionMock.mockReturnValue({ data: null, status: 'authenticated' } as never)
    mockQuery(null)
    mockBlockedVideos()
  })

  it('shows the full catalog with a count, search, and group filter', () => {
    render(<SongVideoBrowser />)
    expect(screen.getByText('Showing 19 of 19 videos')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(19)
    expect(screen.getByLabelText('Search videos')).toBeInTheDocument()
    const select = screen.getByLabelText('Filter by pattern group')
    expect(within(select).getAllByRole('option')).toHaveLength(7)
    expect(within(select).getByRole('option', { name: 'All patterns' })).toBeInTheDocument()
    expect(within(select).getByRole('option', { name: 'Digraphs' })).toBeInTheDocument()
  })

  it('prefills the search from the q param', () => {
    mockQuery('digraph')
    render(<SongVideoBrowser />)
    expect(screen.getByLabelText('Search videos')).toHaveValue('digraph')
    const plays = screen.getAllByRole('button', { name: /^Play / })
    expect(plays.length).toBeGreaterThan(0)
    expect(plays.length).toBeLessThan(19)
    expect(screen.getByText(`Showing ${plays.length} of 19 videos`)).toBeInTheDocument()
  })

  it('filters by pattern group', () => {
    render(<SongVideoBrowser />)
    fireEvent.change(screen.getByLabelText('Filter by pattern group'), { target: { value: 'Digraphs' } })
    // Bank entries touching sh, th, ch, wh, or ck.
    expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(6)
    expect(screen.getByText('Showing 6 of 19 videos')).toBeInTheDocument()
    // Back to all patterns.
    fireEvent.change(screen.getByLabelText('Filter by pattern group'), { target: { value: '' } })
    expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(19)
  })

  it('combines search and group filter', () => {
    render(<SongVideoBrowser />)
    fireEvent.change(screen.getByLabelText('Search videos'), { target: { value: 'ck' } })
    fireEvent.change(screen.getByLabelText('Filter by pattern group'), { target: { value: 'Digraphs' } })
    expect(screen.getByRole('button', { name: 'Play Digraph CK - 4 Minute Phonics' })).toBeInTheDocument()
  })

  it('shows the empty state and clears search and filters', () => {
    render(<SongVideoBrowser />)
    fireEvent.change(screen.getByLabelText('Search videos'), { target: { value: 'xyz-no-such-video' } })
    expect(screen.getByText('No videos match your search')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Play / })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search and filters' }))
    expect(screen.getByLabelText('Search videos')).toHaveValue('')
    expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(19)
  })

  it('filters hidden videos out of the catalog', () => {
    mockBlockedVideos({ blockedVideoIds: new Set(['qEgggBAF_nw']) })
    render(<SongVideoBrowser />)
    expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(18)
    expect(screen.getByText('Showing 18 of 19 videos')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play Digraph CK - 4 Minute Phonics' })).not.toBeInTheDocument()
  })

  it('hides a video from its card', () => {
    const { blockVideo } = mockBlockedVideos()
    render(<SongVideoBrowser />)
    fireEvent.click(screen.getByRole('button', { name: 'Hide Digraph CK - 4 Minute Phonics' }))
    expect(blockVideo).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: 'qEgggBAF_nw', title: 'Digraph CK - 4 Minute Phonics' })
    )
  })

  it('shows no Hide buttons when signed out', () => {
    mockBlockedVideos({ userId: null })
    render(<SongVideoBrowser />)
    expect(screen.queryByRole('button', { name: /^Hide / })).not.toBeInTheDocument()
  })

  it('holds the grid on a spinner while the session resolves', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'loading' } as never)
    render(<SongVideoBrowser />)
    expect(screen.getByRole('status', { name: 'Loading videos' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Play / })).not.toBeInTheDocument()
  })

  it('holds the grid on a spinner until the hidden-video list resolves', async () => {
    mockBlockedVideos({ isLoaded: false })
    const { rerender } = render(<SongVideoBrowser />)
    expect(screen.getByRole('status', { name: 'Loading videos' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Play / })).not.toBeInTheDocument()
    mockBlockedVideos({ isLoaded: true })
    rerender(<SongVideoBrowser />)
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(19)
    })
  })

  it('does not hold the grid for signed-out visitors', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' } as never)
    mockBlockedVideos({ isLoaded: false, userId: null })
    render(<SongVideoBrowser />)
    expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(19)
  })

  it('opens the player modal in browse-only mode from a video card', () => {
    render(<SongVideoBrowser />)
    fireEvent.click(screen.getByRole('button', { name: 'Play Digraph CK - 4 Minute Phonics' }))
    const dialogEl = screen.getByRole('dialog', { name: 'Song videos' })
    expect(within(dialogEl).queryByLabelText('Search videos by title or channel')).not.toBeInTheDocument()
    const frame = screen.getByTitle('Digraph CK - 4 Minute Phonics')
    expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/qEgggBAF_nw?rel=0&cc_load_policy=1')
    fireEvent.click(screen.getByRole('button', { name: 'Back to videos' }))
    expect(screen.queryByTitle('Digraph CK - 4 Minute Phonics')).not.toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Song videos' })).not.toBeInTheDocument()
  })
})
