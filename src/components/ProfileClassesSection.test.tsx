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

  it('shows an error and reverts when saving the default fails', async () => {
    const fetchMock = vi.fn(async (url: string, init?: { method?: string }) => {
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

  it('creates a classroom inline', async () => {
    const fetchMock = vi.fn(async (url: string, init?: { method?: string }) => {
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

  it('shows an error when creation fails', async () => {
    const fetchMock = vi.fn(async (url: string, init?: { method?: string }) => {
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
    const fetchMock = vi.fn(async (url: string, init?: { method?: string }) => {
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
