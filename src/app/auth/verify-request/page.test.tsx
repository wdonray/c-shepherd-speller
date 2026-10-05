import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import VerifyRequest from './page'

describe('VerifyRequest page', () => {
  it('renders the check-your-email card with a link back to sign in', () => {
    render(<VerifyRequest />)
    expect(screen.getByText('Check Your Email')).toBeInTheDocument()
    expect(screen.getByText(/sign in link to your email address/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /return to sign in/i })
    expect(link).toHaveAttribute('href', '/auth/signin')
  })

  it('sets data-auth-page on the body while mounted and removes it on unmount', () => {
    const { unmount } = render(<VerifyRequest />)
    expect(document.body.getAttribute('data-auth-page')).toBe('true')
    unmount()
    expect(document.body.hasAttribute('data-auth-page')).toBe(false)
  })
})
