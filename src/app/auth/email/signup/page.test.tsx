import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import EmailSignUpPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: vi.fn() }))

const useSessionMock = vi.mocked(useSession)
const useRouterMock = vi.mocked(useRouter)
const pushMock = vi.fn()
const fetchMock = vi.fn()

function fillAndSubmit(name: string, email: string, password: string) {
  fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: name } })
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } })
  fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: password } })
  fireEvent.click(screen.getByRole('button', { name: /create account/i }))
}

beforeEach(() => {
  useSessionMock.mockReset()
  useRouterMock.mockReset()
  pushMock.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' } as never)
  useRouterMock.mockReturnValue({ push: pushMock, replace: vi.fn() } as never)
  document.body.removeAttribute('data-auth-page')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('EmailSignUpPage', () => {
  it('renders the sign-up form with the password requirements', () => {
    render(<EmailSignUpPage />)

    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument()
    expect(screen.getByLabelText(/your name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
  })

  it('creates the account and routes to verification', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, userConfirmed: false }) })
    render(<EmailSignUpPage />)

    fillAndSubmit('Chaley', 't@e.com', 'S3cure!pass')

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/auth/email/signup', expect.objectContaining({ method: 'POST' }))
      expect(pushMock).toHaveBeenCalledWith('/auth/email/verify?email=t%40e.com')
    })
  })

  it('points at sign-in when the email is already registered', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false, code: 'email-in-use' }) })
    render(<EmailSignUpPage />)

    fillAndSubmit('N', 't@e.com', 'S3cure!pass')

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('already exists')
    expect(screen.getByRole('link', { name: /sign in instead/i })).toHaveAttribute('href', '/auth/email/signin')
  })

  it('explains a weak password', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false, code: 'weak-password' }) })
    render(<EmailSignUpPage />)

    fillAndSubmit('N', 't@e.com', 'password1')

    expect(await screen.findByRole('alert')).toHaveTextContent('at least 8 characters')
  })

  it('explains invalid input and unconfigured email auth', async () => {
    for (const code of ['invalid-input', 'not-configured']) {
      fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false, code }) })
      const { unmount } = render(<EmailSignUpPage />)

      fillAndSubmit('N', 't@e.com', 'S3cure!pass')

      expect(await screen.findByRole('alert')).toBeInTheDocument()
      unmount()
    }
  })

  it('falls back to a generic message for unknown codes and network failures', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false, code: 'mystery' }) })
    const { unmount } = render(<EmailSignUpPage />)
    fillAndSubmit('N', 't@e.com', 'S3cure!pass')
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
    unmount()

    // A failure body without a code still gets the generic message.
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false }) })
    const { unmount: unmount2 } = render(<EmailSignUpPage />)
    fillAndSubmit('N', 't@e.com', 'S3cure!pass')
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
    unmount2()

    fetchMock.mockRejectedValue(new Error('network down'))
    render(<EmailSignUpPage />)
    fillAndSubmit('N', 't@e.com', 'S3cure!pass')
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
  })

  it('disables the form while creating the account', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    render(<EmailSignUpPage />)

    fillAndSubmit('N', 't@e.com', 'S3cure!pass')

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /creating your account/i })).toBeDisabled()
    })
  })
})
