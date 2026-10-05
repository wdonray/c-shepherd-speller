import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock('next/navigation', () => ({
  useRouter: vi.fn(),
}))

import { signOut, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

import { useAuth } from './useAuth'

const mockedUseSession = vi.mocked(useSession)
const mockedSignOut = vi.mocked(signOut)
const mockedUseRouter = vi.mocked(useRouter)

function Probe() {
  const { session, status, isAuthenticated, isLoading, logout } = useAuth()
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="is-authenticated">{String(isAuthenticated)}</p>
      <p data-testid="is-loading">{String(isLoading)}</p>
      <p data-testid="session">{JSON.stringify(session ?? null)}</p>
      <button onClick={logout}>Log out</button>
    </div>
  )
}

const push = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  mockedUseRouter.mockReturnValue({ push } as unknown as ReturnType<typeof useRouter>)
})

describe('useAuth', () => {
  it('reports the unauthenticated state', () => {
    mockedUseSession.mockReturnValue({ data: null, status: 'unauthenticated' } as ReturnType<typeof useSession>)
    render(<Probe />)
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated')
    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
    expect(screen.getByTestId('is-loading')).toHaveTextContent('false')
    expect(screen.getByTestId('session')).toHaveTextContent('null')
  })

  it('reports the loading state', () => {
    mockedUseSession.mockReturnValue({ data: null, status: 'loading' } as ReturnType<typeof useSession>)
    render(<Probe />)
    expect(screen.getByTestId('status')).toHaveTextContent('loading')
    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('false')
    expect(screen.getByTestId('is-loading')).toHaveTextContent('true')
  })

  it('reports the authenticated state with the session', () => {
    const session = { user: { name: 'Donray', email: 'donray@example.com' }, expires: '2026-11-01' }
    mockedUseSession.mockReturnValue({ data: session, status: 'authenticated' } as ReturnType<typeof useSession>)
    render(<Probe />)
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated')
    expect(screen.getByTestId('is-authenticated')).toHaveTextContent('true')
    expect(screen.getByTestId('is-loading')).toHaveTextContent('false')
    expect(screen.getByTestId('session')).toHaveTextContent('donray@example.com')
  })

  it('logout calls signOut with redirect:false then pushes to /auth/signin', async () => {
    mockedUseSession.mockReturnValue({
      data: null,
      status: 'unauthenticated',
      update: async () => null,
    } as ReturnType<typeof useSession>)
    mockedSignOut.mockResolvedValue(undefined)
    render(<Probe />)
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))

    await vi.waitFor(() => expect(mockedSignOut).toHaveBeenCalledWith({ redirect: false }))
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/auth/signin'))
  })

  it('logout pushes to signin even if signOut resolves without a session', async () => {
    mockedUseSession.mockReturnValue({ data: null, status: 'unauthenticated' } as ReturnType<typeof useSession>)
    mockedSignOut.mockResolvedValue(undefined)
    render(<Probe />)
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }))
    await vi.waitFor(() => expect(push).toHaveBeenCalledWith('/auth/signin'))
  })
})
