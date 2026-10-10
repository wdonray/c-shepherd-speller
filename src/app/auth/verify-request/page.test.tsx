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

  it('never locks body scroll or tags the body while mounted', () => {
    const { unmount } = render(<VerifyRequest />)
    expect(document.body.hasAttribute('data-auth-page')).toBe(false)
    expect(document.body.style.overflow).not.toBe('hidden')
    unmount()
    expect(document.body.hasAttribute('data-auth-page')).toBe(false)
  })
})
