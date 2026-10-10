import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { getProviders, signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import SignIn from './page'

vi.mock('next-auth/react', () => ({ getProviders: vi.fn(), signIn: vi.fn(), useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: vi.fn() }))

const getProvidersMock = vi.mocked(getProviders)
const signInMock = vi.mocked(signIn)
const useSessionMock = vi.mocked(useSession)
const useRouterMock = vi.mocked(useRouter)
const replaceMock = vi.fn()
const pushMock = vi.fn()

const googleOnlyProviders = { google: { id: 'google', name: 'Google' } }
const allProviders = {
  ...googleOnlyProviders,
  'email-password': { id: 'email-password', name: 'Email' },
} as never

describe('SignIn page', () => {
  beforeEach(() => {
    signInMock.mockReset()
    useSessionMock.mockReset()
    getProvidersMock.mockReset()
    replaceMock.mockReset()
    pushMock.mockReset()
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' } as never)
    useRouterMock.mockReturnValue({ replace: replaceMock, push: pushMock } as never)
    getProvidersMock.mockResolvedValue(googleOnlyProviders as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the sign-in card with a Google button', async () => {
    render(<SignIn />)
    expect(screen.getByRole('heading', { name: 'PatternSpell' })).toBeInTheDocument()
    expect(screen.getByText('A pattern-based spelling toolkit for K-3 teachers.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
    expect(screen.getByText('Free for everyone.')).toBeInTheDocument()
  })

  it('never locks body scroll or tags the body while mounted', () => {
    const { unmount } = render(<SignIn />)
    expect(document.body.hasAttribute('data-auth-page')).toBe(false)
    expect(document.body.style.overflow).not.toBe('hidden')
    unmount()
    expect(document.body.hasAttribute('data-auth-page')).toBe(false)
  })

  it('calls signIn with google and the root callbackUrl, showing a loading state', async () => {
    signInMock.mockImplementation(() => new Promise(() => {}))
    render(<SignIn />)

    fireEvent.click(await screen.findByRole('button', { name: /sign in with google/i }))

    expect(signInMock).toHaveBeenCalledTimes(1)
    expect(signInMock).toHaveBeenCalledWith('google', { callbackUrl: '/' })
    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeDisabled()
    })
  })

  it('triggers sign-in from the Enter key', async () => {
    signInMock.mockResolvedValue(undefined)
    render(<SignIn />)

    fireEvent.keyDown(await screen.findByRole('button', { name: /sign in with google/i }), { key: 'Enter' })

    expect(signInMock).toHaveBeenCalledTimes(1)
  })

  it('does not trigger sign-in from the Enter key while loading', async () => {
    signInMock.mockImplementation(() => new Promise(() => {}))
    render(<SignIn />)
    const button = await screen.findByRole('button', { name: /sign in with google/i })

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

    fireEvent.click(await screen.findByRole('button', { name: /sign in with google/i }))

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(error)
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in with google/i })).not.toBeDisabled()
    })
  })

  it('shows the email sign-in button when the email-password provider is configured', async () => {
    getProvidersMock.mockResolvedValue(allProviders)
    render(<SignIn />)

    const emailButton = await screen.findByRole('button', { name: 'Sign in with email and password' })
    expect(emailButton).toBeInTheDocument()
    expect(emailButton).toHaveAccessibleName('Sign in with email and password')
    // The Google button stays put above the divider.
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })

  it('hides the email sign-in button when Cognito is not configured', async () => {
    render(<SignIn />)

    // Wait for the providers fetch to resolve so the absence is meaningful.
    await screen.findByRole('button', { name: /sign in with google/i })
    expect(screen.queryByRole('button', { name: 'Sign in with email and password' })).not.toBeInTheDocument()
  })

  it('hides the email sign-in button when the providers fetch fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    getProvidersMock.mockRejectedValue(new Error('providers boom'))
    render(<SignIn />)

    await waitFor(() => expect(consoleSpy).toHaveBeenCalled())
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sign in with email and password' })).not.toBeInTheDocument()
  })

  it('routes to the custom email sign-in page from the email button', async () => {
    getProvidersMock.mockResolvedValue(allProviders)
    render(<SignIn />)

    fireEvent.click(await screen.findByRole('button', { name: 'Sign in with email and password' }))

    expect(pushMock).toHaveBeenCalledWith('/auth/email/signin')
    // It is a plain navigation, not an OAuth redirect: signIn is untouched.
    expect(signInMock).not.toHaveBeenCalled()
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
