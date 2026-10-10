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
  it('renders the form and prefills the email from the query string', async () => {
    mockSearchParams.get.mockReturnValue('t@e.com')
    render(<EmailResetPasswordPage />)

    expect(await screen.findByRole('heading', { name: 'Choose a new password' })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toHaveValue('t@e.com')
    expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument()
  })

  it('updates the password and offers the sign-in step', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    render(<EmailResetPasswordPage />)
    await screen.findByRole('button', { name: /update password/i })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 't@e.com' } })

    fillAndSubmit('123456', 'N3w!password')

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/email/reset-password',
        expect.objectContaining({ method: 'POST' })
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
      const { unmount } = render(<EmailResetPasswordPage />)
      await screen.findByRole('button', { name: /update password/i })
      fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 't@e.com' } })

      fillAndSubmit('000000', 'N3w!password')

      expect(await screen.findByRole('alert')).toHaveTextContent(text)
      unmount()
    }
  })

  it('falls back on network failure', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    render(<EmailResetPasswordPage />)
    await screen.findByRole('button', { name: /update password/i })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 't@e.com' } })

    fillAndSubmit('123456', 'N3w!password')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
  })

  it('falls back to a generic message when the failure has no code', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false }) })
    render(<EmailResetPasswordPage />)
    await screen.findByRole('button', { name: /update password/i })
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 't@e.com' } })

    fillAndSubmit('123456', 'N3w!password')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
  })
})
