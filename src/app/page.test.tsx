import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import Home from './page'
import type { WordList } from '@/models/WordList'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
const { getLists } = vi.hoisted(() => ({ getLists: vi.fn() }))
vi.mock('@/lib/lists-api', () => ({ getLists }))

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

describe('Home page', () => {
  beforeEach(() => {
    useSessionMock.mockReset()
    getLists.mockResolvedValue([])
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

  it('opens the sheet when New list is clicked', async () => {
    mockSession({ user: { email: 'a@b.c', name: 'Donray' } }, 'authenticated')
    stubFetch(async () => ({ ok: true, json: async () => ({ user: { id: 'u1' } }) }))

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New list' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'New list' }))
    // The sheet should open (SpellingManagerSheet renders)
    await waitFor(() => {
      expect(screen.getByText('My Spelling Lists')).toBeInTheDocument()
    })
  })

  it('opens the sheet when Edit is clicked on a list card', async () => {
    getLists.mockResolvedValue([list])
    mockSession({ user: { email: 'a@b.c', name: 'Donray' } }, 'authenticated')
    stubFetch(async () => ({ ok: true, json: async () => ({ user: { id: 'u1' } }) }))

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Week 5')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /edit/i }))
    await waitFor(() => {
      expect(screen.getByText('My Spelling Lists')).toBeInTheDocument()
    })
  })

  it('opens the sheet when Delete is clicked on a list card', async () => {
    getLists.mockResolvedValue([list])
    mockSession({ user: { email: 'a@b.c', name: 'Donray' } }, 'authenticated')
    stubFetch(async () => ({ ok: true, json: async () => ({ user: { id: 'u1' } }) }))

    render(<Home />)

    await waitFor(() => {
      expect(screen.getByText('Week 5')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /delete/i }))
    await waitFor(() => {
      expect(screen.getByText('My Spelling Lists')).toBeInTheDocument()
    })
  })

  it('uses empty name when the session has no name', async () => {
    mockSession({ user: { email: 'a@b.c' } }, 'authenticated')
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
    expect(JSON.parse(postCall?.[1]?.body as string)).toEqual({ email: 'a@b.c', name: '' })
  })
})
