import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import Home from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('@/lib/lists-api', () => ({
  getLists: vi.fn().mockResolvedValue([]),
}))

const useSessionMock = vi.mocked(useSession)

function mockSession(session: unknown, status: 'loading' | 'authenticated' | 'unauthenticated') {
  useSessionMock.mockReturnValue({ data: session, status, update: async () => null } as never)
}

function stubFetch(handler: (url: string, init?: RequestInit) => Promise<unknown>) {
  const fetchMock = vi.fn(handler)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('Home page', () => {
  beforeEach(() => {
    useSessionMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a spinner while the session is loading', () => {
    mockSession(null, 'loading')
    const { container } = render(<Home />)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
    expect(screen.queryByText(/my word lists/i)).not.toBeInTheDocument()
  })

  it('renders the dashboard after user sync', async () => {
    mockSession({ user: { email: 'a@b.c', name: 'Donray' } }, 'authenticated')
    stubFetch(async () => ({ ok: true, json: async () => ({ user: { id: 'u1' } }) }))

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText(/my word lists/i)).toBeInTheDocument()
    })
  })

  it('skips the POST when the user already exists', async () => {
    mockSession({ user: { email: 'a@b.c', name: 'Donray' } }, 'authenticated')
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => ({ user: { id: 'u1' } }) }))

    render(<Home />)

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

    render(<Home />)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/users', expect.objectContaining({ method: 'POST' }))
    })
    const postCall = fetchMock.mock.calls.find((call) => call[1]?.method === 'POST')
    expect(JSON.parse(postCall?.[1]?.body as string)).toEqual({ email: 'a@b.c', name: 'Donray' })
  })

  it('does not call the API when the session has no email', async () => {
    mockSession({ user: { name: 'Donray' } }, 'authenticated')
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => ({ user: { id: 'u1' } }) }))

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText(/my word lists/i)).toBeInTheDocument()
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
