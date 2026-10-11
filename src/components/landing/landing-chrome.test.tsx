import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LandingHeader } from './LandingHeader'
import { LandingFooter } from './LandingFooter'

describe('LandingHeader', () => {
  it('links the brand to the landing page', () => {
    render(<LandingHeader />)
    expect(screen.getByRole('link', { name: /patternspell home/i })).toHaveAttribute('href', '/')
  })

  it('offers log in and get started actions', () => {
    render(<LandingHeader />)
    expect(screen.getByRole('link', { name: /^log in$/i })).toHaveAttribute('href', '/auth/signin')
    expect(screen.getByRole('link', { name: /get started free/i })).toHaveAttribute('href', '/auth/signin')
  })

  it('links to the page sections', () => {
    render(<LandingHeader />)
    expect(screen.getByRole('link', { name: /how it works/i })).toHaveAttribute('href', '#how-it-works')
    expect(screen.getByRole('link', { name: /who it is for/i })).toHaveAttribute('href', '#who-its-for')
  })
})

describe('LandingFooter', () => {
  it('links the legal pages', () => {
    render(<LandingFooter />)
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: /terms of service/i })).toHaveAttribute('href', '/terms')
  })
})
