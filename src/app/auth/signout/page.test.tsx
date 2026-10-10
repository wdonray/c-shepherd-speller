import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { signOut } from 'next-auth/react'
import SignOut from './page'

const { pushMock, backMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  backMock: vi.fn(),
}))

vi.mock('next-auth/react', () => ({ signOut: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock, back: backMock }) }))

const signOutMock = vi.mocked(signOut)

describe('SignOut page', () => {
  beforeEach(() => {
    signOutMock.mockReset()
    pushMock.mockReset()
    backMock.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders the sign-out confirmation card', () => {
    render(<SignOut />)
    expect(screen.getByText('Sign Out', { selector: '[data-slot="card-title"]' })).toBeInTheDocument()
    expect(screen.getByText('Are you sure you want to sign out?')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /confirm sign out/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel sign out/i })).toBeInTheDocument()
  })

  it('never locks body scroll or tags the body while mounted', () => {
    const { unmount } = render(<SignOut />)
    expect(document.body.hasAttribute('data-auth-page')).toBe(false)
    expect(document.body.style.overflow).not.toBe('hidden')
    unmount()
    expect(document.body.hasAttribute('data-auth-page')).toBe(false)
  })

  it('signs out without redirect and routes home, showing a loading state', async () => {
    signOutMock.mockResolvedValue(undefined)
    render(<SignOut />)

    fireEvent.click(screen.getByRole('button', { name: /confirm sign out/i }))

    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(signOutMock).toHaveBeenCalledWith({ redirect: false })
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledTimes(1)
      expect(pushMock).toHaveBeenCalledWith('/')
      expect(screen.getByText('Signing out...')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /confirm sign out/i })).toBeDisabled()
    })
  })

  it('triggers sign-out from the Enter key', () => {
    signOutMock.mockResolvedValue(undefined)
    render(<SignOut />)

    fireEvent.keyDown(screen.getByRole('button', { name: /confirm sign out/i }), { key: 'Enter' })

    expect(signOutMock).toHaveBeenCalledTimes(1)
  })

  it('does not trigger sign-out from the Enter key while signing out', async () => {
    signOutMock.mockImplementation(() => new Promise(() => {}))
    render(<SignOut />)
    const button = screen.getByRole('button', { name: /confirm sign out/i })

    fireEvent.click(button)
    fireEvent.keyDown(button, { key: 'Enter' })

    expect(signOutMock).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(button).toBeDisabled())
  })

  it('logs the error and resets loading when signOut throws', async () => {
    const error = new Error('sign-out boom')
    signOutMock.mockRejectedValue(error)
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<SignOut />)

    fireEvent.click(screen.getByRole('button', { name: /confirm sign out/i }))

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(error)
      expect(pushMock).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: /confirm sign out/i })).not.toBeDisabled()
    })
  })

  it('navigates back when Cancel is clicked', () => {
    render(<SignOut />)

    fireEvent.click(screen.getByRole('button', { name: /cancel sign out/i }))

    expect(backMock).toHaveBeenCalledTimes(1)
    expect(signOutMock).not.toHaveBeenCalled()
  })
})
