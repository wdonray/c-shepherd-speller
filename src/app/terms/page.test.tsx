import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import TermsOfServicePage, { metadata } from './page'

describe('TermsOfServicePage metadata', () => {
  it('has a title and description', () => {
    expect(metadata.title).toBe('Terms of Service')
    expect(metadata.description).toContain('PatternSpell')
  })
})

describe('TermsOfServicePage', () => {
  it('renders the page heading and effective date', () => {
    render(<TermsOfServicePage />)
    expect(screen.getByRole('heading', { name: 'Terms of Service', level: 1 })).toBeInTheDocument()
    expect(screen.getAllByText(/effective date:/i).length).toBeGreaterThan(0)
  })

  it('requires users to be 18+ educators and bars child accounts', () => {
    render(<TermsOfServicePage />)
    expect(screen.getAllByText(/at least 18 years old/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/children may not create accounts/i).length).toBeGreaterThan(0)
  })

  it('states educator responsibilities for classroom use', () => {
    render(<TermsOfServicePage />)
    expect(
      screen.getByRole('heading', { name: /your responsibilities as an educator/i, level: 2 })
    ).toBeInTheDocument()
    expect(screen.getAllByText(/will not enter student names/i).length).toBeGreaterThan(0)
  })

  it('states the teacher owns their content', () => {
    render(<TermsOfServicePage />)
    expect(screen.getByRole('heading', { name: /your content/i, level: 2 })).toBeInTheDocument()
    expect(screen.getAllByText(/belong to you/i).length).toBeGreaterThan(0)
  })

  it('includes limitation of liability and contact', () => {
    render(<TermsOfServicePage />)
    expect(
      screen.getByRole('heading', { name: /limitation of liability/i, level: 2 })
    ).toBeInTheDocument()
    const contactLinks = screen.getAllByRole('link', { name: 'donrayxwilliams@gmail.com' })
    expect(contactLinks.length).toBeGreaterThan(0)
    expect(contactLinks[0]).toHaveAttribute('href', 'mailto:donrayxwilliams@gmail.com')
  })
})
