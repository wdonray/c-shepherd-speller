import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import SignIn from './page'

vi.mock('next-auth/react', () => ({ signIn: vi.fn(), useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: vi.fn() }))

const signInMock = vi.mocked(signIn)
const useSessionMock = vi.mocked(useSession)
const useRouterMock = vi.mocked(useRouter)
const replaceMock = vi.fn()

describe('SignIn page', () => {
  beforeEach(() => {
    signInMock.mockReset()
    useSessionMock.mockReset()
    replaceMock.mockReset()
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' } as never)
    useRouterMock.mockReturnValue({ replace: replaceMock } as never)
    document.body.removeAttribute('data-auth-page')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the sign-in card with a Google button', () => {
    render(<SignIn />)
    expect(screen.getByRole('heading', { name: 'PatternSpell' })).toBeInTheDocument()
    expect(screen.getByText('A pattern-based spelling toolkit for K-3 teachers.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
    expect(screen.getByText('Free for everyone.')).toBeInTheDocument()
  })

  it('sets data-auth-page on the body while mounted and removes it on unmount', () => {
    const { unmount } = render(<SignIn />)
    expect(document.body.getAttribute('data-auth-page')).toBe('true')
    unmount()
    expect(document.body.hasAttribute('data-auth-page')).toBe(false)
  })

  it('calls signIn with google and the root callbackUrl, showing a loading state', async () => {
    signInMock.mockImplementation(() => new Promise(() => {}))
    render(<SignIn />)

    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))

    expect(signInMock).toHaveBeenCalledTimes(1)
    expect(signInMock).toHaveBeenCalledWith('google', { callbackUrl: '/' })
    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeDisabled()
    })
  })

  it('triggers sign-in from the Enter key', () => {
    signInMock.mockResolvedValue(undefined)
    render(<SignIn />)

    fireEvent.keyDown(screen.getByRole('button', { name: /sign in with google/i }), { key: 'Enter' })

    expect(signInMock).toHaveBeenCalledTimes(1)
  })

  it('does not trigger sign-in from the Enter key while loading', async () => {
    signInMock.mockImplementation(() => new Promise(() => {}))
    render(<SignIn />)
    const button = screen.getByRole('button', { name: /sign in with google/i })

    fireEvent.click(button)
    fireEvent.keyDown(button, { key: 'Enter' })

    expect(signInMock).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(button).toBeDisabled())
  })

  it('logs the error and resets loading when signIn throws', async () => {
    const error = new Error('OAuth boom')
    signInMock.mockRejectedValue(error)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<SignIn />)

    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(error)
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in with google/i })).not.toBeDisabled()
    })
  })

  it('redirects authenticated users to the homepage instead of showing the form', async () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: 'u1' } },
      status: 'authenticated',
    } as never)
    render(<SignIn />)

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/')
    })
    expect(screen.queryByRole('button', { name: /sign in with google/i })).not.toBeInTheDocument()
  })

  it('does not redirect while the session is loading', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'loading' } as never)
    render(<SignIn />)

    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('shows a centered loading indicator while the session is loading, not the sign-in form', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'loading' } as never)
    render(<SignIn />)

    expect(screen.getByRole('status', { name: 'Checking sign-in status' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /sign in with google/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'PatternSpell' })).not.toBeInTheDocument()
  })
})
