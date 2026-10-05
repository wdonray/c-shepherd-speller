import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Footer } from './Footer'

describe('Footer', () => {
  it('renders a footer landmark', () => {
    render(<Footer />)
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })

  it('renders the donray.dev link opening in a new tab', () => {
    render(<Footer />)
    const link = screen.getByRole('link', { name: 'donray.dev' })
    expect(link).toHaveAttribute('href', 'https://www.donray.dev/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders the LinkedIn link opening in a new tab', () => {
    render(<Footer />)
    const link = screen.getByRole('link', { name: 'LinkedIn' })
    expect(link).toHaveAttribute('href', 'https://www.linkedin.com/in/donrayxwilliams/')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders the copyright line', () => {
    render(<Footer />)
    expect(screen.getByText('© 2025 Donray Williams')).toBeInTheDocument()
  })
})
