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
    expect(screen.getByRole('heading', { name: /third parties we rely on/i, level: 2 })).toBeInTheDocument()
    expect(screen.getAllByText(/Google:/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Amazon Web Services:/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Sentry:/).length).toBeGreaterThan(0)
  })

  it('includes a children privacy section with a contact path', () => {
    render(<PrivacyPolicyPage />)
    expect(screen.getByRole('heading', { name: /children's privacy/i, level: 2 })).toBeInTheDocument()
    const contactLinks = screen.getAllByRole('link', { name: 'donrayxwilliams@gmail.com' })
    expect(contactLinks.length).toBeGreaterThan(0)
    expect(contactLinks[0]).toHaveAttribute('href', 'mailto:donrayxwilliams@gmail.com')
  })

  it('covers user rights and data deletion', () => {
    render(<PrivacyPolicyPage />)
    expect(screen.getByRole('heading', { name: /your rights/i, level: 2 })).toBeInTheDocument()
    expect(screen.getAllByText(/delete your word lists/i).length).toBeGreaterThan(0)
  })

  it('discloses voice recording collection with no voiceprint analysis', () => {
    render(<PrivacyPolicyPage />)
    expect(screen.getAllByText(/voice recordings\./i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/available on all your devices/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/do not analyze your voice, build a voiceprint/i).length).toBeGreaterThan(0)
  })

  it('has a voice recordings section covering teacher-only use and deletion', () => {
    render(<PrivacyPolicyPage />)
    expect(screen.getByRole('heading', { name: /voice recordings/i, level: 2 })).toBeInTheDocument()
    expect(screen.getAllByText(/record only your own voice/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/do not record children/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/removes it from your devices and from our servers/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/delete your recordings along with the rest of your data/i).length).toBeGreaterThan(0)
  })

  it('states voice recording retention and rights', () => {
    render(<PrivacyPolicyPage />)
    expect(screen.getAllByText(/voice recordings are kept for as long as your account exists/i).length).toBeGreaterThan(
      0
    )
    expect(screen.getAllByText(/delete your voice recordings, individually/i).length).toBeGreaterThan(0)
  })

  it('names S3 as the voice recording store in the AWS bullet', () => {
    render(<PrivacyPolicyPage />)
    expect(screen.getAllByText(/your voice recordings \(S3\)/i).length).toBeGreaterThan(0)
  })

  it('shows the updated effective date', () => {
    render(<PrivacyPolicyPage />)
    expect(screen.getAllByText(/october 16, 2026/i).length).toBeGreaterThan(0)
  })
})
