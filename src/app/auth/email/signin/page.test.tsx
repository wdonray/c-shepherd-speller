import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { getProviders, signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import EmailSignInPage from './page'

vi.mock('next-auth/react', () => ({ getProviders: vi.fn(), signIn: vi.fn(), useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: vi.fn(), useSearchParams: vi.fn() }))

const getProvidersMock = vi.mocked(getProviders)
const signInMock = vi.mocked(signIn)
const useSessionMock = vi.mocked(useSession)
const useRouterMock = vi.mocked(useRouter)
const mockSearchParams = { get: vi.fn() as Mock<(key: string) => string | null> }
const useSearchParamsMock = vi.mocked(useSearchParams)
const pushMock = vi.fn()
const replaceMock = vi.fn()

const emailPasswordProviders = { 'email-password': { id: 'email-password', name: 'Email' } } as never

function fillAndSubmit(email: string, password: string) {
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } })
  fireEvent.change(screen.getByLabelText(/password/i), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }))
}

beforeEach(() => {
  getProvidersMock.mockReset()
  signInMock.mockReset()
  useSessionMock.mockReset()
  useRouterMock.mockReset()
  useSearchParamsMock.mockReset()
  pushMock.mockReset()
  replaceMock.mockReset()
  useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' } as never)
  useRouterMock.mockReturnValue({ push: pushMock, replace: replaceMock } as never)
  useSearchParamsMock.mockReturnValue(mockSearchParams as never)
  mockSearchParams.get.mockReturnValue(null)
  getProvidersMock.mockResolvedValue(emailPasswordProviders)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('EmailSignInPage', () => {
  it('renders the form once the email-password provider is confirmed', async () => {
    render(<EmailSignInPage />)

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /forgot your password/i })).toHaveAttribute(
      'href',
      '/auth/email/forgot-password'
    )
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/auth/email/signup')
  })

  it('prefills the email from the query string', async () => {
    mockSearchParams.get.mockReturnValue('teacher@school.org')
    render(<EmailSignInPage />)

    expect(await screen.findByLabelText(/email/i)).toHaveValue('teacher@school.org')
  })

  it('shows a spinner while the provider check is in flight', () => {
    getProvidersMock.mockImplementation(() => new Promise(() => {}))
    render(<EmailSignInPage />)

    expect(screen.getByRole('status', { name: 'Loading sign-in form' })).toBeInTheDocument()
  })

  it('explains when email sign-in is not configured', async () => {
    getProvidersMock.mockResolvedValue({ google: { id: 'google' } } as never)
    render(<EmailSignInPage />)

    expect(await screen.findByText(/email sign-in is not set up yet/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument()
  })

  it('explains when the provider check fails', async () => {
    getProvidersMock.mockRejectedValue(new Error('nope'))
    render(<EmailSignInPage />)

    expect(await screen.findByText(/email sign-in is not set up yet/i)).toBeInTheDocument()
  })

  it('explains when no providers come back at all', async () => {
    getProvidersMock.mockResolvedValue(null)
    render(<EmailSignInPage />)

    expect(await screen.findByText(/email sign-in is not set up yet/i)).toBeInTheDocument()
  })

  it('signs in and navigates home on success', async () => {
    signInMock.mockResolvedValue({ ok: true, url: '/' } as never)
    render(<EmailSignInPage />)
    await screen.findByRole('button', { name: /^sign in$/i })

    fillAndSubmit('t@e.com', 's3cret')

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith('email-password', {
        email: 't@e.com',
        password: 's3cret',
        redirect: false,
        callbackUrl: '/home',
      })
      expect(pushMock).toHaveBeenCalledWith('/')
    })
  })

  it('falls back to the homepage when the result has no url', async () => {
    signInMock.mockResolvedValue({ ok: true } as never)
    render(<EmailSignInPage />)
    await screen.findByRole('button', { name: /^sign in$/i })

    fillAndSubmit('t@e.com', 's3cret')

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/home')
    })
  })

  it('shows a generic message when signIn returns nothing usable', async () => {
    signInMock.mockResolvedValue(undefined as never)
    render(<EmailSignInPage />)
    await screen.findByRole('button', { name: /^sign in$/i })

    fillAndSubmit('t@e.com', 's3cret')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
  })

  it('shows a friendly message for bad credentials', async () => {
    signInMock.mockResolvedValue({ ok: false, error: 'invalid-credentials' } as never)
    render(<EmailSignInPage />)
    await screen.findByRole('button', { name: /^sign in$/i })

    fillAndSubmit('t@e.com', 'wrong')

    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.')
  })

  it('links to verification when the account is not confirmed', async () => {
    signInMock.mockResolvedValue({ ok: false, error: 'not-confirmed' } as never)
    render(<EmailSignInPage />)
    await screen.findByRole('button', { name: /^sign in$/i })

    fillAndSubmit('t@e.com', 's3cret')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('not verified yet')
    expect(screen.getByRole('link', { name: /enter your verification code/i })).toHaveAttribute(
      'href',
      '/auth/email/verify?email=t%40e.com'
    )
  })

  it('falls back to a generic message for unknown error codes', async () => {
    signInMock.mockResolvedValue({ ok: false, error: 'something-new' } as never)
    render(<EmailSignInPage />)
    await screen.findByRole('button', { name: /^sign in$/i })

    fillAndSubmit('t@e.com', 's3cret')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
  })

  it('falls back when signIn itself throws', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    signInMock.mockRejectedValue(new Error('network down'))
    render(<EmailSignInPage />)
    await screen.findByRole('button', { name: /^sign in$/i })

    fillAndSubmit('t@e.com', 's3cret')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
    consoleSpy.mockRestore()
  })

  it('disables the form while signing in', async () => {
    signInMock.mockImplementation(() => new Promise(() => {}))
    render(<EmailSignInPage />)
    await screen.findByRole('button', { name: /^sign in$/i })

    fillAndSubmit('t@e.com', 's3cret')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled()
      expect(screen.getByLabelText(/email/i)).toBeDisabled()
    })
  })
})
