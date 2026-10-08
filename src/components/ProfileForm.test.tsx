import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import ProfileForm, { PROFILE_PHOTO_UPDATED_EVENT } from './ProfileForm'
import { processProfileImage } from '@/lib/profile-image'
import { clearDataCache } from '@/lib/data-cache'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
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

function renderForm() {
  mockSession()
  return render(<ProfileForm />)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function renderReadyDialog() {
  renderForm()
  await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())
}

function getPutCalls(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter((call) => (call[1] as RequestInit | undefined)?.method === 'PUT')
}

describe('ProfileForm', () => {
  beforeEach(() => {
    clearDataCache()
    useSessionMock.mockReset()
    processProfileImageMock.mockReset()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('shows the identity header with name, email, and sign-in method', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ user }) }))
    renderForm()

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Donray Williams' })).toBeInTheDocument()
    })
    expect(screen.getByText('t@e.c')).toBeInTheDocument()
    expect(screen.getByText('Signed in with Google')).toBeInTheDocument()
  })

  it('falls back to a question mark when there is no name or email', async () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated', update: async () => null } as never)
    stubFetch(async () => ({ ok: true, json: async () => ({ user: null }) }))
    render(<ProfileForm />)

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
    render(<ProfileForm />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Your profile' })).toBeInTheDocument()
    })
    expect(document.querySelector('button.rounded-full')?.textContent).toBe('T')
  })

  it('has no Save or Cancel buttons', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ user }) }))
    renderForm()

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).not.toBeDisabled()
    })
    expect(screen.queryByRole('button', { name: /save profile/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^cancel$/i })).not.toBeInTheDocument()
  })

  it('has no Sign out button', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ user }) }))
    renderForm()

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).not.toBeDisabled()
    })
    expect(screen.queryByRole('button', { name: /sign out/i })).not.toBeInTheDocument()
  })

  it('populates the form fields from the fetched user', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ user }) }))
    renderForm()

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

  it('auto-saves changed fields with a PUT after the debounce', async () => {
    const fetchMock = stubFetch(async (url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? { ok: true, json: async () => ({}) } : { ok: true, json: async () => ({ user }) }
    )
    await renderReadyDialog()

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Donray W.' } })

    // No synchronous save: the debounce has not fired yet.
    expect(getPutCalls(fetchMock)).toHaveLength(0)

    await waitFor(() => expect(getPutCalls(fetchMock)).toHaveLength(1), { timeout: 3000 })
    const body = JSON.parse(getPutCalls(fetchMock)[0]?.[1]?.body as string)
    expect(body.name).toBe('Donray W.')
    expect(body.preferredName).toBe('Donray')
    expect(body.gradeLevel).toBe('3rd Grade')
    expect(body.classroomSize).toBe(25)
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('debounces rapid changes into a single save', async () => {
    const fetchMock = stubFetch(async (url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? { ok: true, json: async () => ({}) } : { ok: true, json: async () => ({ user }) }
    )
    await renderReadyDialog()

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Donray W.' } })
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Donray Wi.' } })
    fireEvent.change(screen.getByLabelText(/preferred name/i), { target: { value: 'Don' } })

    await waitFor(() => expect(getPutCalls(fetchMock)).toHaveLength(1), { timeout: 3000 })
    const body = JSON.parse(getPutCalls(fetchMock)[0]?.[1]?.body as string)
    expect(body.name).toBe('Donray Wi.')
    expect(body.preferredName).toBe('Don')

    // No second save fires for the earlier keystrokes.
    await sleep(700)
    expect(getPutCalls(fetchMock)).toHaveLength(1)
  })

  it('auto-saves every editable field when all are changed', async () => {
    const fetchMock = stubFetch(async (url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? { ok: true, json: async () => ({}) } : { ok: true, json: async () => ({ user }) }
    )
    await renderReadyDialog()

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Donray W.' } })
    fireEvent.change(screen.getByLabelText(/preferred name/i), { target: { value: 'Don' } })
    fireEvent.change(screen.getByLabelText(/grade level/i), { target: { value: '4th Grade' } })
    fireEvent.change(screen.getByLabelText(/subject\/area/i), { target: { value: 'Math' } })
    fireEvent.change(screen.getByLabelText(/school name/i), { target: { value: 'Elm School' } })
    fireEvent.change(screen.getByLabelText(/typical class size/i), { target: { value: '30' } })

    await waitFor(() => expect(getPutCalls(fetchMock)).toHaveLength(1), { timeout: 3000 })
    const body = JSON.parse(getPutCalls(fetchMock)[0]?.[1]?.body as string)
    expect(body).toEqual({
      name: 'Donray W.',
      preferredName: 'Don',
      gradeLevel: '4th Grade',
      subject: 'Math',
      schoolName: 'Elm School',
      classroomSize: 30,
    })
  })

  it('omits empty fields from the auto-save payload', async () => {
    const fetchMock = stubFetch(async (url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? { ok: true, json: async () => ({}) } : { ok: true, json: async () => ({ user }) }
    )
    await renderReadyDialog()

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/preferred name/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/grade level/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/subject\/area/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/school name/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/typical class size/i), { target: { value: '' } })

    await waitFor(() => expect(getPutCalls(fetchMock)).toHaveLength(1), { timeout: 3000 })
    const body = JSON.parse(getPutCalls(fetchMock)[0]?.[1]?.body as string)
    expect(body).toEqual({})
  })

  it('does not auto-save when there is no user record', async () => {
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => ({ user: null }) }))
    mockSession()
    render(<ProfileForm />)
    await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Donray W.' } })
    await sleep(800)

    expect(getPutCalls(fetchMock)).toHaveLength(0)
    // Only the initial GET happened.
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('shows a Saving indicator while the save is in flight', async () => {
    let resolvePut: (value: unknown) => void = () => {}
    stubFetch(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT') {
        return new Promise((resolve) => {
          resolvePut = resolve
        })
      }
      return { ok: true, json: async () => ({ user }) }
    })
    await renderReadyDialog()

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Donray W.' } })

    expect(await screen.findByText('Saving...', undefined, { timeout: 3000 })).toBeInTheDocument()
    act(() => {
      resolvePut({ ok: true, json: async () => ({}) })
    })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('shows an error message when auto-save fails and keeps the input', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch(async (url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? { ok: false } : { ok: true, json: async () => ({ user }) }
    )
    await renderReadyDialog()

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Donray W.' } })

    expect(await screen.findByRole('alert', undefined, { timeout: 3000 })).toHaveTextContent(
      'Could not save your changes. Check your connection and try again.'
    )
    expect(consoleSpy).toHaveBeenCalledWith('Error updating user:', expect.any(Error))
    // The user's input is not lost.
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Donray W.')
    expect(screen.queryByText('Saved')).not.toBeInTheDocument()
  })

  it('hides the Saved message after two seconds', async () => {
    stubFetch(async (url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? { ok: true, json: async () => ({}) } : { ok: true, json: async () => ({ user }) }
    )
    await renderReadyDialog()

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Donray W.' } })

    expect(await screen.findByText('Saved', undefined, { timeout: 3000 })).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Saved')).not.toBeInTheDocument(), { timeout: 4000 })
  })

  it('clears the previous Saved timer when a new save starts', async () => {
    const fetchMock = stubFetch(async (url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? { ok: true, json: async () => ({}) } : { ok: true, json: async () => ({ user }) }
    )
    await renderReadyDialog()

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Donray W.' } })
    expect(await screen.findByText('Saved', undefined, { timeout: 3000 })).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Donray Wi.' } })
    await waitFor(() => expect(getPutCalls(fetchMock)).toHaveLength(2), { timeout: 3000 })
    expect(await screen.findByText('Saved')).toBeInTheDocument()
  })

  it('flushes a pending save on unmount', async () => {
    const fetchMock = stubFetch(async (url: string, init?: RequestInit) =>
      init?.method === 'PUT' ? { ok: true, json: async () => ({}) } : { ok: true, json: async () => ({ user }) }
    )
    mockSession()
    const { unmount } = render(<ProfileForm />)
    await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())

    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Donray W.' } })
    expect(getPutCalls(fetchMock)).toHaveLength(0)

    unmount()

    await waitFor(() => expect(getPutCalls(fetchMock)).toHaveLength(1), { timeout: 3000 })
    const body = JSON.parse(getPutCalls(fetchMock)[0]?.[1]?.body as string)
    expect(body.name).toBe('Donray W.')
  })

  it('does not save on unmount when nothing is pending', async () => {
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => ({ user }) }))
    mockSession()
    const { unmount } = render(<ProfileForm />)
    await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())

    unmount()
    await sleep(800)
    expect(getPutCalls(fetchMock)).toHaveLength(0)
  })

  it('logs an error when fetching the user fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch(async () => {
      throw new Error('network down')
    })
    renderForm()

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Error fetching user:', expect.any(Error))
    })
  })

  it('stops loading when the session has no email', async () => {
    useSessionMock.mockReturnValue({
      data: { user: { name: 'Donray' } },
      status: 'authenticated',
      update: async () => null,
    } as never)
    const fetchMock = stubFetch(async () => ({ ok: true, json: async () => ({ user }) }))
    render(<ProfileForm />)

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).not.toBeDisabled()
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('handles a missing user record gracefully', async () => {
    stubFetch(async () => ({ ok: true, json: async () => ({ user: null }) }))
    renderForm()

    await waitFor(() => {
      expect(screen.getByLabelText(/full name/i)).not.toBeDisabled()
    })
    expect(screen.getByLabelText(/full name/i)).toHaveValue('')
  })

  it('defaults missing optional fields to empty strings', async () => {
    const sparseUser = { id: 'u1', email: 't@e.c' }
    stubFetch(async () => ({ ok: true, json: async () => ({ user: sparseUser }) }))
    renderForm()

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

  describe('profile photo', () => {
    function renderWithUser(userOverrides = {}) {
      stubFetch(async (url: string, init?: RequestInit) =>
        init?.method === 'PUT'
          ? { ok: true, json: async () => ({}) }
          : { ok: true, json: async () => ({ user: { ...user, ...userOverrides } }) }
      )
      renderForm()
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

    it('saves the photo immediately on selection', async () => {
      const fetchMock = stubFetch(async (url: string, init?: RequestInit) =>
        init?.method === 'PUT' ? { ok: true, json: async () => ({}) } : { ok: true, json: async () => ({ user }) }
      )
      renderForm()
      await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())

      await selectPhoto()

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/users/u1', expect.objectContaining({ method: 'PUT' }))
      })
      const putCall = getPutCalls(fetchMock)[0]
      const body = JSON.parse(putCall?.[1]?.body as string)
      expect(body.image).toBe('data:image/jpeg;base64,newphoto')
      expect(body.name).toBe('Donray Williams')
      expect(await screen.findByText('Saved')).toBeInTheDocument()
    })

    it('dispatches a photo-updated event when the photo saves', async () => {
      stubFetch(async (url: string, init?: RequestInit) =>
        init?.method === 'PUT' ? { ok: true, json: async () => ({}) } : { ok: true, json: async () => ({ user }) }
      )
      renderForm()
      await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())

      const listener = vi.fn()
      window.addEventListener(PROFILE_PHOTO_UPDATED_EVENT, listener)
      try {
        await selectPhoto()
        await waitFor(() => expect(listener).toHaveBeenCalledTimes(1))
      } finally {
        window.removeEventListener(PROFILE_PHOTO_UPDATED_EVENT, listener)
      }
    })

    it('shows an error when photo processing fails', async () => {
      processProfileImageMock.mockRejectedValue(new Error('Please choose a JPEG, PNG, or WebP image.'))
      stubFetch(async () => ({ ok: true, json: async () => ({ user }) }))
      renderForm()
      await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())

      const input = screen.getByLabelText(/profile photo file input/i)
      fireEvent.change(input, { target: { files: [new File(['x'], 'photo.txt', { type: 'text/plain' })] } })
      expect(await screen.findByRole('alert')).toHaveTextContent('Please choose a JPEG, PNG, or WebP image.')
    })

    it('removes the photo and saves immediately', async () => {
      const fetchMock = stubFetch(async (url: string, init?: RequestInit) =>
        init?.method === 'PUT'
          ? { ok: true, json: async () => ({}) }
          : { ok: true, json: async () => ({ user: { ...user, image: 'data:image/jpeg;base64,saved' } }) }
      )
      renderForm()
      await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())
      expect(document.body.querySelector('img')).toHaveAttribute('src', 'data:image/jpeg;base64,saved')

      fireEvent.click(screen.getByRole('button', { name: /remove/i }))
      expect(document.body.querySelector('img')).not.toBeInTheDocument()

      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledWith('/api/users/u1', expect.objectContaining({ method: 'PUT' }))
      })
      const putCall = getPutCalls(fetchMock)[0]
      expect(JSON.parse(putCall?.[1]?.body as string).image).toBe('')
    })

    it('ignores photo selection when no file is chosen', async () => {
      stubFetch(async () => ({ ok: true, json: async () => ({ user }) }))
      renderForm()
      await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())

      const input = screen.getByLabelText(/profile photo file input/i) as HTMLInputElement
      fireEvent.change(input, { target: { files: [] } })
      expect(processProfileImageMock).not.toHaveBeenCalled()
    })

    it('shows a generic error when photo processing rejects with a non-Error', async () => {
      processProfileImageMock.mockRejectedValue('string failure')
      stubFetch(async () => ({ ok: true, json: async () => ({ user }) }))
      renderForm()
      await waitFor(() => expect(screen.getByLabelText(/full name/i)).not.toBeDisabled())

      const input = screen.getByLabelText(/profile photo file input/i)
      fireEvent.change(input, { target: { files: [new File(['x'], 'photo.png', { type: 'image/png' })] } })
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not read the image file.')
    })
  })
})
