import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { useSession, signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { Header } from './Header'

vi.mock('next-auth/react', () => ({ useSession: vi.fn(), signOut: vi.fn() }))
vi.mock('next-themes', () => ({ useTheme: vi.fn() }))
vi.mock('./SpellingManagerSheet', () => ({
  default: ({ isOpen }: { isOpen: boolean }) => <div data-testid="spelling-sheet" data-open={String(isOpen)} />,
}))
vi.mock('./HelpDialog', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    <div data-testid="help-dialog" data-open={String(isOpen)}>
      {isOpen && <button onClick={onClose}>close help</button>}
    </div>
  ),
}))
vi.mock('./ProfileDialog', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    <div data-testid="profile-dialog" data-open={String(isOpen)}>
      {isOpen && <button onClick={onClose}>close profile</button>}
    </div>
  ),
}))

const useSessionMock = vi.mocked(useSession)
const signOutMock = vi.mocked(signOut)
const useThemeMock = vi.mocked(useTheme)

function mockSignedIn(theme = 'light') {
  useSessionMock.mockReturnValue({
    data: { user: { id: 'u1', email: 't@e.c' } },
    status: 'authenticated',
    update: async () => null,
  } as never)
  useThemeMock.mockReturnValue({ theme, setTheme: vi.fn() } as never)
}

function openMenu() {
  fireEvent.pointerDown(screen.getByRole('button', { name: /menu/i }))
}

describe('Header', () => {
  beforeEach(() => {
    useSessionMock.mockReset()
    signOutMock.mockReset()
    useThemeMock.mockReset()
  })

  it('renders nothing without a session user id', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated', update: async () => null } as never)
    useThemeMock.mockReturnValue({ theme: 'light', setTheme: vi.fn() } as never)
    const { container } = render(<Header />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the title and opens the spelling sheet', () => {
    mockSignedIn()
    render(<Header />)

    expect(screen.getByText('Shepherd Speller')).toBeInTheDocument()
    expect(screen.getByTestId('spelling-sheet')).toHaveAttribute('data-open', 'false')

    fireEvent.click(screen.getByRole('button', { name: /my spelling lists/i }))
    expect(screen.getByTestId('spelling-sheet')).toHaveAttribute('data-open', 'true')
  })

  it('toggles the theme from the menu', () => {
    mockSignedIn('light')
    render(<Header />)

    openMenu()
    const setTheme = vi.mocked(useTheme).mock.results[0].value.setTheme
    fireEvent.click(screen.getByText('Dark'))
    expect(setTheme).toHaveBeenCalledWith('dark')
  })

  it('toggles the theme back when the current theme is dark', () => {
    mockSignedIn('dark')
    render(<Header />)

    openMenu()
    const setTheme = vi.mocked(useTheme).mock.results[0].value.setTheme
    fireEvent.click(screen.getByText('Light'))
    expect(setTheme).toHaveBeenCalledWith('light')
  })

  it('opens the help dialog from the menu', () => {
    mockSignedIn()
    render(<Header />)

    openMenu()
    fireEvent.click(screen.getByText('Get Help'))
    expect(screen.getByTestId('help-dialog')).toHaveAttribute('data-open', 'true')
  })

  it('opens the profile dialog from the menu', () => {
    mockSignedIn()
    render(<Header />)

    openMenu()
    fireEvent.click(screen.getByText('Profile'))
    expect(screen.getByTestId('profile-dialog')).toHaveAttribute('data-open', 'true')
  })

  it('signs out from the menu', () => {
    mockSignedIn()
    render(<Header />)

    openMenu()
    fireEvent.click(screen.getByText('Sign Out'))
    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: '/auth/signin' })
  })

  it('closes the help dialog via its onClose', () => {
    mockSignedIn()
    render(<Header />)

    openMenu()
    fireEvent.click(screen.getByText('Get Help'))
    expect(screen.getByTestId('help-dialog')).toHaveAttribute('data-open', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'close help' }))
    expect(screen.getByTestId('help-dialog')).toHaveAttribute('data-open', 'false')
  })

  it('closes the profile dialog via its onClose', () => {
    mockSignedIn()
    render(<Header />)

    openMenu()
    fireEvent.click(screen.getByText('Profile'))
    expect(screen.getByTestId('profile-dialog')).toHaveAttribute('data-open', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'close profile' }))
    expect(screen.getByTestId('profile-dialog')).toHaveAttribute('data-open', 'false')
  })
})
