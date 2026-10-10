import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { EmailAuthCard } from './email-auth-card'
import { AuthFeedback } from './auth-feedback'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: vi.fn() }))

const useSessionMock = vi.mocked(useSession)
const useRouterMock = vi.mocked(useRouter)
const replaceMock = vi.fn()

beforeEach(() => {
  useSessionMock.mockReset()
  useRouterMock.mockReset()
  replaceMock.mockReset()
  useRouterMock.mockReturnValue({ replace: replaceMock } as never)
})

describe('EmailAuthCard', () => {
  it('renders the title, subtitle, and children for signed-out visitors', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' } as never)
    render(
      <EmailAuthCard title="Welcome back" subtitle="Sign in to continue.">
        <button>child</button>
      </EmailAuthCard>
    )

    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument()
    expect(screen.getByText('Sign in to continue.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'child' })).toBeInTheDocument()
  })

  it('renders without a subtitle', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' } as never)
    render(<EmailAuthCard title="Title only">x</EmailAuthCard>)

    expect(screen.getByRole('heading', { name: 'Title only' })).toBeInTheDocument()
  })

  it('never locks body scroll or tags the body while mounted', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' } as never)
    const { unmount } = render(<EmailAuthCard title="T">x</EmailAuthCard>)

    expect(document.body.hasAttribute('data-auth-page')).toBe(false)
    expect(document.body.style.overflow).not.toBe('hidden')
    unmount()
    expect(document.body.hasAttribute('data-auth-page')).toBe(false)
  })

  it('uses the mobile-first layout: top-aligned with safe-area bottom padding', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' } as never)
    const { container } = render(<EmailAuthCard title="T">x</EmailAuthCard>)

    const wrapper = container.firstElementChild
    expect(wrapper?.className).toContain('pt-10')
    expect(wrapper?.className).not.toContain('pt-32')
    expect(wrapper?.className).toContain('env(safe-area-inset-bottom)')
  })

  it('redirects signed-in visitors to the homepage instead of rendering', async () => {
    useSessionMock.mockReturnValue({ data: { user: { id: 'u1' } }, status: 'authenticated' } as never)
    render(<EmailAuthCard title="T">x</EmailAuthCard>)

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/'))
    expect(screen.queryByRole('heading', { name: 'T' })).not.toBeInTheDocument()
  })

  it('shows a loading indicator while the session resolves', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'loading' } as never)
    render(<EmailAuthCard title="T">x</EmailAuthCard>)

    expect(screen.getByRole('status', { name: 'Checking sign-in status' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'T' })).not.toBeInTheDocument()
  })

  it('does not redirect while the session is loading', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'loading' } as never)
    render(<EmailAuthCard title="T">x</EmailAuthCard>)

    expect(replaceMock).not.toHaveBeenCalled()
  })
})

describe('AuthFeedback', () => {
  it('renders an error with role alert', () => {
    render(<AuthFeedback tone="error">Something failed.</AuthFeedback>)

    const feedback = screen.getByRole('alert')
    expect(feedback).toHaveTextContent('Something failed.')
  })

  it('renders a success note with role status', () => {
    render(
      <AuthFeedback tone="success">
        Done. <a href="/x">Next</a>
      </AuthFeedback>
    )

    const feedback = screen.getByRole('status')
    expect(feedback).toHaveTextContent('Done.')
    expect(screen.getByRole('link', { name: 'Next' })).toBeInTheDocument()
  })
})
