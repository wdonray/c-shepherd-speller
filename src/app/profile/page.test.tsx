import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import ProfilePage from './page'

vi.mock('@/components/ProfileForm', () => ({
  default: () => <div data-testid="profile-form" />,
}))

vi.mock('@/components/DeleteAccountSection', () => ({
  default: () => <div data-testid="delete-account-section" />,
}))
vi.mock('@/components/HiddenVideosSection', () => ({
  default: () => <div data-testid="hidden-videos-section" />,
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

  it('links the back breadcrumb to home with the destination name', () => {
    render(<ProfilePage />)

    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/home')
  })

  it('renders the delete account section', () => {
    render(<ProfilePage />)

    expect(screen.getByTestId('delete-account-section')).toBeInTheDocument()
  })

  it('renders the hidden videos section', () => {
    render(<ProfilePage />)

    expect(screen.getByTestId('hidden-videos-section')).toBeInTheDocument()
  })

  it('does not render a sign out button', () => {
    render(<ProfilePage />)

    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
  })
})
