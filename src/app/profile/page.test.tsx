import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProfilePage from './page'

vi.mock('@/components/ProfileForm', () => ({
  default: () => <div data-testid="profile-form" />,
}))

describe('ProfilePage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the profile heading and the profile form', () => {
    render(<ProfilePage />)

    expect(screen.getByRole('heading', { name: 'Profile', level: 1 })).toBeInTheDocument()
    expect(screen.getByTestId('profile-form')).toBeInTheDocument()
  })

  it('links back to home', () => {
    render(<ProfilePage />)

    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/')
  })

  it('does not render a sign out button', () => {
    render(<ProfilePage />)

    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
  })
})
