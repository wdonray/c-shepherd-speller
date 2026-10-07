import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import ProfileDialog, { PROFILE_PHOTO_UPDATED_EVENT } from './ProfileDialog'
import { processProfileImage } from '@/lib/profile-image'

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }))
vi.mock('next-auth/react', () => ({ useSession: vi.fn(), signOut: signOutMock }))
vi.mock('@/lib/profile-image', () => ({ processProfileImage: vi.fn() }))

const processProfileImageMock = vi.mocked(processProfileImage)

const useSessionMock = vi.mocked(useSession)

const user = {
  id: 'u1',
  email: 't@e.c',
  name: 'Donray Williams',
  preferredName: 'Donray',
  gradeLevel: '3rd Grade',
  subject: 'ELA',
  schoolName: 'Main Street School',
  classroomSize: 25,
  words: [],
  sounds: [],
  spelling: [],
}

function mockSession() {
  useSessionMock.mockReturnValue({
    data: { user: { email: 't@e.c', name: 'Donray' } },
    status: 'authenticated',
    update: async () => null,
  } as never)
}

function stubFetch(handler: (url: string, init?: RequestInit) => Promise<unknown>) {
  const fetchMock = vi.fn(handler)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function renderDialog() {
  mockSession()
  return render(<ProfileDialog isOpen onClose={vi.fn()} />)
}

describe('ProfileDialog', () => {
  beforeEach(() => {
    useSessionMock.mockReset()
    processProfileImageMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders nothing when closed', () => {
    mockSession()
    stubFetch(async () => ({ ok: true, json: async () => ({ user }) }))
    render(<ProfileDialog isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByText('Teacher Profile')).not.toBeInTheDocument()
  })

  it('shows the identity header with name, email, and sign-in method', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ user }) }))
    renderDialog()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Donray Williams' })).toBeInTheDocument()
    })
    expect(screen.getByText('t@e.c')).toBeInTheDocument()
    expect(screen.getByText('Signed in with Google')).toBeInTheDocument()
  })

  it('falls back to a question mark when there is no name or email', async () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated', update: async () => null } as never)
    stubFetch(async () => ({ ok: true, json: async () => ({ user: null }) }))
    render(<ProfileDialog isOpen onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Your profile' })).toBeInTheDocument()
    })
    expect(document.querySelector('button.rounded-full')?.textContent).toBe('?')
  })

  it('uses the email initial when there is no name', async () => {
    useSessionMock.mockReturnValue({
      data: { user: { email: 't@e.c' } },
      status: 'authenticated',
      update: async () => null,
    } as never)
    stubFetch(async () => ({ ok: true, json: async () => ({ user: null }) }))
    render(<ProfileDialog isOpen onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Your profile' })).toBeInTheDocument()
    })
    expect(document.querySelector('button.rounded-full')?.textContent).toBe('T')
  })

  it('signs out when the Sign out button is clicked', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ user }) }))
    renderDialog()

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: '/auth/signin' })
  })

  it('populates the form fields from the fetched user', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ user }) }))
    renderDialog()

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).not.toBeDisabled()
    })
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Donray Williams')
    expect(screen.getByLabelText(/preferred name/i)).toHaveValue('Donray')
    expect(screen.getByLabelText(/grade level/i)).toHaveValue('3rd Grade')
    expect(screen.getByLabelText(/subject\/area/i)).toHaveValue('ELA')
    expect(screen.getByLabelText(/school name/i)).toHaveValue('Main Street School')
    expect(screen.getByLabelText(/typical class size/i)).toHaveValue(25)
    expect(screen.getByLabelText(/email address/i)).toHaveValue('t@e.c')
  })

  it('saves changed fields with a PUT and shows a success message', async () => {
    const fetchMock = stubFetch(async (url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? { ok: true, json: async () => ({}) } : { ok: true, json: async () => ({ user }) }
    )
    renderDialog()

    const nameInput = await screen.findByLabelText(/full name/i)
    await waitFor(() => expect(nameInput).not.toBeDisabled())
    fireEvent.change(nameInput, { target: { value: 'Donray W.' } })
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/users/u1', expect.objectContaining({ method: 'PUT' }))
    })
    const putCall = fetchMock.mock.calls.find((call) => call[1]?.method === 'PUT')
    const body = JSON.parse(putCall?.[1]?.body as string)
    expect(body.name).toBe('Donray W.')
    expect(body.preferredName).toBe('Donray')
    expect(body.gradeLevel).toBe('3rd Grade')
    expect(body.classroomSize).toBe(25)
    expect(await screen.findByText('Profile updated successfully!')).toBeInTheDocument()
  })

  it('logs an error when saving fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch(async (url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? { ok: false } : { ok: true, json: async () => ({ user }) }
    )
    renderDialog()

    const nameInput = await screen.findByLabelText(/full name/i)
    await waitFor(() => expect(nameInput).not.toBeDisabled())
    fireEvent.change(nameInput, { target: { value: 'Donray W.' } })
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error updating user:', expect.any(Error))
    })
    expect(screen.queryByText('Profile updated successfully!')).not.toBeInTheDocument()
  })

  it('logs an error when fetching the user fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch(async () => {
      throw new Error('network down')
    })
    renderDialog()

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching user:', expect.any(Error))
    })
  })

  it('calls onClose when Cancel is clicked', async () => {
    const onClose = vi.fn()
    mockSession()
    stubFetch(async () => ({ ok: true, json: async () => ({ user }) }))
    render(<ProfileDialog isOpen onClose={onClose} />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('saves every editable field when all are changed', async () => {
    const fetchMock = stubFetch(async (url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? { ok: true, json: async () => ({}) } : { ok: true, json: async () => ({ user }) }
    )
    renderDialog()

    await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Donray W.' } })
    fireEvent.change(screen.getByLabelText(/preferred name/i), { target: { value: 'Don' } })
    fireEvent.change(screen.getByLabelText(/grade level/i), { target: { value: '4th Grade' } })
    fireEvent.change(screen.getByLabelText(/subject\/area/i), { target: { value: 'Math' } })
    fireEvent.change(screen.getByLabelText(/school name/i), { target: { value: 'Elm School' } })
    fireEvent.change(screen.getByLabelText(/typical class size/i), { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/users/u1', expect.objectContaining({ method: 'PUT' }))
    })
    const putCall = fetchMock.mock.calls.find((call) => call[1]?.method === 'PUT')
    const body = JSON.parse(putCall?.[1]?.body as string)
    expect(body).toEqual({
      name: 'Donray W.',
      preferredName: 'Don',
      gradeLevel: '4th Grade',
      subject: 'Math',
      schoolName: 'Elm School',
      classroomSize: 30,
    })
  })

  it('stops loading when the session has no email', async () => {
    useSessionMock.mockReturnValue({
      data: { user: { name: 'Donray' } },
      status: 'authenticated',
      update: async () => null,
    } as never)
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => ({ user }) }))
    render(<ProfileDialog isOpen onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).not.toBeDisabled()
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('handles a missing user record gracefully', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ user: null }) }))
    renderDialog()

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).not.toBeDisabled()
    })
    expect(screen.getByLabelText(/full name/i)).toHaveValue('')
  })

  it('defaults missing optional fields to empty strings', async () => {
    const sparseUser = { id: 'u1', email: 't@e.c' }
    stubFetch(async () => ({ ok: true, json: async () => ({ user: sparseUser }) }))
    renderDialog()

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).not.toBeDisabled()
    })
    expect(screen.getByLabelText(/full name/i)).toHaveValue('')
    expect(screen.getByLabelText(/preferred name/i)).toHaveValue('')
    expect(screen.getByLabelText(/grade level/i)).toHaveValue('')
    expect(screen.getByLabelText(/subject\/area/i)).toHaveValue('')
    expect(screen.getByLabelText(/school name/i)).toHaveValue('')
    expect(screen.getByLabelText(/typical class size/i)).toHaveValue(null)
  })

  it('omits empty fields from the save payload', async () => {
    const fetchMock = stubFetch(async (url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? { ok: true, json: async () => ({}) } : { ok: true, json: async () => ({ user }) }
    )
    renderDialog()

    await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/preferred name/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/grade level/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/subject\/area/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/school name/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/typical class size/i), { target: { value: '' } })
    // Submit the form directly to bypass HTML5 required-field validation.
    // The dialog renders in a portal, so query the document.
    fireEvent.submit(document.querySelector('form') as HTMLFormElement)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/users/u1', expect.objectContaining({ method: 'PUT' }))
    })
    const putCall = fetchMock.mock.calls.find((call) => call[1]?.method === 'PUT')
    const body = JSON.parse(putCall?.[1]?.body as string)
    expect(body).toEqual({})
  })

  it('does not save when there is no user record', async () => {
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => ({ user: null }) }))
    renderDialog()

    await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())
    // Submit directly to bypass HTML5 required-field validation.
    fireEvent.submit(document.querySelector('form') as HTMLFormElement)

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).not.toBeDisabled()
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows a saving indicator while the save is in flight', async () => {
    let resolvePut: (value: unknown) => void = () => {}
    stubFetch(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return new Promise((resolve) => {
          resolvePut = resolve
        })
      }
      return { ok: true, json: async () => ({ user }) }
    })
    renderDialog()

    await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

    expect(await screen.findByRole('button', { name: /saving/i })).toBeInTheDocument()
    resolvePut({ ok: true, json: async () => ({}) })
    expect(await screen.findByText('Profile updated successfully!')).toBeInTheDocument()
  })

  it('schedules hiding the success message after two seconds', async () => {
    const realSetTimeout = global.setTimeout
    const callbacks: (() => void)[] = []
    const setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(((fn: () => void, ms?: number) => {
      if (ms === 2000) {
        callbacks.push(fn)
        return 0 as unknown as NodeJS.Timeout
      }
      return realSetTimeout(fn, ms)
    }) as typeof setTimeout)
    try {
      stubFetch(async (url: string, init?: RequestInit) =>
        init?.method === 'PUT' ? { ok: true, json: async () => ({}) } : { ok: true, json: async () => ({ user }) }
      )
      renderDialog()

      await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())
      fireEvent.click(screen.getByRole('button', { name: /save profile/i }))

      expect(await screen.findByText('Profile updated successfully!')).toBeInTheDocument()
      expect(callbacks).toHaveLength(1)

      act(() => {
        callbacks[0]()
      })
      expect(screen.queryByText('Profile updated successfully!')).not.toBeInTheDocument()
    } finally {
      setTimeoutSpy.mockRestore()
    }
  })

  describe('profile photo', () => {
    function renderWithUser(userOverrides = {}) {
      stubFetch(async (url: string, init?: RequestInit) =>
        init?.method === 'PUT'
          ? { ok: true, json: async () => ({}) }
          : { ok: true, json: async () => ({ user: { ...user, ...userOverrides } }) }
      )
      renderDialog()
    }

    async function selectPhoto() {
      processProfileImageMock.mockResolvedValue('data:image/jpeg;base64,newphoto')
      const input = screen.getByLabelText(/profile photo file input/i) as HTMLInputElement
      const file = new File(['bytes'], 'photo.png', { type: 'image/png' })
      fireEvent.change(input, { target: { files: [file] } })
      await waitFor(() => expect(processProfileImageMock).toHaveBeenCalledWith(file))
    }

    it('opens the file picker when the avatar button is clicked', async () => {
      renderWithUser()
      await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())
      const input = screen.getByLabelText(/profile photo file input/i) as HTMLInputElement
      const clickSpy = vi.spyOn(input, 'click').mockImplementation(() => {})
      const avatarButton = screen.getByRole('button', { name: /upload profile photo/i })
      fireEvent.click(avatarButton)
      expect(clickSpy).toHaveBeenCalled()
      clickSpy.mockRestore()
    })

    it('shows the saved photo instead of initials', async () => {
      renderWithUser({ image: 'data:image/jpeg;base64,saved' })
      await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())
      const img = document.body.querySelector('img')
      expect(img).toHaveAttribute('src', 'data:image/jpeg;base64,saved')
    })

    it('uploads a photo and includes it in the save payload', async () => {
      const fetchMock = stubFetch(async (url: string, init?: RequestInit) =>
        init?.method === 'PUT' ? { ok: true, json: async () => ({}) } : { ok: true, json: async () => ({ user }) }
      )
      renderDialog()
      await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())

      await selectPhoto()
      await waitFor(() =>
        expect(document.body.querySelector('img')).toHaveAttribute('src', 'data:image/jpeg;base64,newphoto')
      )

      fireEvent.click(screen.getByRole('button', { name: /save profile/i }))
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/users/u1', expect.objectContaining({ method: 'PUT' }))
      })
      const putCall = fetchMock.mock.calls.find((call) => call[1]?.method === 'PUT')
      expect(JSON.parse(putCall?.[1]?.body as string).image).toBe('data:image/jpeg;base64,newphoto')
    })

    it('dispatches a photo-updated event when the photo changes on save', async () => {
      stubFetch(async (url: string, init?: RequestInit) =>
        init?.method === 'PUT' ? { ok: true, json: async () => ({}) } : { ok: true, json: async () => ({ user }) }
      )
      renderDialog()
      await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())

      const listener = vi.fn()
      window.addEventListener(PROFILE_PHOTO_UPDATED_EVENT, listener)
      try {
        await selectPhoto()
        fireEvent.click(screen.getByRole('button', { name: /save profile/i }))
        await waitFor(() => expect(listener).toHaveBeenCalledTimes(1))
      } finally {
        window.removeEventListener(PROFILE_PHOTO_UPDATED_EVENT, listener)
      }
    })

    it('shows an error when photo processing fails', async () => {
      processProfileImageMock.mockRejectedValue(new Error('Please choose a JPEG, PNG, or WebP image.'))
      stubFetch(async () => ({ ok: true, json: async () => ({ user }) }))
      renderDialog()
      await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())

      const input = screen.getByLabelText(/profile photo file input/i)
      fireEvent.change(input, { target: { files: [new File(['x'], 'photo.txt', { type: 'text/plain' })] } })
      expect(await screen.findByRole('alert')).toHaveTextContent('Please choose a JPEG, PNG, or WebP image.')
    })

    it('removes the photo and clears it on save', async () => {
      const fetchMock = stubFetch(async (url: string, init?: RequestInit) =>
        init?.method === 'PUT'
          ? { ok: true, json: async () => ({}) }
          : { ok: true, json: async () => ({ user: { ...user, image: 'data:image/jpeg;base64,saved' } }) }
      )
      renderDialog()
      await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())
      expect(document.body.querySelector('img')).toHaveAttribute('src', 'data:image/jpeg;base64,saved')

      fireEvent.click(screen.getByRole('button', { name: /remove/i }))
      expect(document.body.querySelector('img')).not.toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: /save profile/i }))
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/users/u1', expect.objectContaining({ method: 'PUT' }))
      })
      const putCall = fetchMock.mock.calls.find((call) => call[1]?.method === 'PUT')
      expect(JSON.parse(putCall?.[1]?.body as string).image).toBe('')
    })

    it('ignores photo selection when no file is chosen', async () => {
      stubFetch(async () => ({ ok: true, json: async () => ({ user }) }))
      renderDialog()
      await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())

      const input = screen.getByLabelText(/profile photo file input/i) as HTMLInputElement
      fireEvent.change(input, { target: { files: [] } })
      expect(processProfileImageMock).not.toHaveBeenCalled()
    })

    it('shows a generic error when photo processing rejects with a non-Error', async () => {
      processProfileImageMock.mockRejectedValue('string failure')
      stubFetch(async () => ({ ok: true, json: async () => ({ user }) }))
      renderDialog()
      await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())

      const input = screen.getByLabelText(/profile photo file input/i)
      fireEvent.change(input, { target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] } })
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not read the image file.')
    })
  })
})
