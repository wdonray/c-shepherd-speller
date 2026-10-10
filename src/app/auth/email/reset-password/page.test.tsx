import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import EmailResetPasswordPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: vi.fn(), useSearchParams: vi.fn() }))

const useSessionMock = vi.mocked(useSession)
const useRouterMock = vi.mocked(useRouter)
const mockSearchParams = { get: vi.fn() as Mock<(key: string) => string | null> }
const useSearchParamsMock = vi.mocked(useSearchParams)
const fetchMock = vi.fn()

function renderWithEmail(email: string | null) {
  mockSearchParams.get.mockReturnValue(email)
  return render(<EmailResetPasswordPage />)
}

function fillAndSubmit(code: string, newPassword: string) {
  fireEvent.change(screen.getByLabelText(/reset code/i), { target: { value: code } })
  fireEvent.change(screen.getByLabelText(/new password/i), { target: { value: newPassword } })
  fireEvent.click(screen.getByRole('button', { name: /update password/i }))
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

describe('EmailResetPasswordPage', () => {
  it('shows the email as read-only text with a link to use a different one', async () => {
    renderWithEmail('t@e.com')
    await screen.findByRole('heading', { name: 'Choose a new password' })

    expect(screen.getByText(/we sent a reset code to/i)).toBeInTheDocument()
    expect(screen.getByText('t@e.com')).toBeInTheDocument()
    expect(screen.queryByLabelText(/email/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /use a different email/i })).toHaveAttribute(
      'href',
      '/auth/email/forgot-password'
    )
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
  })

  it('prompts to request a code when no email is in the query string', async () => {
    renderWithEmail(null)
    await screen.findByRole('heading', { name: 'Choose a new password' })

    expect(screen.getByRole('alert')).toHaveTextContent('We need an email address')
    expect(screen.getByRole('link', { name: /request a new code/i })).toHaveAttribute(
      'href',
      '/auth/email/forgot-password'
    )
    expect(screen.queryByRole('button', { name: /update password/i })).not.toBeInTheDocument()
  })

  it('updates the password and offers the sign-in step', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    renderWithEmail('t@e.com')
    await screen.findByRole('button', { name: /update password/i })

    fillAndSubmit('123456', 'N3w!password')

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/email/reset-password',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ email: 't@e.com', code: '123456', newPassword: 'N3w!password' }),
        })
      )
    })
    expect(await screen.findByRole('heading', { name: 'Password updated' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /continue to sign in/i })).toHaveAttribute(
      'href',
      '/auth/email/signin?email=t%40e.com'
    )
  })

  it('explains wrong codes, expired codes, and weak passwords', async () => {
    for (const [code, text] of [
      ['invalid-code', 'not right'],
      ['expired-code', 'expired'],
      ['weak-password', 'at least 8 characters'],
    ] as const) {
      fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false, code }) })
      const { unmount } = renderWithEmail('t@e.com')
      await screen.findByRole('button', { name: /update password/i })

      fillAndSubmit('000000', 'N3w!password')

      expect(await screen.findByRole('alert')).toHaveTextContent(text)
      unmount()
    }
  })

  it('falls back on network failure', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    renderWithEmail('t@e.com')
    await screen.findByRole('button', { name: /update password/i })

    fillAndSubmit('123456', 'N3w!password')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
  })

  it('falls back to a generic message when the failure has no code', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false }) })
    renderWithEmail('t@e.com')
    await screen.findByRole('button', { name: /update password/i })

    fillAndSubmit('123456', 'N3w!password')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
  })
})
