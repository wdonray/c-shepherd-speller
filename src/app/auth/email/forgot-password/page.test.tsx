import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import EmailForgotPasswordPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: vi.fn() }))

const useSessionMock = vi.mocked(useSession)
const useRouterMock = vi.mocked(useRouter)
const fetchMock = vi.fn()

beforeEach(() => {
  useSessionMock.mockReset()
  useRouterMock.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' } as never)
  useRouterMock.mockReturnValue({ push: vi.fn(), replace: vi.fn() } as never)
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('EmailForgotPasswordPage', () => {
  it('renders the form', () => {
    render(<EmailForgotPasswordPage />)

    expect(screen.getByRole('heading', { name: 'Reset your password' })).toBeInTheDocument()
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to sign in/i })).toHaveAttribute('href', '/auth/email/signin')
  })

  it('sends the code and points at the reset page', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    render(<EmailForgotPasswordPage />)

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 't@e.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset code/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/auth/email/forgot-password',
        expect.objectContaining({ method: 'POST' })
      )
    })
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Reset code sent.')
    expect(screen.getByRole('link', { name: /enter your code/i })).toHaveAttribute(
      'href',
      '/auth/email/reset-password?email=t%40e.com'
    )
  })

  it('shows a generic error when the request fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false, code: 'too-many-attempts' }) })
    render(<EmailForgotPasswordPage />)

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 't@e.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset code/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
  })

  it('shows a generic error on network failure', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    render(<EmailForgotPasswordPage />)

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 't@e.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset code/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.')
  })

  it('disables the form while sending', async () => {
    fetchMock.mockImplementation(() => new Promise(() => {}))
    render(<EmailForgotPasswordPage />)

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 't@e.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset code/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /sending code/i })).toBeDisabled()
    })
  })
})
