import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { useSearchParams } from 'next/navigation'
import SongVideoBrowser from './SongVideoBrowser'

const { useBlockedVideos } = vi.hoisted(() => ({ useBlockedVideos: vi.fn() }))
vi.mock('@/hooks/useBlockedVideos', () => ({ useBlockedVideos }))
const { getVideoLibrary } = vi.hoisted(() => ({ getVideoLibrary: vi.fn() }))
vi.mock('@/lib/video-library-api', () => ({ getVideoLibrary }))
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

/** The grid paints only after the teacher's library resolves; wait for it. */
async function waitForGrid(count: number) {
  const plays = await screen.findAllByRole('button', { name: /^Play / })
  expect(plays).toHaveLength(count)
  return plays
}

describe('SongVideoBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useSessionMock.mockReturnValue({ data: null, status: 'authenticated' } as never)
    mockQuery(null)
    mockBlockedVideos()
    getVideoLibrary.mockResolvedValue([])
  })

  it('shows the full catalog with a count, search, and group filter', async () => {
    render(<SongVideoBrowser />)
    await waitForGrid(38)
    expect(screen.getByText('Showing 38 of 38 videos')).toBeInTheDocument()
    expect(screen.getByLabelText('Search videos')).toBeInTheDocument()
    const select = screen.getByLabelText('Filter by pattern group')
    expect(within(select).getAllByRole('option')).toHaveLength(7)
    expect(within(select).getByRole('option', { name: 'All patterns' })).toBeInTheDocument()
    expect(within(select).getByRole('option', { name: 'Digraphs' })).toBeInTheDocument()
  })

  it('prefills the search from the q param', async () => {
    mockQuery('digraph')
    render(<SongVideoBrowser />)
    expect(screen.getByLabelText('Search videos')).toHaveValue('digraph')
    const plays = await screen.findAllByRole('button', { name: /^Play / })
    expect(plays.length).toBeGreaterThan(0)
    expect(plays.length).toBeLessThan(38)
    expect(screen.getByText(`Showing ${plays.length} of 38 videos`)).toBeInTheDocument()
  })

  it('filters by pattern group', async () => {
    render(<SongVideoBrowser />)
    await waitForGrid(38)
    fireEvent.change(screen.getByLabelText('Filter by pattern group'), { target: { value: 'Digraphs' } })
    // Bank entries touching sh, th, ch, wh, ck, or ng.
    expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(12)
    expect(screen.getByText('Showing 12 of 38 videos')).toBeInTheDocument()
    // Back to all patterns.
    fireEvent.change(screen.getByLabelText('Filter by pattern group'), { target: { value: '' } })
    expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(38)
  })

  it('combines search and group filter', async () => {
    render(<SongVideoBrowser />)
    await waitForGrid(38)
    fireEvent.change(screen.getByLabelText('Search videos'), { target: { value: 'ck' } })
    fireEvent.change(screen.getByLabelText('Filter by pattern group'), { target: { value: 'Digraphs' } })
    expect(screen.getByRole('button', { name: 'Play Digraph CK - 4 Minute Phonics' })).toBeInTheDocument()
  })

  it('shows the empty state and clears search and filters', async () => {
    render(<SongVideoBrowser />)
    await waitForGrid(38)
    fireEvent.change(screen.getByLabelText('Search videos'), { target: { value: 'xyz-no-such-video' } })
    expect(screen.getByText('No videos match your search')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Play / })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear search and filters' }))
    expect(screen.getByLabelText('Search videos')).toHaveValue('')
    expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(38)
  })

  it('filters hidden videos out of the catalog', async () => {
    mockBlockedVideos({ blockedVideoIds: new Set(['qEgggBAF_nw']) })
    render(<SongVideoBrowser />)
    await waitForGrid(37)
    expect(screen.getByText('Showing 37 of 38 videos')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play Digraph CK - 4 Minute Phonics' })).not.toBeInTheDocument()
  })

  it('hides a video from its card', async () => {
    const { blockVideo } = mockBlockedVideos()
    render(<SongVideoBrowser />)
    await waitForGrid(38)
    fireEvent.click(screen.getByRole('button', { name: 'Hide Digraph CK - 4 Minute Phonics' }))
    expect(blockVideo).toHaveBeenCalledWith(
      expect.objectContaining({ videoId: 'qEgggBAF_nw', title: 'Digraph CK - 4 Minute Phonics' })
    )
  })

  it('shows no Hide buttons when signed out', () => {
    mockBlockedVideos({ userId: null })
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' } as never)
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
      expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(38)
    })
  })

  it('holds the grid on a spinner until her video library resolves (issue #458)', async () => {
    getVideoLibrary.mockImplementation(() => new Promise(() => {}))
    render(<SongVideoBrowser />)
    expect(screen.getByRole('status', { name: 'Loading videos' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Play / })).not.toBeInTheDocument()
  })

  it('does not hold the grid for signed-out visitors', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' } as never)
    mockBlockedVideos({ isLoaded: false, userId: null })
    render(<SongVideoBrowser />)
    expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(38)
  })

  it('does not fetch the library for signed-out visitors', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' } as never)
    render(<SongVideoBrowser />)
    expect(getVideoLibrary).not.toHaveBeenCalled()
  })

  it('opens the player modal in browse-only mode from a video card', async () => {
    render(<SongVideoBrowser />)
    await waitForGrid(38)
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

  it('merges her pasted videos after the bank and counts the real library (issue #458)', async () => {
    getVideoLibrary.mockResolvedValue([
      { videoId: 'dQw4w9WgXcQ', title: 'My pasted song', channel: 'My Channel', source: 'custom' },
    ])
    render(<SongVideoBrowser />)
    const plays = await waitForGrid(39)
    expect(screen.getByText('Showing 39 of 39 videos')).toBeInTheDocument()
    // Hers appends after the bank, in the order added.
    expect(plays[38]).toHaveAttribute('aria-label', 'Play My pasted song')
    expect(screen.getByText('My Channel')).toBeInTheDocument()
  })

  it('never duplicates a bank video she pasted (issue #458)', async () => {
    getVideoLibrary.mockResolvedValue([
      { videoId: 'qEgggBAF_nw', title: 'Digraph CK - 4 Minute Phonics', source: 'custom' },
    ])
    render(<SongVideoBrowser />)
    await waitForGrid(38)
    expect(screen.getByText('Showing 38 of 38 videos')).toBeInTheDocument()
  })

  it('searches her pasted videos by title and channel (issue #458)', async () => {
    getVideoLibrary.mockResolvedValue([
      { videoId: 'dQw4w9WgXcQ', title: 'My pasted song', channel: 'My Channel', source: 'custom' },
    ])
    render(<SongVideoBrowser />)
    await waitForGrid(39)
    fireEvent.change(screen.getByLabelText('Search videos'), { target: { value: 'pasted' } })
    expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Play My pasted song' })).toBeInTheDocument()
    expect(screen.getByText('Showing 1 of 39 videos')).toBeInTheDocument()
  })

  it('keeps her pattern-less videos out of pattern-group filters (issue #458)', async () => {
    getVideoLibrary.mockResolvedValue([
      { videoId: 'dQw4w9WgXcQ', title: 'My pasted song', channel: 'My Channel', source: 'custom' },
    ])
    render(<SongVideoBrowser />)
    await waitForGrid(39)
    fireEvent.change(screen.getByLabelText('Filter by pattern group'), { target: { value: 'Digraphs' } })
    expect(screen.queryByRole('button', { name: 'Play My pasted song' })).not.toBeInTheDocument()
    expect(screen.getByText('Showing 12 of 39 videos')).toBeInTheDocument()
  })

  it('degrades to the bank when the library fetch fails (issue #458)', async () => {
    getVideoLibrary.mockRejectedValue(new Error('boom'))
    render(<SongVideoBrowser />)
    await waitForGrid(38)
    expect(screen.getByText('Showing 38 of 38 videos')).toBeInTheDocument()
  })

  it('ignores a late library response after unmount (issue #458)', async () => {
    let resolveLibrary: (videos: { videoId: string; title: string; source: 'custom' }[]) => void = () => {}
    getVideoLibrary.mockImplementation(
      () =>
        new Promise<{ videoId: string; title: string; source: 'custom' }[]>((resolve) => {
          resolveLibrary = resolve
        })
    )
    const { unmount } = render(<SongVideoBrowser />)
    unmount()
    resolveLibrary([{ videoId: 'dQw4w9WgXcQ', title: 'My pasted song', source: 'custom' }])
    await act(async () => {})
  })

  it('ignores a late library failure after unmount (issue #458)', async () => {
    let rejectLibrary: (error: unknown) => void = () => {}
    getVideoLibrary.mockImplementation(
      () =>
        new Promise<{ videoId: string; title: string; source: 'custom' }[]>((_, reject) => {
          rejectLibrary = reject
        })
    )
    const { unmount } = render(<SongVideoBrowser />)
    unmount()
    rejectLibrary(new Error('boom'))
    await act(async () => {})
  })

  it('searches her pasted videos by channel as well as title (issue #458)', async () => {
    getVideoLibrary.mockResolvedValue([
      { videoId: 'dQw4w9WgXcQ', title: 'My pasted song', channel: 'My Channel', source: 'custom' },
    ])
    render(<SongVideoBrowser />)
    await waitForGrid(39)
    fireEvent.change(screen.getByLabelText('Search videos'), { target: { value: 'my channel' } })
    expect(screen.getAllByRole('button', { name: /^Play / })).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Play My pasted song' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Search videos'), { target: { value: 'xyz-no-such-video' } })
    expect(screen.queryByRole('button', { name: /^Play / })).not.toBeInTheDocument()
  })

  it('plays a channel-less pasted video from its card (issue #458)', async () => {
    getVideoLibrary.mockResolvedValue([{ videoId: 'dQw4w9WgXcQ', title: 'Channel-less song', source: 'custom' }])
    render(<SongVideoBrowser />)
    await waitForGrid(39)
    fireEvent.click(screen.getByRole('button', { name: 'Play Channel-less song' }))
    const frame = screen.getByTitle('Channel-less song')
    expect(frame).toHaveAttribute('src', 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&cc_load_policy=1')
  })
})
