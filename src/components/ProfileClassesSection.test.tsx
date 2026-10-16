import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import ProfileClassesSection, { applyDeletionInfo, deletionBlockReason, removeClassroom } from './ProfileClassesSection'

function mockFetch(classes: { id: string; name: string }[], defaultClassId: string | null = null) {
  return vi.fn(async (url: string) => {
    if (String(url).includes('/api/users/')) {
      return { ok: true, json: async () => ({ user: { id: 'u1', defaultClassId } }) }
    }
    return { ok: true, json: async () => ({ classes }) }
  })
}

describe('ProfileClassesSection', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch([]))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows the empty state when there are no classrooms', async () => {
    render(<ProfileClassesSection userId="u1" />)
    expect(await screen.findByText('No classrooms yet. Create one below.')).toBeInTheDocument()
  })

  it('shows an error when loading fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    render(<ProfileClassesSection userId="u1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load classrooms.')
  })

  it('shows an error when the classes request returns an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/api/users/')) {
          return { ok: true, json: async () => ({ user: { id: 'u1', defaultClassId: null } }) }
        }
        return { ok: false, status: 500 }
      })
    )
    render(<ProfileClassesSection userId="u1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load classrooms.')
  })

  it('shows an error when the user request returns an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/api/users/')) {
          return { ok: false, status: 500 }
        }
        return { ok: true, json: async () => ({ classes: [] }) }
      })
    )
    render(<ProfileClassesSection userId="u1" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load classrooms.')
  })

  it('handles a classes response with no classes key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/api/users/')) {
          return { ok: true, json: async () => ({ user: { id: 'u1', defaultClassId: null } }) }
        }
        return { ok: true, json: async () => ({}) }
      })
    )
    render(<ProfileClassesSection userId="u1" />)
    expect(await screen.findByText('No classrooms yet. Create one below.')).toBeInTheDocument()
  })

  it('ignores the load result after unmount', async () => {
    const resolvers: Array<(value: { ok: boolean; json: () => Promise<unknown> }) => void> = []
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolvers.push(resolve)
          })
      )
    )
    const { unmount } = render(<ProfileClassesSection userId="u1" />)
    unmount()
    const body = { ok: true, json: async () => ({ classes: [], user: { id: 'u1', defaultClassId: null } }) }
    resolvers.forEach((resolve) => resolve(body))
    await new Promise((r) => setTimeout(r, 10))
  })

  it('ignores a load rejection after unmount', async () => {
    const rejecters: Array<(reason: Error) => void> = []
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(
        () =>
          new Promise((_, reject) => {
            rejecters.push(reject)
          })
      )
    )
    const { unmount } = render(<ProfileClassesSection userId="u1" />)
    unmount()
    rejecters.forEach((reject) => reject(new Error('down')))
    await new Promise((r) => setTimeout(r, 10))
  })

  it('marks the single classroom as the default automatically', async () => {
    vi.stubGlobal('fetch', mockFetch([{ id: 'c1', name: 'Period 2' }]))
    render(<ProfileClassesSection userId="u1" />)
    expect(await screen.findByText('Period 2')).toBeInTheDocument()
    expect(screen.getByText('Default')).toBeInTheDocument()
    // No "Set as default" button for the effective default.
    expect(screen.queryByRole('button', { name: 'Set as default' })).not.toBeInTheDocument()
  })

  it('marks the explicit default and offers to change it', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(
        [
          { id: 'c1', name: 'Period 2' },
          { id: 'c2', name: 'Blue group' },
        ],
        'c2'
      )
    )
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('Period 2')
    // Only one Default badge, on Blue group.
    expect(screen.getAllByText('Default')).toHaveLength(1)
    const setDefault = screen.getByRole('button', { name: 'Set as default' })
    expect(setDefault).toBeInTheDocument()
  })

  it('sets a new default', async () => {
    const fetchMock = mockFetch(
      [
        { id: 'c1', name: 'Period 2' },
        { id: 'c2', name: 'Blue group' },
      ],
      null
    )
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('Period 2')
    fireEvent.click(screen.getAllByRole('button', { name: 'Set as default' })[0])
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/users/u1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ defaultClassId: 'c1' }),
        })
      )
    )
    expect(await screen.findAllByText('Default')).toHaveLength(1)
  })

  it('disables default buttons while a save is in flight', async () => {
    let resolvePut: (value: unknown) => void = () => {}
    const fetchMock = vi.fn(async (url: string, init?: { method?: string }) => {
      if (init?.method === 'PUT') {
        return new Promise((resolve) => {
          resolvePut = resolve
        })
      }
      if (String(url).includes('/api/users/')) {
        return { ok: true, json: async () => ({ user: { id: 'u1', defaultClassId: null } }) }
      }
      return {
        ok: true,
        json: async () => ({
          classes: [
            { id: 'c1', name: 'Period 2' },
            { id: 'c2', name: 'Blue group' },
          ],
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('Period 2')
    fireEvent.click(screen.getAllByRole('button', { name: 'Set as default' })[0])
    // While the PUT is pending, the buttons are disabled: a second click is ignored.
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Set as default' })[0]).toBeDisabled())
    fireEvent.click(screen.getAllByRole('button', { name: 'Set as default' })[0])
    const puts = fetchMock.mock.calls.filter((c) => c[1]?.method === 'PUT')
    expect(puts).toHaveLength(1)
    // Resolve the pending PUT so the component can settle.
    resolvePut({ ok: true, json: async () => ({}) })
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Set as default' })[0]).not.toBeDisabled())
  })

  it('shows an error and reverts when saving the default fails', async () => {
    const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'PUT') throw new Error('down')
      if (String(url).includes('/api/users/')) {
        return { ok: true, json: async () => ({ user: { id: 'u1', defaultClassId: null } }) }
      }
      return {
        ok: true,
        json: async () => ({
          classes: [
            { id: 'c1', name: 'Period 2' },
            { id: 'c2', name: 'Blue group' },
          ],
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('Period 2')
    // Two classes, no default: no Default badge yet.
    expect(screen.queryByText('Default')).not.toBeInTheDocument()
    fireEvent.click(screen.getAllByRole('button', { name: 'Set as default' })[0])
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the default classroom. Try again.')
    // Reverted: still no Default badge.
    expect(screen.queryByText('Default')).not.toBeInTheDocument()
  })

  it('shows an error and reverts when saving the default returns an error status', async () => {
    const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'PUT') {
        return { ok: false, status: 500 }
      }
      if (String(url).includes('/api/users/')) {
        return { ok: true, json: async () => ({ user: { id: 'u1', defaultClassId: null } }) }
      }
      return {
        ok: true,
        json: async () => ({
          classes: [
            { id: 'c1', name: 'Period 2' },
            { id: 'c2', name: 'Blue group' },
          ],
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('Period 2')
    fireEvent.click(screen.getAllByRole('button', { name: 'Set as default' })[0])
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the default classroom. Try again.')
    // Reverted: still no Default badge.
    expect(screen.queryByText('Default')).not.toBeInTheDocument()
  })

  it('creates a classroom inline', async () => {
    const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'POST') {
        return { ok: true, json: async () => ({ class: { id: 'c9', name: 'Green group' } }) }
      }
      if (String(url).includes('/api/users/')) {
        return { ok: true, json: async () => ({ user: { id: 'u1', defaultClassId: null } }) }
      }
      return { ok: true, json: async () => ({ classes: [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('No classrooms yet. Create one below.')
    fireEvent.change(screen.getByLabelText('New classroom'), { target: { value: 'Green group' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('Green group')).toBeInTheDocument()
  })

  it('creates a classroom with Enter in the name field', async () => {
    const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'POST') {
        return { ok: true, json: async () => ({ class: { id: 'c9', name: 'Green group' } }) }
      }
      if (String(url).includes('/api/users/')) {
        return { ok: true, json: async () => ({ user: { id: 'u1', defaultClassId: null } }) }
      }
      return { ok: true, json: async () => ({ classes: [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('No classrooms yet. Create one below.')
    const input = screen.getByLabelText('New classroom')
    fireEvent.change(input, { target: { value: 'Green group' } })
    // Other keys do not submit.
    fireEvent.keyDown(input, { key: 'a' })
    expect(fetchMock).not.toHaveBeenCalledWith('/api/classes', expect.objectContaining({ method: 'POST' }))
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('Green group')).toBeInTheDocument()
  })

  it('does not create a classroom with a blank name', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/api/users/')) {
        return { ok: true, json: async () => ({ user: { id: 'u1', defaultClassId: null } }) }
      }
      return { ok: true, json: async () => ({ classes: [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('No classrooms yet. Create one below.')
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    // Enter with a blank name hits the guard in handleCreate.
    fireEvent.keyDown(screen.getByLabelText('New classroom'), { key: 'Enter' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('ignores a second create while one is in flight', async () => {
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('No classrooms yet. Create one below.')
    // Hold the create request open.
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}))
    const input = screen.getByLabelText('New classroom')
    fireEvent.change(input, { target: { value: 'Period 9' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // Second Enter while creating: ignored, no second POST.
    fireEvent.keyDown(input, { key: 'Enter' })
    await new Promise((r) => setTimeout(r, 10))
    const posts = (fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) => c[1]?.method === 'POST')
    expect(posts).toHaveLength(1)
  })

  it('shows an error when the create request returns an error status', async () => {
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('No classrooms yet. Create one below.')
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 500 })
    fireEvent.change(screen.getByLabelText('New classroom'), { target: { value: 'Nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the classroom. Try again.')
  })

  it('creates a classroom before the initial load finishes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init?: { method?: string }) => {
        if (init?.method === 'POST') {
          return Promise.resolve({
            ok: true,
            json: async () => ({ class: { id: 'c9', name: 'Green group' } }),
          })
        }
        if (String(url).includes('/api/users/')) {
          return Promise.resolve({ ok: true, json: async () => ({ user: { id: 'u1', defaultClassId: null } }) })
        }
        // The initial classes load hangs: the create lands while classes is still null.
        return new Promise(() => {})
      })
    )
    render(<ProfileClassesSection userId="u1" />)
    const input = screen.getByLabelText('New classroom')
    fireEvent.change(input, { target: { value: 'Green group' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(await screen.findByText('Green group')).toBeInTheDocument()
  })

  it('does not offer to clear the default with a single classroom', async () => {
    vi.stubGlobal('fetch', mockFetch([{ id: 'c1', name: 'Period 2' }], 'c1'))
    render(<ProfileClassesSection userId="u1" />)
    expect(await screen.findByText('Period 2')).toBeInTheDocument()
    expect(screen.getByText('Default')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clear default' })).not.toBeInTheDocument()
  })

  it('shows an error when creation fails', async () => {
    const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'POST') throw new Error('down')
      if (String(url).includes('/api/users/')) {
        return { ok: true, json: async () => ({ user: { id: 'u1', defaultClassId: null } }) }
      }
      return { ok: true, json: async () => ({ classes: [] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('No classrooms yet. Create one below.')
    fireEvent.change(screen.getByLabelText('New classroom'), { target: { value: 'Nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the classroom. Try again.')
  })
})

describe('ProfileClassesSection clear default', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('clears the explicit default', async () => {
    const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'PUT') {
        expect(JSON.parse(init.body as string)).toEqual({ defaultClassId: null })
        return { ok: true, json: async () => ({ user: { id: 'u1', defaultClassId: null } }) }
      }
      if (String(url).includes('/api/users/')) {
        return { ok: true, json: async () => ({ user: { id: 'u1', defaultClassId: 'c1' } }) }
      }
      return {
        ok: true,
        json: async () => ({
          classes: [
            { id: 'c1', name: 'Period 2' },
            { id: 'c2', name: 'Blue group' },
          ],
        }),
      }
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('Period 2')
    expect(screen.getByText('Default')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear default' }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/users/u1', expect.objectContaining({ method: 'PUT' }))
    })
    // No explicit default and two classes: no Default badge.
    await waitFor(() => {
      expect(screen.queryByText('Default')).not.toBeInTheDocument()
    })
  })
})

describe('ProfileClassesSection classroom deletion (issue #309)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const emptyDeletion = { ruleCount: 0, assignedListCount: 0, studentCount: 0, canDelete: true }
  const blockedDeletion = { ruleCount: 2, assignedListCount: 1, studentCount: 0, canDelete: false }

  function mockFetchWith(overrides: {
    classes?: unknown[]
    defaultClassId?: string | null
    onDelete?: (url: string) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>
    onPost?: (url: string) => Promise<{ ok: boolean; json: () => Promise<unknown> }>
  }) {
    const { classes = [], defaultClassId = null, onDelete, onPost } = overrides
    return vi.fn(async (url: string, init?: { method?: string }) => {
      if (init?.method === 'DELETE' && onDelete) return onDelete(url)
      if (init?.method === 'POST' && onPost) return onPost(url)
      if (String(url).includes('/api/users/')) {
        return { ok: true, json: async () => ({ user: { id: 'u1', defaultClassId } }) }
      }
      return { ok: true, json: async () => ({ classes }) }
    })
  }

  const okDelete = (body: unknown = { ok: true, defaultCleared: false }) => ({
    ok: true,
    status: 200,
    json: async () => body,
  })

  it('disables Delete and explains what is attached', async () => {
    vi.stubGlobal('fetch', mockFetchWith({ classes: [{ id: 'c1', name: 'Period 2', deletion: blockedDeletion }] }))
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('Period 2')

    const deleteButton = screen.getByRole('button', { name: 'Delete' })
    expect(deleteButton).toBeDisabled()
    expect(screen.getByText('Cannot delete: 2 saved rules, assigned to 1 word list.')).toBeInTheDocument()
    // The disabled button points at the explanation for screen readers.
    expect(deleteButton).toHaveAttribute('aria-describedby', 'delete-block-c1')
  })

  it('shows a generic reason when the server omits deletion info', async () => {
    vi.stubGlobal('fetch', mockFetchWith({ classes: [{ id: 'c1', name: 'Period 2' }] }))
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('Period 2')

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
    expect(screen.getByText('Cannot delete this classroom right now.')).toBeInTheDocument()
  })

  it('deletes an empty classroom after confirmation', async () => {
    const fetchMock = mockFetchWith({
      classes: [{ id: 'c1', name: 'Period 2', deletion: emptyDeletion }],
      onDelete: async (url) => {
        expect(url).toBe('/api/classes/c1')
        return okDelete()
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('Period 2')

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Delete this classroom?')).toBeInTheDocument()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByText('Period 2')).not.toBeInTheDocument())
    const deletes = fetchMock.mock.calls.filter((c) => c[1]?.method === 'DELETE')
    expect(deletes).toHaveLength(1)
  })

  it('cancels the delete from the dialog', async () => {
    const fetchMock = mockFetchWith({
      classes: [{ id: 'c1', name: 'Period 2', deletion: emptyDeletion }],
      onDelete: async () => okDelete(),
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('Period 2')

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep it' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Period 2')).toBeInTheDocument()
    const deletes = fetchMock.mock.calls.filter((c) => c[1]?.method === 'DELETE')
    expect(deletes).toHaveLength(0)
  })

  it('closes the dialog with the X button without deleting', async () => {
    const fetchMock = mockFetchWith({
      classes: [{ id: 'c1', name: 'Period 2', deletion: emptyDeletion }],
      onDelete: async () => okDelete(),
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('Period 2')

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('Period 2')).toBeInTheDocument()
    const deletes = fetchMock.mock.calls.filter((c) => c[1]?.method === 'DELETE')
    expect(deletes).toHaveLength(0)
  })

  it('clears the default when the deleted classroom was the default', async () => {
    const fetchMock = mockFetchWith({
      classes: [
        { id: 'c1', name: 'Period 2', deletion: emptyDeletion },
        { id: 'c2', name: 'Blue group', deletion: emptyDeletion },
        { id: 'c3', name: 'Red group', deletion: emptyDeletion },
      ],
      defaultClassId: 'c1',
      onDelete: async () => okDelete({ ok: true, defaultCleared: true }),
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('Period 2')
    expect(screen.getByRole('button', { name: 'Clear default' })).toBeInTheDocument()

    // Delete the default classroom: the first row's Delete button.
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.queryByText('Period 2')).not.toBeInTheDocument())
    // The default was cleared server-side, so no explicit default remains.
    expect(screen.queryByRole('button', { name: 'Clear default' })).not.toBeInTheDocument()
  })

  it('shows the server block reason and refreshes the row when the delete is refused', async () => {
    const fetchMock = mockFetchWith({
      classes: [{ id: 'c1', name: 'Period 2', deletion: emptyDeletion }],
      onDelete: async () => ({
        ok: false,
        status: 409,
        json: async () => ({
          blocked: true,
          deletion: { ruleCount: 1, assignedListCount: 0, studentCount: 0, canDelete: false },
        }),
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('Period 2')

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete "Period 2". It has 1 saved rule.')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    // The row picked up the server's deletion info: Delete is now disabled with the reason.
    expect(screen.getByText('Cannot delete: 1 saved rule.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
  })

  it('shows a generic error when the server refuses without details', async () => {
    const fetchMock = mockFetchWith({
      classes: [{ id: 'c1', name: 'Period 2', deletion: emptyDeletion }],
      onDelete: async () => ({ ok: false, status: 409, json: async () => ({ blocked: true }) }),
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('Period 2')

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete "Period 2".')
    expect(screen.getByText('Cannot delete this classroom right now.')).toBeInTheDocument()
  })

  it('shows an error when the delete request fails', async () => {
    const fetchMock = mockFetchWith({
      classes: [{ id: 'c1', name: 'Period 2', deletion: emptyDeletion }],
      onDelete: async () => {
        throw new Error('down')
      },
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('Period 2')

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete "Period 2". Try again.')
    // The classroom is still listed.
    expect(screen.getByText('Period 2')).toBeInTheDocument()
  })

  it('shows an error when the delete request returns an error status', async () => {
    const fetchMock = mockFetchWith({
      classes: [{ id: 'c1', name: 'Period 2', deletion: emptyDeletion }],
      onDelete: async () => ({ ok: false, status: 500, json: async () => ({}) }),
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('Period 2')

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Could not delete "Period 2". Try again.')
  })

  it('disables the delete buttons while a delete is in flight', async () => {
    let resolveDelete: (value: { ok: boolean; status: number; json: () => Promise<unknown> }) => void = () => {}
    const fetchMock = mockFetchWith({
      classes: [
        { id: 'c1', name: 'Period 2', deletion: emptyDeletion },
        { id: 'c2', name: 'Blue group', deletion: emptyDeletion },
      ],
      onDelete: async () =>
        new Promise((resolve) => {
          resolveDelete = resolve
        }),
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('Period 2')

    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
    // While the DELETE is pending, the confirm button shows progress and is
    // disabled. (The dialog is modal, so the row buttons are unreachable
    // until it closes.)
    expect(await within(dialog).findByRole('button', { name: 'Deleting...' })).toBeDisabled()

    resolveDelete(okDelete())
    await waitFor(() => expect(screen.queryByText('Period 2')).not.toBeInTheDocument())
    const deletes = fetchMock.mock.calls.filter((c) => c[1]?.method === 'DELETE')
    expect(deletes).toHaveLength(1)
  })

  it('uses the deletion info returned when creating a classroom', async () => {
    const fetchMock = mockFetchWith({
      classes: [],
      onPost: async () => ({
        ok: true,
        json: async () => ({ class: { id: 'c9', name: 'Green group', deletion: emptyDeletion } }),
      }),
    })
    vi.stubGlobal('fetch', fetchMock)
    render(<ProfileClassesSection userId="u1" />)
    await screen.findByText('No classrooms yet. Create one below.')

    fireEvent.change(screen.getByLabelText('New classroom'), { target: { value: 'Green group' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await screen.findByText('Green group')
    // The new empty classroom can be deleted.
    expect(screen.getByRole('button', { name: 'Delete' })).not.toBeDisabled()
  })
})

describe('applyDeletionInfo', () => {
  const deletion = { ruleCount: 1, assignedListCount: 0, studentCount: 0, canDelete: false }

  it('returns null when there are no classes', () => {
    expect(applyDeletionInfo(null, 'c1', deletion)).toBeNull()
  })

  it('updates only the matching classroom', () => {
    const classes = [
      { id: 'c1', name: 'Period 2' },
      { id: 'c2', name: 'Blue group' },
    ]
    const updated = applyDeletionInfo(classes, 'c1', deletion)
    expect(updated?.[0].deletion).toEqual(deletion)
    expect(updated?.[1].deletion).toBeUndefined()
  })
})

describe('removeClassroom', () => {
  it('returns null when there are no classes', () => {
    expect(removeClassroom(null, 'c1')).toBeNull()
  })

  it('removes only the deleted classroom', () => {
    const classes = [
      { id: 'c1', name: 'Period 2' },
      { id: 'c2', name: 'Blue group' },
    ]
    expect(removeClassroom(classes, 'c1')).toEqual([{ id: 'c2', name: 'Blue group' }])
  })
})

describe('deletionBlockReason', () => {
  it('explains what is attached', () => {
    expect(deletionBlockReason({ ruleCount: 2, assignedListCount: 1, studentCount: 0, canDelete: false })).toBe(
      'Cannot delete: 2 saved rules, assigned to 1 word list.'
    )
  })

  it('shows a generic reason when nothing is attached', () => {
    expect(deletionBlockReason({ ruleCount: 0, assignedListCount: 0, studentCount: 0, canDelete: false })).toBe(
      'Cannot delete this classroom right now.'
    )
  })
})
