import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { getSpelling } from '@/lib/spelling-api'
import DisplayMode from './DisplayMode'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('@/lib/spelling-api', () => ({ getSpelling: vi.fn() }))
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const useSessionMock = vi.mocked(useSession)
const getSpellingMock = vi.mocked(getSpelling)

const DATA = {
  words: ['cat', 'dog', 'bird'],
  sounds: ['sh', 'ch'],
  spelling: ['tion'],
}

function mockSession(userId: string | null) {
  useSessionMock.mockReturnValue({
    data: userId ? { user: { id: userId, email: 't@e.c' } } : null,
    status: userId ? 'authenticated' : 'unauthenticated',
    update: async () => null,
  } as never)
}

describe('DisplayMode', () => {
  beforeEach(() => {
    useSessionMock.mockReset()
    getSpellingMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a loading state when there is no session user yet', () => {
    mockSession(null)
    render(<DisplayMode />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading your spelling lists...')
    expect(getSpellingMock).not.toHaveBeenCalled()
  })

  it('shows all words at once, numbered, on load', async () => {
    mockSession('u1')
    getSpellingMock.mockResolvedValue(DATA)
    render(<DisplayMode />)

    for (const word of DATA.words) {
      await screen.findByText(word)
    }
    // All three visible at once, with position numbers.
    const items = screen.getAllByRole('listitem')
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent('1')
    expect(items[2]).toHaveTextContent('3')
    expect(getSpellingMock).toHaveBeenCalledWith('u1')
  })

  it('switches between the three lists with the picker', async () => {
    mockSession('u1')
    getSpellingMock.mockResolvedValue(DATA)
    render(<DisplayMode />)
    await screen.findByText('cat')

    fireEvent.click(screen.getByRole('button', { name: /sounds/i }))
    await screen.findByText('sh')
    expect(screen.queryByText('cat')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sounds/i })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: /spelling patterns/i }))
    await screen.findByText('tion')
    expect(screen.queryByText('sh')).not.toBeInTheDocument()
  })

  it('shows the item count on each picker button', async () => {
    mockSession('u1')
    getSpellingMock.mockResolvedValue(DATA)
    render(<DisplayMode />)
    await screen.findByText('cat')

    expect(screen.getByRole('button', { name: /words/i })).toHaveTextContent('(3)')
    expect(screen.getByRole('button', { name: /sounds/i })).toHaveTextContent('(2)')
    expect(screen.getByRole('button', { name: /spelling patterns/i })).toHaveTextContent('(1)')
  })

  it('shows a neutral empty state when the active list has no items', async () => {
    mockSession('u1')
    getSpellingMock.mockResolvedValue({ words: [], sounds: [], spelling: [] })
    render(<DisplayMode />)

    await screen.findByText('No words in this list yet.')
    expect(screen.getByText('Add items from My Spelling Lists on the home page.')).toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('shows an error with a working retry when loading fails', async () => {
    mockSession('u1')
    getSpellingMock.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce(DATA)
    render(<DisplayMode />)

    await screen.findByRole('alert')
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load your spelling lists.')

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    for (const word of DATA.words) {
      await screen.findByText(word)
    }
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(getSpellingMock).toHaveBeenCalledTimes(2)
  })

  it('links back home from the display', async () => {
    mockSession('u1')
    getSpellingMock.mockResolvedValue(DATA)
    render(<DisplayMode />)
    await screen.findByText('cat')

    expect(screen.getByRole('link', { name: /exit display/i })).toHaveAttribute('href', '/')
  })

  it('does not update state after unmount while loading', async () => {
    mockSession('u1')
    let resolveLoad!: (data: typeof DATA) => void
    getSpellingMock.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve
      })
    )

    const { unmount } = render(<DisplayMode />)
    unmount()
    await act(async () => {
      resolveLoad(DATA)
    })
    // No crash, no state update on the unmounted component.
    expect(screen.queryByText('cat')).not.toBeInTheDocument()
  })

  it('does not set the error after unmount when loading fails', async () => {
    mockSession('u1')
    let rejectLoad!: (reason: Error) => void
    getSpellingMock.mockReturnValue(
      new Promise((_, reject) => {
        rejectLoad = reject
      })
    )

    const { unmount } = render(<DisplayMode />)
    unmount()
    await act(async () => {
      rejectLoad(new Error('boom'))
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('refetches when the session changes', async () => {
    mockSession('u1')
    getSpellingMock.mockResolvedValue(DATA)
    const { rerender } = render(<DisplayMode />)
    await screen.findByText('cat')

    mockSession('u2')
    rerender(<DisplayMode />)
    await waitFor(() => expect(getSpellingMock).toHaveBeenCalledWith('u2'))
  })
})
