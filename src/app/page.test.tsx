import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import LandingPage from './page'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

const useSessionMock = vi.mocked(useSession)

function mockSession(status: 'loading' | 'authenticated' | 'unauthenticated') {
  useSessionMock.mockReturnValue({ data: null, status, update: async () => null } as never)
}

describe('Landing page', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('explains what the product is above the fold', () => {
    mockSession('unauthenticated')
    render(<LandingPage />)
    expect(screen.getByRole('heading', { name: /teach spelling by pattern/i, level: 1 })).toBeVisible()
    expect(screen.getByText(/display them as one clear chart on your projector or smartboard/i)).toBeVisible()
  })

  it('points both hero CTAs at the signup/login flow', () => {
    mockSession('unauthenticated')
    render(<LandingPage />)
    const ctas = screen.getAllByRole('link', { name: /get started free/i })
    expect(ctas.length).toBeGreaterThan(0)
    for (const cta of ctas) {
      expect(cta).toHaveAttribute('href', '/auth/signin')
    }
    const logins = screen.getAllByRole('link', { name: /^log in$/i })
    expect(logins.length).toBeGreaterThan(0)
    for (const login of logins) {
      expect(login).toHaveAttribute('href', '/auth/signin')
    }
  })

  it('shows a labeled sample chart so visitors see the product', () => {
    mockSession('unauthenticated')
    render(<LandingPage />)
    expect(screen.getByLabelText('Sample pattern chart')).toBeVisible()
    expect(screen.getByText(/a sample chart: three spellings of the long a sound/i)).toBeVisible()
    // The sample list renders its patterns.
    expect(screen.getByText('a_e')).toBeVisible()
    expect(screen.getByText('cake')).toBeVisible()
  })

  it('covers how it works, who it is for, and what it is not', () => {
    mockSession('unauthenticated')
    render(<LandingPage />)
    expect(screen.getByRole('heading', { name: /how it works/i })).toBeVisible()
    expect(screen.getByRole('heading', { name: /made for pattern teachers/i })).toBeVisible()
    expect(screen.getByRole('heading', { name: /what patternspell is not/i })).toBeVisible()
    expect(screen.getByText(/not a game site/i)).toBeVisible()
  })

  it('names the curricula it works with', () => {
    mockSession('unauthenticated')
    render(<LandingPage />)
    expect(screen.getByText(/CKLA, Fundations, UFLI, Words Their Way/i)).toBeVisible()
  })

  it('redirects signed-in visitors to the app dashboard', () => {
    mockSession('authenticated')
    render(<LandingPage />)
    expect(mockReplace).toHaveBeenCalledWith('/home')
  })

  it('does not redirect visitors without a session', () => {
    mockSession('unauthenticated')
    render(<LandingPage />)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('uses no em dashes in copy', () => {
    mockSession('unauthenticated')
    const { container } = render(<LandingPage />)
    expect(container.textContent).not.toContain('\u2014')
  })
})
