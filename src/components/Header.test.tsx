import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { useSession, signOut } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { Header } from './Header'
import { ErrorToaster } from './error-toaster'
import { LISTS_CHANGED_EVENT } from '@/lib/lists-api'
import { processProfileImage } from '@/lib/profile-image'

vi.mock('next-auth/react', () => ({ useSession: vi.fn(), signOut: vi.fn() }))
vi.mock('@/lib/profile-image', () => ({ processProfileImage: vi.fn() }))
vi.mock('next-themes', () => ({ useTheme: vi.fn() }))
vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock('./HelpDialog', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    <div data-testid="help-dialog" data-open={String(isOpen)}>
      {isOpen && <button onClick={onClose}>close help</button>}
    </div>
  ),
}))
vi.mock('./ProfileForm', () => ({
  PROFILE_PHOTO_UPDATED_EVENT: 'patternspell:profile-photo-updated',
}))
vi.mock('./ImportExportDialog', () => ({
  default: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
    <div data-testid="import-export-dialog" data-open={String(isOpen)}>
      {isOpen && <button onClick={onClose}>close import-export</button>}
    </div>
  ),
}))
vi.mock('@/lib/spelling-api', () => ({ getUserByEmail: vi.fn() }))

import { getUserByEmail } from '@/lib/spelling-api'
import { PROFILE_PHOTO_UPDATED_EVENT } from './ProfileForm'
const getUserByEmailMock = vi.mocked(getUserByEmail)

const useSessionMock = vi.mocked(useSession)
const signOutMock = vi.mocked(signOut)
const useThemeMock = vi.mocked(useTheme)

function mockSignedIn(theme = 'light', name: string | null = 'Donray Williams') {
  useSessionMock.mockReturnValue({
    data: { user: { id: 'u1', email: 't@e.c', name } },
    status: 'authenticated',
    update: async () => null,
  } as never)
  useThemeMock.mockReturnValue({ theme, setTheme: vi.fn() } as never)
}

function openMenu() {
  fireEvent.pointerDown(screen.getByRole('button', { name: /open account menu/i }))
}

describe('Header', () => {
  beforeEach(() => {
    useSessionMock.mockReset()
    signOutMock.mockReset()
    useThemeMock.mockReset()
    getUserByEmailMock.mockReset()
    getUserByEmailMock.mockResolvedValue({
      id: 'u1',
      email: 't@e.c',
      name: 'Donray Williams',
      words: [],
      sounds: [],
      spelling: [],
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing without a session user id', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated', update: async () => null } as never)
    useThemeMock.mockReturnValue({ theme: 'light', setTheme: vi.fn() } as never)
    const { container } = render(<Header />)
    expect(container.innerHTML).toBe('')
  })

  it('renders the logo, title, and avatar initials', () => {
    mockSignedIn()
    render(<Header />)

    expect(screen.getByText('PatternSpell')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'PatternSpell logo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open account menu/i })).toHaveTextContent('DW')
  })

  it('links the brand block to the home page', () => {
    mockSignedIn()
    render(<Header />)

    const homeLink = screen.getByRole('link', { name: 'PatternSpell home' })
    expect(homeLink).toHaveAttribute('href', '/home')
    expect(homeLink).toHaveTextContent('PatternSpell')
  })

  it('shows a single initial for a one-word name', () => {
    mockSignedIn('light', 'Donray')
    render(<Header />)
    expect(screen.getByRole('button', { name: /open account menu/i })).toHaveTextContent('D')
  })

  it('falls back to the email initial when there is no name', () => {
    mockSignedIn('light', null)
    render(<Header />)
    expect(screen.getByRole('button', { name: /open account menu/i })).toHaveTextContent('T')
  })

  it('shows a question mark when there is no name or email', () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: 'u1' } },
      status: 'authenticated',
      update: async () => null,
    } as never)
    useThemeMock.mockReturnValue({ theme: 'light', setTheme: vi.fn() } as never)
    render(<Header />)
    expect(screen.getByRole('button', { name: /open account menu/i })).toHaveTextContent('?')
  })

  it('renders nothing when the session has no user object', () => {
    useSessionMock.mockReturnValue({
      data: { user: null },
      status: 'authenticated',
      update: async () => null,
    } as never)
    useThemeMock.mockReturnValue({ theme: 'light', setTheme: vi.fn() } as never)
    const { container } = render(<Header />)
    expect(container.innerHTML).toBe('')
  })

  it('ignores the profile image fetch when unmounted before it resolves', async () => {
    let resolveFetch!: (value: {
      id: string
      email: string
      name: string
      image?: string
      words: string[]
      sounds: string[]
      spelling: string[]
    }) => void
    getUserByEmailMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      })
    )
    mockSignedIn()
    const { unmount } = render(<Header />)
    unmount()
    resolveFetch({
      id: 'u1',
      email: 't@e.c',
      name: 'Donray Williams',
      image: 'data:image/jpeg;base64,x',
      words: [],
      sounds: [],
      spelling: [],
    })
    await new Promise((r) => setTimeout(r, 0))
  })

  it('shows the uploaded profile photo in the avatar', async () => {
    getUserByEmailMock.mockResolvedValue({
      id: 'u1',
      email: 't@e.c',
      name: 'Donray Williams',
      image: 'data:image/jpeg;base64,uploaded',
      words: [],
      sounds: [],
      spelling: [],
    })
    mockSignedIn()
    render(<Header />)
    await waitFor(() => expect(getUserByEmailMock).toHaveBeenCalledWith('t@e.c'))
    const avatar = screen.getByRole('button', { name: /open account menu/i })
    const img = avatar.querySelector('img')
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,uploaded')
    expect(img).toHaveAttribute('alt', '')
    expect(avatar).not.toHaveTextContent('DW')
  })

  it('falls back to initials when the avatar image fails to load', async () => {
    getUserByEmailMock.mockResolvedValue({
      id: 'u1',
      email: 't@e.c',
      name: 'Donray Williams',
      image: 'data:image/jpeg;base64,broken',
      words: [],
      sounds: [],
      spelling: [],
    })
    mockSignedIn()
    render(<Header />)
    await waitFor(() => expect(getUserByEmailMock).toHaveBeenCalledWith('t@e.c'))
    const avatar = screen.getByRole('button', { name: /open account menu/i })
    const img = avatar.querySelector('img')
    expect(img).toBeInTheDocument()
    fireEvent.error(img!)
    await waitFor(() => {
      expect(avatar.querySelector('img')).not.toBeInTheDocument()
    })
    expect(avatar).toHaveTextContent('DW')
  })

  it('falls back to the Google session image when no photo was uploaded', async () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: 'u1', email: 't@e.c', name: 'Donray Williams', image: 'https://google/photo.jpg' } },
      status: 'authenticated',
      update: async () => null,
    } as never)
    useThemeMock.mockReturnValue({ theme: 'light', setTheme: vi.fn() } as never)
    render(<Header />)
    await waitFor(() => expect(getUserByEmailMock).toHaveBeenCalled())
    const img = screen.getByRole('button', { name: /open account menu/i }).querySelector('img')
    expect(img).toHaveAttribute('src', 'https://google/photo.jpg')
  })

  it('refreshes the avatar when the profile photo is updated', async () => {
    mockSignedIn()
    render(<Header />)
    await waitFor(() => expect(getUserByEmailMock).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: /open account menu/i })).toHaveTextContent('DW')

    getUserByEmailMock.mockResolvedValue({
      id: 'u1',
      email: 't@e.c',
      name: 'Donray Williams',
      image: 'data:image/jpeg;base64,new',
      words: [],
      sounds: [],
      spelling: [],
    })
    window.dispatchEvent(new CustomEvent(PROFILE_PHOTO_UPDATED_EVENT))
    await waitFor(() => expect(getUserByEmailMock).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('button', { name: /open account menu/i }).querySelector('img')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,new'
    )
  })

  it('clears the avatar when the event carries an empty image', async () => {
    // Photo removed on the profile page: the event carries an empty image
    // and the avatar falls back to initials.
    getUserByEmailMock.mockResolvedValue({
      id: 'u1',
      email: 't@e.c',
      name: 'Donray Williams',
      image: 'data:image/jpeg;base64,old',
      words: [],
      sounds: [],
      spelling: [],
    })
    mockSignedIn()
    render(<Header />)
    await waitFor(() => expect(getUserByEmailMock).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: /open account menu/i }).querySelector('img')).toHaveAttribute(
      'src',
      'data:image/jpeg;base64,old'
    )

    window.dispatchEvent(new CustomEvent(PROFILE_PHOTO_UPDATED_EVENT, { detail: { image: '' } }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /open account menu/i }).querySelector('img')).not.toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: /open account menu/i })).toHaveTextContent('DW')
  })

  it('updates the avatar from the event payload when the re-fetch returns stale data', async () => {
    // Reproduces the reported bug: after a profile-page upload, the Header
    // re-fetches the user, but the email lookup can return stale data (it
    // queries an eventually-consistent index). The avatar must update from
    // the event payload instead of depending on the re-fetch.
    mockSignedIn()
    render(<Header />)
    await waitFor(() => expect(getUserByEmailMock).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: /open account menu/i })).toHaveTextContent('DW')

    // The re-fetch keeps returning the stale record (no image), simulating index lag.
    window.dispatchEvent(
      new CustomEvent(PROFILE_PHOTO_UPDATED_EVENT, { detail: { image: 'data:image/jpeg;base64,newphoto' } })
    )
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /open account menu/i }).querySelector('img')).toHaveAttribute(
        'src',
        'data:image/jpeg;base64,newphoto'
      )
    )
  })

  it('links to the lists page from My Spelling Lists', () => {
    mockSignedIn()
    render(<Header />)

    expect(screen.getByRole('link', { name: /my spelling lists/i })).toHaveAttribute('href', '/lists')
  })

  it('links to the display mode from the Present button', () => {
    mockSignedIn()
    render(<Header />)

    expect(screen.getByRole('link', { name: /present/i })).toHaveAttribute('href', '/display')
  })

  it('opens the import/export dialog from the menu', () => {
    mockSignedIn()
    render(<Header />)

    openMenu()
    fireEvent.click(screen.getByText('Import / export'))
    expect(screen.getByTestId('import-export-dialog')).toHaveAttribute('data-open', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'close import-export' }))
    expect(screen.getByTestId('import-export-dialog')).toHaveAttribute('data-open', 'false')
  })

  it('toggles the theme from the menu', () => {
    mockSignedIn('light')
    render(<Header />)

    openMenu()
    const setTheme = vi.mocked(useTheme).mock.results[0].value.setTheme
    fireEvent.click(screen.getByText('Theme: Dark'))
    expect(setTheme).toHaveBeenCalledWith('dark')
  })

  it('toggles the theme back when the current theme is dark', () => {
    mockSignedIn('dark')
    render(<Header />)

    openMenu()
    const setTheme = vi.mocked(useTheme).mock.results[0].value.setTheme
    fireEvent.click(screen.getByText('Theme: Light'))
    expect(setTheme).toHaveBeenCalledWith('light')
  })

  it('does not show a migrate old lists item in the menu', () => {
    mockSignedIn()
    render(<Header />)

    openMenu()
    expect(screen.queryByText(/migrate old lists/i)).not.toBeInTheDocument()
  })

  it('opens the help dialog from the menu', () => {
    mockSignedIn()
    render(<Header />)

    openMenu()
    fireEvent.click(screen.getByText('Get help'))
    expect(screen.getByTestId('help-dialog')).toHaveAttribute('data-open', 'true')
  })

  it('links to the profile page from the menu', () => {
    mockSignedIn()
    render(<Header />)

    openMenu()
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', '/profile')
  })

  it('links to version, analytics, and feedback from the menu', () => {
    mockSignedIn()
    render(<Header />)

    openMenu()
    expect(screen.getByRole('menuitem', { name: 'Version' })).toHaveAttribute('href', '/version')
    expect(screen.getByRole('menuitem', { name: 'Analytics' })).toHaveAttribute('href', '/analytics')
    expect(screen.getByRole('menuitem', { name: 'Give feedback' })).toHaveAttribute('href', '/feedback')
  })

  it('opens and closes the help dialog from the menu', () => {
    mockSignedIn()
    render(<Header />)

    openMenu()
    fireEvent.click(screen.getByText('Get help'))
    expect(screen.getByTestId('help-dialog')).toHaveAttribute('data-open', 'true')

    fireEvent.click(screen.getByText('close help'))
    expect(screen.getByTestId('help-dialog')).toHaveAttribute('data-open', 'false')
  })

  it('signs out from the menu', () => {
    mockSignedIn()
    render(<Header />)

    openMenu()
    fireEvent.click(screen.getByText('Sign out'))
    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: '/auth/signin' })
  })

  it('shows a collapsed mobile menu trigger by default', () => {
    mockSignedIn()
    render(<Header />)

    const trigger = screen.getByRole('button', { name: /open menu/i })
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the mobile menu with the header actions', () => {
    mockSignedIn()
    render(<Header />)

    const trigger = screen.getByRole('button', { name: /open menu/i })
    fireEvent.click(trigger)

    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    const menu = within(screen.getByRole('dialog'))
    expect(menu.getByRole('link', { name: /my spelling lists/i })).toHaveAttribute('href', '/lists')
    expect(menu.getByRole('link', { name: /present/i })).toHaveAttribute('href', '/display')
  })

  it('links to the feedback page from the mobile menu', () => {
    mockSignedIn()
    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    const menu = within(screen.getByRole('dialog'))
    expect(menu.getByRole('link', { name: /give feedback/i })).toHaveAttribute('href', '/feedback')
  })

  it('closes the mobile menu with Escape', () => {
    mockSignedIn()
    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /open menu/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes the mobile menu when following the My Spelling Lists link', () => {
    mockSignedIn()
    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    const menu = within(screen.getByRole('dialog'))
    const link = menu.getByRole('link', { name: /my spelling lists/i })
    expect(link).toHaveAttribute('href', '/lists')
    fireEvent.click(link)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes the mobile menu when following the Present link', () => {
    mockSignedIn()
    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    const menu = within(screen.getByRole('dialog'))
    fireEvent.click(menu.getByRole('link', { name: /present/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('shows the profile photo with a camera badge and identity at the top of the menu', () => {
    mockSignedIn()
    render(<Header />)

    openMenu()
    const photoButton = screen.getByRole('button', { name: 'Change profile photo' })
    expect(photoButton).toBeInTheDocument()
    expect(photoButton).toHaveTextContent('DW')
    expect(screen.getByText('Donray Williams')).toBeInTheDocument()
    expect(screen.getByText('t@e.c')).toBeInTheDocument()
  })

  it('shows a fallback name in the menu when the user has no name', () => {
    mockSignedIn('light', null)
    render(<Header />)

    openMenu()
    expect(screen.getByText('Your profile')).toBeInTheDocument()
  })

  it('shows the uploaded photo in the menu photo button', async () => {
    getUserByEmailMock.mockResolvedValue({
      id: 'u1',
      email: 't@e.c',
      name: 'Donray Williams',
      image: 'data:image/jpeg;base64,uploaded',
      words: [],
      sounds: [],
      spelling: [],
    })
    mockSignedIn()
    render(<Header />)

    await waitFor(() => expect(getUserByEmailMock).toHaveBeenCalled())
    openMenu()
    const img = screen.getByRole('button', { name: 'Change profile photo' }).querySelector('img')
    expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,uploaded')
    expect(img).toHaveAttribute('alt', '')
  })

  it('opens the file picker directly from the menu photo button', () => {
    mockSignedIn()
    render(<Header />)

    openMenu()
    const photoButton = screen.getByRole('button', { name: 'Change profile photo' })
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click')
    fireEvent.click(photoButton)
    // The file picker is triggered directly; no profile UI opens.
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
    // The account menu stays open behind the native file picker.
    expect(screen.getByRole('button', { name: 'Change profile photo' })).toBeInTheDocument()
  })

  it('falls back to initials in the menu photo when its image fails to load', async () => {
    getUserByEmailMock.mockResolvedValue({
      id: 'u1',
      email: 't@e.c',
      name: 'Donray Williams',
      image: 'data:image/jpeg;base64,broken',
      words: [],
      sounds: [],
      spelling: [],
    })
    mockSignedIn()
    render(<Header />)

    await waitFor(() => expect(getUserByEmailMock).toHaveBeenCalled())
    openMenu()
    const photoButton = screen.getByRole('button', { name: 'Change profile photo' })
    const img = photoButton.querySelector('img')
    expect(img).toBeInTheDocument()
    fireEvent.error(img!)
    await waitFor(() => {
      expect(photoButton.querySelector('img')).not.toBeInTheDocument()
    })
    expect(photoButton).toHaveTextContent('DW')
  })
  it('uploads the photo directly when a file is selected from the menu', async () => {
    const processMock = vi.mocked(processProfileImage)
    processMock.mockResolvedValue('data:image/jpeg;base64,newphoto')
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    mockSignedIn()
    render(<Header />)

    openMenu()
    const fileInput = screen.getByLabelText('Upload profile photo') as HTMLInputElement
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(processMock).toHaveBeenCalledWith(file)
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/users/'),
        expect.objectContaining({ method: 'PUT' })
      )
    })
    // The menu stays open showing the updated photo, with focus back on the photo button.
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Change profile photo' })).toHaveFocus()
    })
    fetchMock.mockRestore()
  })

  it('uses the app-table user id (not the session id) for the menu photo upload', async () => {
    // Regression test: session.user.id is the next-auth UUID, but the
    // /api/users/[id] ownership check compares against the app-table user id
    // from getUserByEmail. Using the session id always 403s.
    const processMock = vi.mocked(processProfileImage)
    processMock.mockResolvedValue('data:image/jpeg;base64,newphoto')
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    useSessionMock.mockReturnValue({
      data: { user: { id: 'nextauth-uuid-123', email: 't@e.c', name: 'Donray Williams' } },
      status: 'authenticated',
      update: async () => null,
    } as never)
    useThemeMock.mockReturnValue({ theme: 'light', setTheme: vi.fn() } as never)
    getUserByEmailMock.mockResolvedValue({
      id: '1791331096691_abc-user',
      email: 't@e.c',
      name: 'Donray Williams',
      words: [],
      sounds: [],
      spelling: [],
    })
    render(<Header />)

    openMenu()
    const fileInput = screen.getByLabelText('Upload profile photo') as HTMLInputElement
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/users/1791331096691_abc-user',
        expect.objectContaining({ method: 'PUT' })
      )
      expect(fetchMock).not.toHaveBeenCalledWith('/api/users/nextauth-uuid-123', expect.anything())
    })
    fetchMock.mockRestore()
  })

  it('shows an error toast when the app-table user is not found during menu photo upload', async () => {
    const processMock = vi.mocked(processProfileImage)
    processMock.mockResolvedValue('data:image/jpeg;base64,newphoto')
    mockSignedIn()
    getUserByEmailMock.mockResolvedValue(null as never)
    render(
      <>
        <Header />
        <ErrorToaster />
      </>
    )

    const fileInput = screen.getByLabelText('Upload profile photo') as HTMLInputElement
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(await screen.findByText('Could not find your profile. Please try again.')).toBeInTheDocument()
  })

  it('shows the specific error in a toast when the menu photo upload fails', async () => {
    const processMock = vi.mocked(processProfileImage)
    processMock.mockRejectedValue(new Error('Please choose a JPEG, PNG, WebP, or HEIC image.'))
    mockSignedIn()
    render(
      <>
        <Header />
        <ErrorToaster />
      </>
    )

    const fileInput = screen.getByLabelText('Upload profile photo') as HTMLInputElement
    const file = new File(['photo'], 'photo.tiff', { type: 'image/tiff' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(await screen.findByText('Please choose a JPEG, PNG, WebP, or HEIC image.')).toBeInTheDocument()
  })

  it('shows a toast with a generic error when the menu photo upload throws without a message', async () => {
    const processMock = vi.mocked(processProfileImage)
    processMock.mockRejectedValue(new Error(''))
    mockSignedIn()
    render(
      <>
        <Header />
        <ErrorToaster />
      </>
    )

    const fileInput = screen.getByLabelText('Upload profile photo') as HTMLInputElement
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument()
  })

  it('shows a toast with a server error when the menu photo upload response is not ok', async () => {
    const processMock = vi.mocked(processProfileImage)
    processMock.mockResolvedValue('data:image/jpeg;base64,newphoto')
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 500 }))
    mockSignedIn()
    render(
      <>
        <Header />
        <ErrorToaster />
      </>
    )

    const fileInput = screen.getByLabelText('Upload profile photo') as HTMLInputElement
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(await screen.findByText("Something went wrong on our end. We're looking into it.")).toBeInTheDocument()
    fetchMock.mockRestore()
  })

  it('dispatches the photo-updated event with the new image after a menu upload', async () => {
    const processMock = vi.mocked(processProfileImage)
    processMock.mockResolvedValue('data:image/jpeg;base64,newphoto')
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    mockSignedIn()
    render(<Header />)

    const listener = vi.fn()
    window.addEventListener(PROFILE_PHOTO_UPDATED_EVENT, listener)
    try {
      const fileInput = screen.getByLabelText('Upload profile photo') as HTMLInputElement
      const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
      fireEvent.change(fileInput, { target: { files: [file] } })

      await waitFor(() => expect(listener).toHaveBeenCalledTimes(1))
      expect((listener.mock.calls[0][0] as CustomEvent).detail).toEqual({
        image: 'data:image/jpeg;base64,newphoto',
      })
    } finally {
      window.removeEventListener(PROFILE_PHOTO_UPDATED_EVENT, listener)
    }
    fetchMock.mockRestore()
  })

  it('does nothing when no file is selected', () => {
    const processMock = vi.mocked(processProfileImage)
    mockSignedIn()
    render(<Header />)

    const fileInput = screen.getByLabelText('Upload profile photo') as HTMLInputElement
    fireEvent.change(fileInput, { target: { files: [] } })

    expect(processMock).not.toHaveBeenCalled()
  })

  it('hides the avatar account menu trigger on mobile viewports', () => {
    mockSignedIn()
    render(<Header />)

    // One clear menu entry point on mobile: the hamburger. The avatar
    // dropdown trigger stays in the DOM for desktop (md and up).
    const trigger = screen.getByRole('button', { name: /open account menu/i })
    expect(trigger.parentElement).toHaveClass('hidden')
    expect(trigger.parentElement).toHaveClass('md:block')
  })

  it('shows the account header at the top of the mobile menu', () => {
    mockSignedIn()
    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    const menu = within(screen.getByRole('dialog'))
    expect(menu.getByRole('button', { name: 'Change profile photo' })).toBeInTheDocument()
    expect(menu.getByText('Donray Williams')).toBeInTheDocument()
    expect(menu.getByText('t@e.c')).toBeInTheDocument()
  })

  it('groups mobile menu actions into Navigate and Account sections', () => {
    mockSignedIn()
    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    const menu = within(screen.getByRole('dialog'))
    expect(menu.getByText('Navigate')).toBeInTheDocument()
    expect(menu.getByText('Account')).toBeInTheDocument()
    expect(menu.getByRole('link', { name: /my spelling lists/i })).toHaveAttribute('href', '/lists')
    expect(menu.getByRole('link', { name: /present/i })).toHaveAttribute('href', '/display')
    expect(menu.getByRole('link', { name: /profile/i })).toHaveAttribute('href', '/profile')
    expect(menu.getByRole('button', { name: /import \/ export/i })).toBeInTheDocument()
    expect(menu.getByRole('button', { name: /theme:/i })).toBeInTheDocument()
    expect(menu.getByRole('button', { name: /get help/i })).toBeInTheDocument()
    expect(menu.getByRole('link', { name: /version/i })).toHaveAttribute('href', '/version')
    expect(menu.getByRole('link', { name: /analytics/i })).toHaveAttribute('href', '/analytics')
    expect(menu.getByRole('button', { name: /sign out/i })).toBeInTheDocument()
  })

  it('opens the import/export dialog from the mobile menu and closes the sheet', () => {
    mockSignedIn()
    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    const menu = within(screen.getByRole('dialog'))
    fireEvent.click(menu.getByRole('button', { name: /import \/ export/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('import-export-dialog')).toHaveAttribute('data-open', 'true')
  })

  it('toggles the theme from the mobile menu and closes the sheet', () => {
    mockSignedIn('light')
    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    const menu = within(screen.getByRole('dialog'))
    const setTheme = vi.mocked(useTheme).mock.results[0].value.setTheme
    fireEvent.click(menu.getByRole('button', { name: /theme: dark/i }))

    expect(setTheme).toHaveBeenCalledWith('dark')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('toggles the theme back from the mobile menu when the current theme is dark', () => {
    mockSignedIn('dark')
    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    const menu = within(screen.getByRole('dialog'))
    const setTheme = vi.mocked(useTheme).mock.results[0].value.setTheme
    fireEvent.click(menu.getByRole('button', { name: /theme: light/i }))

    expect(setTheme).toHaveBeenCalledWith('light')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens the help dialog from the mobile menu and closes the sheet', () => {
    mockSignedIn()
    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    const menu = within(screen.getByRole('dialog'))
    fireEvent.click(menu.getByRole('button', { name: /get help/i }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByTestId('help-dialog')).toHaveAttribute('data-open', 'true')
  })

  it('signs out from the mobile menu', () => {
    mockSignedIn()
    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    const menu = within(screen.getByRole('dialog'))
    fireEvent.click(menu.getByRole('button', { name: /sign out/i }))

    expect(signOutMock).toHaveBeenCalledTimes(1)
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: '/auth/signin' })
  })

  it('opens the file picker from the mobile menu photo button', () => {
    mockSignedIn()
    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    const menu = within(screen.getByRole('dialog'))
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, 'click')
    fireEvent.click(menu.getByRole('button', { name: 'Change profile photo' }))
    expect(clickSpy).toHaveBeenCalled()
    clickSpy.mockRestore()
    // The sheet stays open behind the native file picker.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('returns focus to the mobile photo button after a mobile menu upload', async () => {
    const processMock = vi.mocked(processProfileImage)
    processMock.mockResolvedValue('data:image/jpeg;base64,newphoto')
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    mockSignedIn()
    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    const menu = within(screen.getByRole('dialog'))
    fireEvent.click(menu.getByRole('button', { name: 'Change profile photo' }))
    const fileInput = screen.getByLabelText('Upload profile photo') as HTMLInputElement
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(menu.getByRole('button', { name: 'Change profile photo' })).toHaveFocus()
    })
    fetchMock.mockRestore()
  })

  it('does not open the desktop account popover after a mobile menu upload', async () => {
    // Regression: the post-upload handler used to re-open the desktop
    // account menu unconditionally, flashing its popover over the phone UI
    // even though the trigger is desktop-only. The mobile sheet has no
    // popover, so nothing may open after a mobile upload.
    const processMock = vi.mocked(processProfileImage)
    processMock.mockResolvedValue('data:image/jpeg;base64,newphoto')
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    mockSignedIn()
    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    const menu = within(screen.getByRole('dialog'))
    fireEvent.click(menu.getByRole('button', { name: 'Change profile photo' }))
    const fileInput = screen.getByLabelText('Upload profile photo') as HTMLInputElement
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(processMock).toHaveBeenCalledWith(file)
    })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    // The bottom sheet stays open showing the updated photo.
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fetchMock.mockRestore()
  })

  it('keeps the desktop account menu open after a desktop photo upload', async () => {
    const processMock = vi.mocked(processProfileImage)
    processMock.mockResolvedValue('data:image/jpeg;base64,newphoto')
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }))
    mockSignedIn()
    render(<Header />)

    openMenu()
    const photoButton = screen.getByRole('button', { name: 'Change profile photo' })
    fireEvent.click(photoButton)
    const fileInput = screen.getByLabelText('Upload profile photo') as HTMLInputElement
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(processMock).toHaveBeenCalledWith(file)
    })
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(photoButton).toHaveFocus()
    fetchMock.mockRestore()
  })

  it('refreshes the stored profile photo when the mobile menu opens', async () => {
    // The mount-time fetch can miss the photo (the email lookup hits an
    // eventually-consistent index), while a later read has it. Opening the
    // sheet must refresh, or the account header shows initials forever.
    getUserByEmailMock.mockResolvedValue({
      id: 'u1',
      email: 't@e.c',
      name: 'Donray Williams',
      words: [],
      sounds: [],
      spelling: [],
    })
    mockSignedIn()
    render(<Header />)
    await waitFor(() => expect(getUserByEmailMock).toHaveBeenCalledTimes(1))

    getUserByEmailMock.mockResolvedValue({
      id: 'u1',
      email: 't@e.c',
      name: 'Donray Williams',
      image: 'data:image/jpeg;base64,storedphoto',
      words: [],
      sounds: [],
      spelling: [],
    })

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    const menu = within(screen.getByRole('dialog'))
    const photoButton = menu.getByRole('button', { name: 'Change profile photo' })
    await waitFor(() => expect(photoButton.querySelector('img')).not.toBeNull())
    expect(photoButton.querySelector('img')).toHaveAttribute('src', 'data:image/jpeg;base64,storedphoto')
    expect(getUserByEmailMock).toHaveBeenCalledTimes(2)
  })

  it('refreshes the stored profile photo when the desktop account menu opens', async () => {
    getUserByEmailMock.mockResolvedValue({
      id: 'u1',
      email: 't@e.c',
      name: 'Donray Williams',
      words: [],
      sounds: [],
      spelling: [],
    })
    mockSignedIn()
    render(<Header />)
    await waitFor(() => expect(getUserByEmailMock).toHaveBeenCalledTimes(1))

    getUserByEmailMock.mockResolvedValue({
      id: 'u1',
      email: 't@e.c',
      name: 'Donray Williams',
      image: 'data:image/jpeg;base64,storedphoto',
      words: [],
      sounds: [],
      spelling: [],
    })

    openMenu()
    const photoButton = screen.getByRole('button', { name: 'Change profile photo' })
    await waitFor(() => expect(photoButton.querySelector('img')).not.toBeNull())
    expect(photoButton.querySelector('img')).toHaveAttribute('src', 'data:image/jpeg;base64,storedphoto')
    expect(getUserByEmailMock).toHaveBeenCalledTimes(2)
  })

  it('does not refetch the profile photo when the menus open without a session email', () => {
    useSessionMock.mockReturnValue({
      data: { user: { id: 'u1' } },
      status: 'authenticated',
      update: async () => null,
    } as never)
    useThemeMock.mockReturnValue({ theme: 'light', setTheme: vi.fn() } as never)
    render(<Header />)

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(getUserByEmailMock).not.toHaveBeenCalled()
  })

  it('keeps initials when the profile photo refresh fails on menu open', async () => {
    getUserByEmailMock.mockRejectedValue(new Error('network down'))
    mockSignedIn()
    const { container } = render(<Header />)
    await waitFor(() => expect(getUserByEmailMock).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    const menu = within(screen.getByRole('dialog'))
    await waitFor(() => expect(getUserByEmailMock).toHaveBeenCalledTimes(2))
    expect(menu.getByRole('button', { name: 'Change profile photo' })).toHaveTextContent('DW')
    expect(container.innerHTML).not.toContain('<img')
  })
})
