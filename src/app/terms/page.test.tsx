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
    expect(screen.getByRole('heading', { name: /your responsibilities as an educator/i, level: 2 })).toBeInTheDocument()
    expect(screen.getAllByText(/will not enter student names/i).length).toBeGreaterThan(0)
  })

  it("requires the voice recorder for the teacher's own voice only", () => {
    render(<TermsOfServicePage />)
    expect(screen.getAllByText(/use the voice recorder for your own voice only/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/will not record students/i).length).toBeGreaterThan(0)
  })

  it('caps voice storage at 100 MB in acceptable use', () => {
    render(<TermsOfServicePage />)
    expect(screen.getByRole('heading', { name: /acceptable use/i, level: 2 })).toBeInTheDocument()
    expect(screen.getAllByText(/voice storage is limited to 100 MB per account/i).length).toBeGreaterThan(0)
  })

  it('binds video playback to YouTube Terms of Service', () => {
    render(<TermsOfServicePage />)
    expect(screen.getByRole('heading', { name: /third-party content \(youtube\)/i, level: 2 })).toBeInTheDocument()
    const ytTerms = screen.getByRole('link', { name: /YouTube’s Terms of Service/i })
    expect(ytTerms).toHaveAttribute('href', 'https://www.youtube.com/t/terms')
  })

  it('shows the updated effective date', () => {
    render(<TermsOfServicePage />)
    expect(screen.getAllByText(/october 19, 2026/i).length).toBeGreaterThan(0)
  })

  it('states the teacher owns their content', () => {
    render(<TermsOfServicePage />)
    expect(screen.getByRole('heading', { name: /your content/i, level: 2 })).toBeInTheDocument()
    expect(screen.getAllByText(/belong to you/i).length).toBeGreaterThan(0)
  })

  it('includes limitation of liability and contact', () => {
    render(<TermsOfServicePage />)
    expect(screen.getByRole('heading', { name: /limitation of liability/i, level: 2 })).toBeInTheDocument()
    const contactLinks = screen.getAllByRole('link', { name: 'donrayxwilliams@gmail.com' })
    expect(contactLinks.length).toBeGreaterThan(0)
    expect(contactLinks[0]).toHaveAttribute('href', 'mailto:donrayxwilliams@gmail.com')
  })
})

describe('TermsOfServicePage prebuilt content (issue #463)', () => {
  it('licenses prebuilt lists for classroom use with no curriculum affiliation', () => {
    render(<TermsOfServicePage />)
    expect(screen.getByRole('heading', { name: /ready-made content/i, level: 2 })).toBeInTheDocument()
    expect(screen.getAllByText(/non-exclusive, non-transferable license/i).length).toBeGreaterThan(0)
    expect(
      screen.getAllByText(/not affiliated with, endorsed by, or aligned to any curriculum/i).length
    ).toBeGreaterThan(0)
  })
})
