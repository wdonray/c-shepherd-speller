import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useSession, signOut } from 'next-auth/react'
import DeleteAccountSection from './DeleteAccountSection'

vi.mock('next-auth/react', () => ({ useSession: vi.fn(), signOut: vi.fn() }))
vi.mock('@/lib/report-error', () => ({ reportError: vi.fn() }))

const useSessionMock = vi.mocked(useSession)
const signOutMock = vi.mocked(signOut)

function mockSession() {
  useSessionMock.mockReturnValue({
    data: { user: { id: 'sub-1', email: 'teacher@example.com', name: 'Teacher' } },
    status: 'authenticated',
    update: async () => null,
  } as never)
}

function mockAccount(info: { listCount: number; requiresPassword: boolean }) {
  window.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ email: 'teacher@example.com', ...info }),
  }) as never
}

describe('DeleteAccountSection', () => {
  beforeEach(() => {
    mockSession()
    signOutMock.mockReset()
    mockAccount({ listCount: 3, requiresPassword: false })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders the danger zone with a delete button', () => {
    render(<DeleteAccountSection />)
    expect(screen.getByRole('heading', { name: 'Danger zone' })).toBeInTheDocument()
    expect(screen.getByText(/Permanently delete your PatternSpell account and all of your data/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeInTheDocument()
  })

  it('opens a modal that plainly lists what will be deleted', async () => {
    render(<DeleteAccountSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    expect(screen.getByText('Delete your account?')).toBeInTheDocument()
    expect(screen.getByText('All 3 of your word lists')).toBeInTheDocument()
    expect(screen.getByText('Your profile photo')).toBeInTheDocument()
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
  })

  it('separates the modal action buttons with a gap', async () => {
    render(<DeleteAccountSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })
    const footer = document.querySelector('[data-slot="dialog-footer"]')
    expect(footer).not.toBeNull()
    expect(footer?.className).toMatch(/gap-[1-9]/)
    expect(footer?.className).not.toMatch(/gap-0/)
  })

  it('keeps the delete button disabled until the typed email matches', async () => {
    render(<DeleteAccountSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    const confirm = screen.getByRole('button', { name: 'Yes, delete my account' })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Type your email address to confirm'), {
      target: { value: 'wrong@example.com' },
    })
    expect(confirm).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Type your email address to confirm'), {
      target: { value: 'TEACHER@example.com' },
    })
    expect(confirm).not.toBeDisabled()
  })

  it('shows a password field for Cognito accounts and requires it', async () => {
    mockAccount({ listCount: 0, requiresPassword: true })
    render(<DeleteAccountSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByLabelText('Enter your password')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Type your email address to confirm'), {
      target: { value: 'teacher@example.com' },
    })
    expect(screen.getByRole('button', { name: 'Yes, delete my account' })).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Enter your password'), {
      target: { value: 'S3cure!pass' },
    })
    expect(screen.getByRole('button', { name: 'Yes, delete my account' })).not.toBeDisabled()
  })

  it('deletes the account and signs out on confirm', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ email: 'teacher@example.com', listCount: 0, requiresPassword: false }),
    })
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) })
    window.fetch = fetchMock as never

    render(<DeleteAccountSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Type your email address to confirm'), {
      target: { value: 'teacher@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete my account' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
    const [, deleteCall] = fetchMock.mock.calls
    expect(deleteCall[0]).toBe('/api/account')
    expect(deleteCall[1].method).toBe('DELETE')
    expect(JSON.parse(deleteCall[1].body)).toMatchObject({ email: 'teacher@example.com' })
    expect(signOutMock).toHaveBeenCalledWith({ callbackUrl: '/' })
  })

  it('shows a friendly error for a wrong password', async () => {
    mockAccount({ listCount: 0, requiresPassword: true })
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ email: 'teacher@example.com', listCount: 0, requiresPassword: true }),
    })
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ ok: false, code: 'invalid-credentials' }),
    })
    window.fetch = fetchMock as never

    render(<DeleteAccountSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Type your email address to confirm'), {
      target: { value: 'teacher@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Enter your password'), {
      target: { value: 'wrong' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete my account' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Incorrect password')
    })
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('clears the form when the dialog is cancelled', async () => {
    render(<DeleteAccountSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Type your email address to confirm'), {
      target: { value: 'teacher@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByLabelText('Type your email address to confirm')).toHaveValue('')
  })

  it('clears the form when the dialog is closed with the X button', async () => {
    render(<DeleteAccountSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Type your email address to confirm'), {
      target: { value: 'teacher@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByLabelText('Type your email address to confirm')).toHaveValue('')
  })

  it('shows a generic error when the delete request itself fails', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ email: 'teacher@example.com', listCount: 0, requiresPassword: false }),
    })
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    window.fetch = fetchMock as never

    render(<DeleteAccountSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Type your email address to confirm'), {
      target: { value: 'teacher@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete my account' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong')
    })
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('still renders the danger zone when the account info fetch fails', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    window.fetch = fetchMock as never

    render(<DeleteAccountSection />)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/account')
    })
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeInTheDocument()
    expect(screen.getByText(/Permanently delete your PatternSpell account/)).toBeInTheDocument()
  })

  it('renders without account info when not signed in', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated', update: async () => null } as never)
    const fetchMock = vi.fn()
    window.fetch = fetchMock as never

    render(<DeleteAccountSection />)
    expect(screen.getByRole('button', { name: 'Delete account' })).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('renders without list details when the account info request is not ok', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
    window.fetch = fetchMock as never

    render(<DeleteAccountSection />)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/account')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    expect(screen.getByText('All of your word lists')).toBeInTheDocument()
  })

  it('ignores the account response when unmounted before it resolves', async () => {
    let resolveFetch!: (value: unknown) => void
    const fetchMock = vi.fn().mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve
      })
    )
    window.fetch = fetchMock as never

    const { unmount } = render(<DeleteAccountSection />)
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/account')
    })
    unmount()
    resolveFetch({
      ok: true,
      json: async () => ({ email: 'teacher@example.com', listCount: 3, requiresPassword: false }),
    })
    await Promise.resolve()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('disables the confirm button while the deletion is in flight', async () => {
    let resolveDelete!: (value: unknown) => void
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ email: 'teacher@example.com', listCount: 0, requiresPassword: false }),
    })
    fetchMock.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveDelete = resolve
      })
    )
    window.fetch = fetchMock as never

    render(<DeleteAccountSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Type your email address to confirm'), {
      target: { value: 'teacher@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete my account' }))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled()
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    resolveDelete({ ok: true, json: async () => ({ ok: true }) })
    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalled()
    })
  })

  it('shows a fallback error for an unknown error code', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ email: 'teacher@example.com', listCount: 0, requiresPassword: false }),
    })
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Unexpected', code: 'something-new' }),
    })
    window.fetch = fetchMock as never

    render(<DeleteAccountSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Type your email address to confirm'), {
      target: { value: 'teacher@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete my account' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Try again in a moment.')
    })
    expect(signOutMock).not.toHaveBeenCalled()
  })

  it('shows a fallback error when the error response has no code', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ email: 'teacher@example.com', listCount: 0, requiresPassword: false }),
    })
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Unexpected' }),
    })
    window.fetch = fetchMock as never

    render(<DeleteAccountSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Type your email address to confirm'), {
      target: { value: 'teacher@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Yes, delete my account' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Try again in a moment.')
    })
    expect(signOutMock).not.toHaveBeenCalled()
  })
})
