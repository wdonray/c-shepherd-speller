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

  it('renders the tagline', () => {
    render(<Footer />)
    expect(screen.getByText('PatternSpell. Made for K-3 classrooms.')).toBeInTheDocument()
  })

  it('renders the Privacy link to the public privacy policy', () => {
    render(<Footer />)
    const link = screen.getByRole('link', { name: 'Privacy' })
    expect(link).toHaveAttribute('href', '/privacy')
    expect(link).not.toHaveAttribute('target', '_blank')
  })

  it('renders the Terms link to the public terms of service', () => {
    render(<Footer />)
    const link = screen.getByRole('link', { name: 'Terms' })
    expect(link).toHaveAttribute('href', '/terms')
    expect(link).not.toHaveAttribute('target', '_blank')
  })

  it('renders the Buy me a coffee button opening in a new tab', () => {
    render(<Footer />)
    const link = screen.getByRole('link', { name: 'Buy me a coffee' })
    expect(link).toHaveAttribute('href', 'https://buymeacoffee.com/donrayxwils')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })
})
