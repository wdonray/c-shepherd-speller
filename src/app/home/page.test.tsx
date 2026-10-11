import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import HomePage from './page'
import type { WordList } from '@/models/WordList'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))
const { getLists } = vi.hoisted(() => ({ getLists: vi.fn() }))
vi.mock('@/lib/lists-api', () => ({ getLists, LISTS_CHANGED_EVENT: 'shepherd-speller:lists-changed' }))

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5',
  patterns: [],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

const useSessionMock = vi.mocked(useSession)

function mockSession(session: unknown, status: 'loading' | 'authenticated' | 'unauthenticated') {
  useSessionMock.mockReturnValue({ data: session, status, update: async () => null } as never)
}

function stubFetch(handler: (url: string, init?: RequestInit) => Promise<unknown>) {
  const fetchMock = vi.fn(handler)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('Home page (/home)', () => {
  beforeEach(() => {
    useSessionMock.mockReset()
    getLists.mockResolvedValue([])
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a dashboard skeleton while the session is loading', () => {
    mockSession(null, 'loading')
    const { container } = render(<HomePage />)
    expect(screen.getByRole('status', { name: 'Loading dashboard' })).toBeInTheDocument()
    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument()
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
    expect(screen.queryByText(/my word lists/i)).not.toBeInTheDocument()
  })

  it('renders the dashboard after user sync', async () => {
    mockSession({ user: { email: 'a@b.c', name: 'Donray' } }, 'authenticated')
    stubFetch(async () => ({ ok: true, json: async () => ({ user: { id: 'u1' } }) }))

    render(<HomePage />)

    await waitFor(() => {
      expect(screen.getByText(/my word lists/i)).toBeInTheDocument()
    })
  })

  it('skips the POST when the user already exists', async () => {
    mockSession({ user: { email: 'a@b.c', name: 'Donray' } }, 'authenticated')
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => ({ user: { id: 'u1' } }) }))

    render(<HomePage />)

    await waitFor(() => {
      expect(screen.getByText(/my word lists/i)).toBeInTheDocument()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/users?email=a@b.c')
  })

  it('creates the user with a POST when the user record has no id', async () => {
    mockSession({ user: { email: 'a@b.c', name: 'Donray' } }, 'authenticated')
    const fetchMock = stubFetch(async (url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? { ok: true, json: async () => ({ user: { id: 'u1' } }) }
        : { ok: true, json: async () => ({ user: {} }) }
    )

    render(<HomePage />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/users', expect.objectContaining({ method: 'POST' }))
    })
    const postCall = fetchMock.mock.calls.find((call) => call[1]?.method === 'POST')
    expect(JSON.parse(postCall?.[1]?.body as string)).toEqual({ email: 'a@b.c', name: 'Donray' })
  })

  it('does not call the API when the session has no email', async () => {
    mockSession({ user: { name: 'Donray' } }, 'authenticated')
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => ({ user: { id: 'u1' } }) }))

    render(<HomePage />)

    await waitFor(() => {
      expect(screen.getByText(/my word lists/i)).toBeInTheDocument()
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('navigates to the new-list page when New list is clicked', async () => {
    mockSession({ user: { email: 'a@b.c', name: 'Donray' } }, 'authenticated')
    stubFetch(async () => ({ ok: true, json: async () => ({ user: { id: 'u1' } }) }))

    render(<HomePage />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New list' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'New list' }))
    expect(mockPush).toHaveBeenCalledWith('/lists/new')
  })

  it('navigates to the list page when Edit list is clicked on a card', async () => {
    getLists.mockResolvedValue([list])
    mockSession({ user: { email: 'a@b.c', name: 'Donray' } }, 'authenticated')
    stubFetch(async () => ({ ok: true, json: async () => ({ user: { id: 'u1' } }) }))

    render(<HomePage />)

    await waitFor(() => {
      expect(screen.getByText('Week 5')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Edit list' }))
    expect(mockPush).toHaveBeenCalledWith('/lists/l1')
  })

  it('uses empty name when the session has no name', async () => {
    mockSession({ user: { email: 'a@b.c' } }, 'authenticated')
    const fetchMock = stubFetch(async (url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? { ok: true, json: async () => ({ user: { id: 'u1' } }) }
        : { ok: true, json: async () => ({ user: {} }) }
    )

    render(<HomePage />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/users', expect.objectContaining({ method: 'POST' }))
    })
    const postCall = fetchMock.mock.calls.find((call) => call[1]?.method === 'POST')
    expect(JSON.parse(postCall?.[1]?.body as string)).toEqual({ email: 'a@b.c', name: '' })
  })

  it('scrolls to the top on mount and re-pins via rAF', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    // Run rAF callbacks synchronously so the re-pin loop is covered.
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0)
      return 1
    })
    mockSession({ user: { email: 'a@b.c' } }, 'authenticated')
    stubFetch(async () => ({ ok: true, json: async () => ({ user: { id: 'u1' } }) }))

    render(<HomePage />)

    // 1 immediate + 2 rAF re-pins
    expect(scrollToSpy).toHaveBeenCalledTimes(3)
    expect(scrollToSpy).toHaveBeenCalledWith(0, 0)
    scrollToSpy.mockRestore()
    rafSpy.mockRestore()
  })

  it('cancels the pending rAF pin on unmount', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    let rafCallback: FrameRequestCallback | null = null
    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallback = cb
      return 42
    })
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
    mockSession({ user: { email: 'a@b.c' } }, 'authenticated')
    stubFetch(async () => ({ ok: true, json: async () => ({ user: { id: 'u1' } }) }))

    const { unmount } = render(<HomePage />)
    expect(rafCallback).not.toBeNull()
    unmount()

    expect(cancelSpy).toHaveBeenCalledWith(42)
    scrollToSpy.mockRestore()
    rafSpy.mockRestore()
    cancelSpy.mockRestore()
  })

  it('sets manual scroll restoration when supported', () => {
    const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    // jsdom lacks scrollRestoration; define it so the manual branch is covered.
    Object.defineProperty(window.history, 'scrollRestoration', {
      value: 'auto',
      writable: true,
      configurable: true,
    })
    mockSession({ user: { email: 'a@b.c' } }, 'authenticated')
    stubFetch(async () => ({ ok: true, json: async () => ({ user: { id: 'u1' } }) }))

    render(<HomePage />)

    expect(window.history.scrollRestoration).toBe('manual')
    scrollToSpy.mockRestore()
  })
})
