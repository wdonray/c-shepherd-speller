import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PrivacyPolicyPage, { metadata } from './page'

describe('PrivacyPolicyPage metadata', () => {
  it('has a title and description', () => {
    expect(metadata.title).toBe('Privacy Policy')
    expect(metadata.description).toContain('PatternSpell')
  })
})

describe('PrivacyPolicyPage', () => {
  it('renders the page heading and effective date', () => {
    render(<PrivacyPolicyPage />)
    expect(screen.getByRole('heading', { name: 'Privacy Policy', level: 1 })).toBeInTheDocument()
    expect(screen.getAllByText(/effective date:/i).length).toBeGreaterThan(0)
  })

  it('states the service is for adult educators and not directed at children', () => {
    render(<PrivacyPolicyPage />)
    expect(screen.getAllByText(/adult educators/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/not directed at children/i).length).toBeGreaterThan(0)
  })

  it('discloses analytics practices', () => {
    render(<PrivacyPolicyPage />)
    expect(screen.getAllByText(/salted hash/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/never store raw IP addresses/i).length).toBeGreaterThan(0)
  })

  it('lists third-party subprocessors', () => {
    render(<PrivacyPolicyPage />)
    expect(
      screen.getByRole('heading', { name: /third parties we rely on/i, level: 2 })
    ).toBeInTheDocument()
    expect(screen.getAllByText(/Google:/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Amazon Web Services:/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Sentry:/).length).toBeGreaterThan(0)
  })

  it('includes a children privacy section with a contact path', () => {
    render(<PrivacyPolicyPage />)
    expect(
      screen.getByRole('heading', { name: /children's privacy/i, level: 2 })
    ).toBeInTheDocument()
    const contactLinks = screen.getAllByRole('link', { name: 'donrayxwilliams@gmail.com' })
    expect(contactLinks.length).toBeGreaterThan(0)
    expect(contactLinks[0]).toHaveAttribute('href', 'mailto:donrayxwilliams@gmail.com')
  })

  it('covers user rights and data deletion', () => {
    render(<PrivacyPolicyPage />)
    expect(screen.getByRole('heading', { name: /your rights/i, level: 2 })).toBeInTheDocument()
    expect(screen.getAllByText(/delete your word lists/i).length).toBeGreaterThan(0)
  })
})
