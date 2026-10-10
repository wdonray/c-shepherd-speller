import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import EmailVerifyPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: vi.fn(), useSearchParams: vi.fn() }))

const useSessionMock = vi.mocked(useSession)
const useRouterMock = vi.mocked(useRouter)
const mockSearchParams = { get: vi.fn() as Mock<(key: string) => string | null> }
const useSearchParamsMock = vi.mocked(useSearchParams)
const fetchMock = vi.fn()

function renderWithEmail(email: string | null) {
  mockSearchParams.get.mockReturnValue(email)
  return render(<EmailVerifyPage />)
}

function fillCodeAndSubmit(code: string) {
  fireEvent.change(screen.getByLabelText(/verification code/i), { target: { value: code } })
  fireEvent.click(screen.getByRole('button', { name: /verify email/i }))
}

beforeEach(() => {
  useSessionMock.mockReset()
  useRouterMock.mockReset()
  useSearchParamsMock.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' } as never)
  useRouterMock.mockReturnValue({ push: vi.fn(), replace: vi.fn() } as never)
  useSearchParamsMock.mockReturnValue(mockSearchParams as never)
  mockSearchParams.get.mockReturnValue(null)
  document.body.removeAttribute('data-auth-page')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('EmailVerifyPage', () => {
  it('shows the email as read-only text with a link to use a different one', async () => {
    renderWithEmail('t@e.com')
    await screen.findByRole('heading', { name: 'Check your email' })

    expect(screen.getByText(/we sent a code to/i)).toBeInTheDocument()
    expect(screen.getByText('t@e.com')).toBeInTheDocument()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /use a different email/i })).toHaveAttribute('href', '/auth/email/signup')
  })

  it('prompts to create an account when no email is in the query string', async () => {
    renderWithEmail(null)
    await screen.findByRole('heading', { name: 'Check your email' })

    expect(screen.getByRole('alert')).toHaveTextContent('We need an email address')
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute('href', '/auth/email/signup')
    expect(screen.queryByRole('button', { name: /verify email/i })).not.toBeInTheDocument()
  })

  it('verifies the code and offers the sign-in step', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    renderWithEmail('t@e.com')
    await screen.findByRole('button', { name: /verify email/i })

    fillCodeAndSubmit('123456')

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/email/verify',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 't@e.com', code: '123456' }),
        })
      )
    })
    expect(await screen.findByRole('heading', { name: 'You are verified' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /continue to sign in/i })).toHaveAttribute(
      'href',
      '/auth/email/signin?email=t%40e.com'
    )
  })

  it('explains wrong and expired codes', async () => {
    for (const [code, text] of [
      ['invalid-code', 'not right'],
      ['expired-code', 'expired'],
    ] as const) {
      fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false, code }) })
      const { unmount } = renderWithEmail('t@e.com')
      await screen.findByRole('button', { name: /verify email/i })

      fillCodeAndSubmit('000000')

      expect(await screen.findByRole('alert')).toHaveTextContent(text)
      unmount()
    }
  })

  it('falls back to a generic message when the failure has no code', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false }) })
    renderWithEmail('t@e.com')
    await screen.findByRole('button', { name: /verify email/i })

    fillCodeAndSubmit('000000')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
  })

  it('resends the code to the read-only email and confirms it', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    renderWithEmail('t@e.com')
    await screen.findByRole('button', { name: /verify email/i })

    fireEvent.click(screen.getByRole('button', { name: /send a new one/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/email/verify/resend',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 't@e.com' }),
        })
      )
    })
    expect(await screen.findByRole('status')).toHaveTextContent('New code sent.')
  })

  it('shows resend failures', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false, code: 'too-many-attempts' }) })
    renderWithEmail('t@e.com')
    await screen.findByRole('button', { name: /verify email/i })

    fireEvent.click(screen.getByRole('button', { name: /send a new one/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Too many attempts.')
  })

  it('falls back to a generic message when resend fails without a code', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false }) })
    renderWithEmail('t@e.com')
    await screen.findByRole('button', { name: /verify email/i })

    fireEvent.click(screen.getByRole('button', { name: /send a new one/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
  })

  it('falls back on network failures for both actions', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    renderWithEmail('t@e.com')
    await screen.findByRole('button', { name: /verify email/i })

    fillCodeAndSubmit('123456')
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')

    fireEvent.click(screen.getByRole('button', { name: /send a new one/i }))
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    })
  })
})
