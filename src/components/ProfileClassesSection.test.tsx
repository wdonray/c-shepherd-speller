import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ProfileClassesSection from './ProfileClassesSection'

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
