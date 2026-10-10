import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { type Ref, forwardRef, useImperativeHandle } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import EmailSignUpPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: vi.fn() }))

const { executeMock } = vi.hoisted(() => ({ executeMock: vi.fn() }))

vi.mock('../_components/turnstile-widget', () => ({
  default: forwardRef(function MockTurnstileWidget(
    _props: object,
    ref: Ref<{ execute: () => Promise<string | null> }>
  ) {
    useImperativeHandle(ref, () => ({ execute: executeMock }))
    return <div data-testid="turnstile-widget" />
  }),
}))

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
  executeMock.mockReset()
  executeMock.mockResolvedValue('test-token')
  useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' } as never)
  useRouterMock.mockReturnValue({ push: pushMock, replace: vi.fn() } as never)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
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
    expect(screen.getByRole('link', { name: /sign in with email/i })).toHaveAttribute('href', '/auth/email/signin')
    expect(screen.getByRole('link', { name: /sign in with google/i })).toHaveAttribute('href', '/auth/signin')
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

  it('hides a honeypot field from real users', () => {
    render(<EmailSignUpPage />)

    const honeypot = screen.getByLabelText(/website/i)
    expect(honeypot).toHaveAttribute('tabindex', '-1')
    expect(honeypot).toHaveAttribute('autocomplete', 'off')
    expect(honeypot.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it('sends the honeypot value with the signup request', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, userConfirmed: false }) })
    render(<EmailSignUpPage />)

    fireEvent.change(screen.getByLabelText(/website/i), { target: { value: 'https://spam.example' } })
    fillAndSubmit('N', 't@e.com', 'S3cure!pass')

    await waitFor(() => expect(fetchMock).toHaveBeenCalled())
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.website).toBe('https://spam.example')
  })

  it('does not render the Turnstile widget without a site key', () => {
    render(<EmailSignUpPage />)
    expect(screen.queryByTestId('turnstile-widget')).toBeNull()
  })

  it('includes the Turnstile token in the signup request when configured', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key-123')
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true, userConfirmed: false }) })
    render(<EmailSignUpPage />)
    expect(screen.getByTestId('turnstile-widget')).toBeInTheDocument()

    fillAndSubmit('N', 't@e.com', 'S3cure!pass')

    await waitFor(() => expect(executeMock).toHaveBeenCalled())
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string)
    expect(body.turnstileToken).toBe('test-token')
  })

  it('shows a security message when the Turnstile challenge fails', async () => {
    vi.stubEnv('NEXT_PUBLIC_TURNSTILE_SITE_KEY', 'site-key-123')
    executeMock.mockResolvedValue(null)
    render(<EmailSignUpPage />)

    fillAndSubmit('N', 't@e.com', 'S3cure!pass')

    expect(await screen.findByRole('alert')).toHaveTextContent('security check')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('explains a server-side Turnstile verification failure', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false, code: 'verification-failed' }) })
    render(<EmailSignUpPage />)

    fillAndSubmit('N', 't@e.com', 'S3cure!pass')

    expect(await screen.findByRole('alert')).toHaveTextContent('security check')
  })
})
