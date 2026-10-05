import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useSearchParams } from 'next/navigation'
import AuthError from './page'

vi.mock('next/navigation', () => ({ useSearchParams: vi.fn() }))

const useSearchParamsMock = vi.mocked(useSearchParams)

function mockErrorCode(code: string | null) {
  useSearchParamsMock.mockReturnValue({
    get: (key: string) => (key === 'error' ? code : null),
  } as unknown as ReturnType<typeof useSearchParams>)
}

describe('AuthError page', () => {
  beforeEach(() => {
    useSearchParamsMock.mockReset()
  })

  it('shows the service-unavailable message for the Configuration code', () => {
    mockErrorCode('Configuration')
    render(<AuthError />)
    expect(screen.getByText('Service Temporarily Unavailable')).toBeInTheDocument()
    expect(screen.getByText(/technical difficulties with our authentication service/i)).toBeInTheDocument()
  })

  it('shows the restricted message for the AccessDenied code', () => {
    mockErrorCode('AccessDenied')
    render(<AuthError />)
    expect(screen.getByText('Access Restricted')).toBeInTheDocument()
    expect(screen.getByText(/doesn't have permission/i)).toBeInTheDocument()
  })

  it('shows the interrupted message for the OAuthCallback code', () => {
    mockErrorCode('OAuthCallback')
    render(<AuthError />)
    expect(screen.getByText('Sign-in Interrupted')).toBeInTheDocument()
    expect(screen.getByText(/couldn't be completed/i)).toBeInTheDocument()
  })

  it('falls back to the default message when the code is missing', () => {
    mockErrorCode(null)
    render(<AuthError />)
    expect(screen.getByText('Something Went Wrong')).toBeInTheDocument()
    expect(screen.getByText(/unexpected error while processing your sign-in request/i)).toBeInTheDocument()
  })

  it('throws for an unrecognized error code', () => {
    mockErrorCode('SomethingElse')
    expect(() => render(<AuthError />)).toThrow(TypeError)
  })

  it('renders Try Again and Go Home links', () => {
    mockErrorCode(null)
    render(<AuthError />)
    expect(screen.getByRole('link', { name: /try signing in again/i })).toHaveAttribute('href', '/auth/signin')
    expect(screen.getByRole('link', { name: /go to home page/i })).toHaveAttribute('href', '/')
  })
})
