import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { signIn } from 'next-auth/react'
import SignIn from './page'

vi.mock('next-auth/react', () => ({ signIn: vi.fn() }))

const signInMock = vi.mocked(signIn)

describe('SignIn page', () => {
  beforeEach(() => {
    signInMock.mockReset()
    document.body.removeAttribute('data-auth-page')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the sign-in card with a Google button', () => {
    render(<SignIn />)
    expect(screen.getByRole('heading', { name: 'Shepherd Speller' })).toBeInTheDocument()
    expect(screen.getByText('A pattern-based spelling toolkit for K-3 teachers.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
    expect(screen.getByText('Free for classrooms.')).toBeInTheDocument()
  })

  it('sets data-auth-page on the body while mounted and removes it on unmount', () => {
    const { unmount } = render(<SignIn />)
    expect(document.body.getAttribute('data-auth-page')).toBe('true')
    unmount()
    expect(document.body.hasAttribute('data-auth-page')).toBe(false)
  })

  it('calls signIn with google and the root callbackUrl, showing a loading state', async () => {
    signInMock.mockImplementation(() => new Promise(() => {}))
    render(<SignIn />)

    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))

    expect(signInMock).toHaveBeenCalledTimes(1)
    expect(signInMock).toHaveBeenCalledWith('google', { callbackUrl: '/' })
    await waitFor(() => {
      expect(screen.getByText('Signing in...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeDisabled()
    })
  })

  it('triggers sign-in from the Enter key', () => {
    signInMock.mockResolvedValue(undefined)
    render(<SignIn />)

    fireEvent.keyDown(screen.getByRole('button', { name: /sign in with google/i }), { key: 'Enter' })

    expect(signInMock).toHaveBeenCalledTimes(1)
  })

  it('does not trigger sign-in from the Enter key while loading', async () => {
    signInMock.mockImplementation(() => new Promise(() => {}))
    render(<SignIn />)
    const button = screen.getByRole('button', { name: /sign in with google/i })

    fireEvent.click(button)
    fireEvent.keyDown(button, { key: 'Enter' })

    expect(signInMock).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(button).toBeDisabled())
  })

  it('logs the error and resets loading when signIn throws', async () => {
    const error = new Error('OAuth boom')
    signInMock.mockRejectedValue(error)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<SignIn />)

    fireEvent.click(screen.getByRole('button', { name: /sign in with google/i }))

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(error)
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sign in with google/i })).not.toBeDisabled()
    })
  })
})
