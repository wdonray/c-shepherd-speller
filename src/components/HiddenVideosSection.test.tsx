import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import HiddenVideosSection from './HiddenVideosSection'

const { useBlockedVideos } = vi.hoisted(() => ({ useBlockedVideos: vi.fn() }))
vi.mock('@/hooks/useBlockedVideos', () => ({ useBlockedVideos }))

const hidden = [
  { videoId: 'GdmcWQCbqY8', title: 'Vowel Teams Song', channel: 'Jack Hartmann' },
  { videoId: 'mxVWScxsOsc', title: 'Silent E Song' },
]

function mockBlockedVideos(
  overrides: {
    blockedVideos?: typeof hidden
    isLoaded?: boolean
    unblockVideo?: ReturnType<typeof vi.fn>
  } = {}
) {
  const unblockVideo = overrides.unblockVideo ?? vi.fn()
  useBlockedVideos.mockReturnValue({
    blockedVideos: overrides.blockedVideos ?? [],
    blockedVideoIds: new Set((overrides.blockedVideos ?? []).map((entry) => entry.videoId)),
    isLoaded: overrides.isLoaded ?? true,
    userId: 'u1',
    blockVideo: vi.fn(),
    unblockVideo,
  })
  return { unblockVideo }
}

describe('HiddenVideosSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBlockedVideos()
  })

  it('shows a loading state while the list loads', () => {
    mockBlockedVideos({ isLoaded: false })
    render(<HiddenVideosSection />)
    expect(screen.getByText('Loading hidden videos...')).toBeInTheDocument()
  })

  it('shows the empty state when nothing is hidden', () => {
    render(<HiddenVideosSection />)
    expect(screen.getByText('Hidden videos')).toBeInTheDocument()
    expect(screen.getByText(/No hidden videos\./)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Unhide / })).not.toBeInTheDocument()
  })

  it('lists hidden videos with title, channel, and an Unhide button each', () => {
    mockBlockedVideos({ blockedVideos: hidden })
    const { container } = render(<HiddenVideosSection />)
    expect(screen.getByText('Vowel Teams Song')).toBeInTheDocument()
    expect(screen.getByText('Jack Hartmann')).toBeInTheDocument()
    expect(screen.getByText('Silent E Song')).toBeInTheDocument()
    // Thumbnails are decorative (empty alt), so they are not in the role tree.
    const thumbnails = container.querySelectorAll('img')
    expect(thumbnails).toHaveLength(2)
    expect(thumbnails[0]).toHaveAttribute('src', 'https://i.ytimg.com/vi/GdmcWQCbqY8/mqdefault.jpg')
    expect(screen.getByRole('button', { name: 'Unhide Vowel Teams Song' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Unhide Silent E Song' })).toBeInTheDocument()
  })

  it('unhides a video when its Unhide button is pressed', () => {
    const { unblockVideo } = mockBlockedVideos({ blockedVideos: hidden })
    render(<HiddenVideosSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Unhide Vowel Teams Song' }))
    expect(unblockVideo).toHaveBeenCalledWith('GdmcWQCbqY8')
  })
})
