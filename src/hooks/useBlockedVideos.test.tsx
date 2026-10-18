import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { subscribeToErrorToasts } from '@/lib/error-toast'
import { useBlockedVideos } from './useBlockedVideos'

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }))
vi.mock('@/lib/report-error', () => ({ reportError }))

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))

const { getUserByEmail } = vi.hoisted(() => ({ getUserByEmail: vi.fn() }))
vi.mock('@/lib/spelling-api', () => ({ getUserByEmail }))

function Probe() {
  const { blockedVideos, blockedVideoIds, isLoaded, userId, blockVideo, unblockVideo } = useBlockedVideos()
  return (
    <div>
      <p data-testid="loaded">{String(isLoaded)}</p>
      <p data-testid="user-id">{userId ?? 'none'}</p>
      <p data-testid="blocked">{blockedVideos.map((entry) => entry.videoId).join(',')}</p>
      <p data-testid="blocked-titles">{blockedVideos.map((entry) => entry.title).join(',')}</p>
      <p data-testid="blocked-ids">{[...blockedVideoIds].join(',')}</p>
      <button
        type="button"
        onClick={() => void blockVideo({ videoId: 'GdmcWQCbqY8', title: 'Vowel Teams', channel: 'Jack Hartmann' })}
      >
        block
      </button>
      <button type="button" onClick={() => void blockVideo({ videoId: 'mxVWScxsOsc', title: 'Silent E' })}>
        block-no-channel
      </button>
      <button type="button" onClick={() => void unblockVideo('GdmcWQCbqY8')}>
        unblock
      </button>
    </div>
  )
}

function mockSession(status: 'authenticated' | 'unauthenticated' | 'loading') {
  vi.mocked(useSession).mockReturnValue({
    data: status === 'authenticated' ? { user: { email: 'teacher@example.com' } } : null,
    status,
    update: async () => null,
  } as never)
}

/** Stub the profile-update PUT. The echo defaults to the sent list. */
function mockPut(ok: boolean, status = 200, jsonBody: unknown = 'echo-sent') {
  const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
    const sent = JSON.parse((init?.body as string) ?? '{}') as { blockedVideos?: unknown[] }
    return {
      ok,
      status,
      json: async () => (jsonBody === 'echo-sent' ? { user: { blockedVideos: sent.blockedVideos } } : jsonBody),
    }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

async function expectLoaded() {
  await waitFor(() => {
    expect(screen.getByTestId('loaded')).toHaveTextContent('true')
  })
}

describe('useBlockedVideos', () => {
  let toasts: string[]
  let unsubscribe: () => void

  beforeEach(() => {
    vi.clearAllMocks()
    toasts = []
    unsubscribe = subscribeToErrorToasts((message) => {
      toasts.push(message)
    })
    mockSession('authenticated')
    getUserByEmail.mockResolvedValue({ id: 'u1' })
  })

  afterEach(() => {
    unsubscribe()
    vi.unstubAllGlobals()
  })

  it('loads the profile hidden videos', async () => {
    getUserByEmail.mockResolvedValue({
      id: 'u1',
      blockedVideos: [{ videoId: 'GdmcWQCbqY8', title: 'Vowel Teams', channel: 'Jack Hartmann' }],
    })
    render(<Probe />)
    expect(getUserByEmail).toHaveBeenCalledWith('teacher@example.com')
    await expectLoaded()
    expect(screen.getByTestId('user-id')).toHaveTextContent('u1')
    expect(screen.getByTestId('blocked')).toHaveTextContent('GdmcWQCbqY8')
    expect(screen.getByTestId('blocked-ids')).toHaveTextContent('GdmcWQCbqY8')
  })

  it('treats a missing blockedVideos field as an empty list', async () => {
    getUserByEmail.mockResolvedValue({ id: 'u1' })
    render(<Probe />)
    await expectLoaded()
    expect(screen.getByTestId('blocked')).toHaveTextContent('')
  })

  it('resolves loaded with an empty list when signed out', async () => {
    mockSession('unauthenticated')
    render(<Probe />)
    await expectLoaded()
    expect(getUserByEmail).not.toHaveBeenCalled()
    expect(screen.getByTestId('user-id')).toHaveTextContent('none')
    expect(screen.getByTestId('blocked')).toHaveTextContent('')
  })

  it('resolves loaded with an empty list when the session has no email', async () => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: {} },
      status: 'authenticated',
      update: async () => null,
    } as never)
    render(<Probe />)
    await expectLoaded()
    expect(getUserByEmail).not.toHaveBeenCalled()
    expect(screen.getByTestId('user-id')).toHaveTextContent('none')
  })

  it('stays unloaded while the session is still loading', () => {
    mockSession('loading')
    render(<Probe />)
    expect(screen.getByTestId('loaded')).toHaveTextContent('false')
    expect(getUserByEmail).not.toHaveBeenCalled()
  })

  it('degrades to an empty list when the profile fetch fails', async () => {
    getUserByEmail.mockRejectedValue(new Error('db down'))
    render(<Probe />)
    await expectLoaded()
    expect(reportError).toHaveBeenCalledWith(new Error('db down'), { location: 'useBlockedVideos.load' })
    expect(screen.getByTestId('blocked')).toHaveTextContent('')
  })

  it('ignores the fetch result after unmount', async () => {
    let resolveFetch!: (user: unknown) => void
    getUserByEmail.mockReturnValue(new Promise((resolve) => (resolveFetch = resolve)))
    const { unmount } = render(<Probe />)
    unmount()
    resolveFetch({ id: 'u1', blockedVideos: [] })
    await Promise.resolve()
    expect(reportError).not.toHaveBeenCalled()
  })

  it('blocks a video and persists the list', async () => {
    const fetchMock = mockPut(true)
    render(<Probe />)
    await expectLoaded()

    fireEvent.click(screen.getByText('block'))

    await waitFor(() => {
      expect(screen.getByTestId('blocked')).toHaveTextContent('GdmcWQCbqY8')
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/users/u1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blockedVideos: [{ videoId: 'GdmcWQCbqY8', title: 'Vowel Teams', channel: 'Jack Hartmann' }],
      }),
    })
    expect(screen.getByTestId('blocked-titles')).toHaveTextContent('Vowel Teams')
  })

  it('omits the channel when the video has none', async () => {
    const fetchMock = mockPut(true)
    render(<Probe />)
    await expectLoaded()

    fireEvent.click(screen.getByText('block-no-channel'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/users/u1',
      expect.objectContaining({
        body: JSON.stringify({ blockedVideos: [{ videoId: 'mxVWScxsOsc', title: 'Silent E' }] }),
      })
    )
  })

  it('adopts the server echo of the list', async () => {
    mockPut(true, 200, { user: { blockedVideos: [{ videoId: 'GdmcWQCbqY8', title: 'Sanitized' }] } })
    render(<Probe />)
    await expectLoaded()

    fireEvent.click(screen.getByText('block'))

    await waitFor(() => {
      expect(screen.getByTestId('blocked-titles')).toHaveTextContent('Sanitized')
    })
  })

  it('falls back to the sent list when the echo carries no user', async () => {
    mockPut(true, 200, {})
    render(<Probe />)
    await expectLoaded()

    fireEvent.click(screen.getByText('block'))

    await waitFor(() => {
      expect(screen.getByTestId('blocked')).toHaveTextContent('GdmcWQCbqY8')
    })
  })

  it('falls back to the sent list when the echo user has no list', async () => {
    mockPut(true, 200, { user: {} })
    render(<Probe />)
    await expectLoaded()

    fireEvent.click(screen.getByText('block'))

    await waitFor(() => {
      expect(screen.getByTestId('blocked')).toHaveTextContent('GdmcWQCbqY8')
    })
  })

  it('does not block an already-hidden video', async () => {
    getUserByEmail.mockResolvedValue({
      id: 'u1',
      blockedVideos: [{ videoId: 'GdmcWQCbqY8', title: 'Vowel Teams' }],
    })
    const fetchMock = mockPut(true)
    render(<Probe />)
    await waitFor(() => {
      expect(screen.getByTestId('blocked')).toHaveTextContent('GdmcWQCbqY8')
    })

    fireEvent.click(screen.getByText('block'))

    await Promise.resolve()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not block when signed out', async () => {
    mockSession('unauthenticated')
    const fetchMock = mockPut(true)
    render(<Probe />)
    await expectLoaded()

    fireEvent.click(screen.getByText('block'))

    await Promise.resolve()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reverts and toasts when blocking fails', async () => {
    const fetchMock = mockPut(false, 500)
    render(<Probe />)
    await expectLoaded()

    fireEvent.click(screen.getByText('block'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByTestId('blocked')).toHaveTextContent('')
    })
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { location: 'useBlockedVideos.blockVideo' })
    expect(toasts).toEqual(["Something went wrong on our end. We're looking into it."])
  })

  it('unblocks a video and persists the list', async () => {
    getUserByEmail.mockResolvedValue({
      id: 'u1',
      blockedVideos: [
        { videoId: 'GdmcWQCbqY8', title: 'Vowel Teams' },
        { videoId: 'mxVWScxsOsc', title: 'Silent E' },
      ],
    })
    const fetchMock = mockPut(true)
    render(<Probe />)
    await waitFor(() => {
      expect(screen.getByTestId('blocked')).toHaveTextContent('GdmcWQCbqY8,mxVWScxsOsc')
    })

    fireEvent.click(screen.getByText('unblock'))

    await waitFor(() => {
      expect(screen.getByTestId('blocked')).toHaveTextContent('mxVWScxsOsc')
    })
    expect(fetchMock).toHaveBeenCalledWith('/api/users/u1', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockedVideos: [{ videoId: 'mxVWScxsOsc', title: 'Silent E' }] }),
    })
  })

  it('does not unblock a video that is not hidden', async () => {
    getUserByEmail.mockResolvedValue({
      id: 'u1',
      blockedVideos: [{ videoId: 'mxVWScxsOsc', title: 'Silent E' }],
    })
    const fetchMock = mockPut(true)
    render(<Probe />)
    await waitFor(() => {
      expect(screen.getByTestId('blocked')).toHaveTextContent('mxVWScxsOsc')
    })

    fireEvent.click(screen.getByText('unblock'))

    await Promise.resolve()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.getByTestId('blocked')).toHaveTextContent('mxVWScxsOsc')
  })

  it('does not unblock when signed out', async () => {
    mockSession('unauthenticated')
    const fetchMock = mockPut(true)
    render(<Probe />)
    await expectLoaded()

    fireEvent.click(screen.getByText('unblock'))

    await Promise.resolve()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reverts and toasts when unblocking fails', async () => {
    getUserByEmail.mockResolvedValue({
      id: 'u1',
      blockedVideos: [{ videoId: 'GdmcWQCbqY8', title: 'Vowel Teams' }],
    })
    const fetchMock = mockPut(false, 500)
    render(<Probe />)
    await waitFor(() => {
      expect(screen.getByTestId('blocked')).toHaveTextContent('GdmcWQCbqY8')
    })

    fireEvent.click(screen.getByText('unblock'))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(screen.getByTestId('blocked')).toHaveTextContent('GdmcWQCbqY8')
    })
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), { location: 'useBlockedVideos.unblockVideo' })
    expect(toasts).toEqual(["Something went wrong on our end. We're looking into it."])
  })
})
