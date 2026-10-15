import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ClassroomSelector from './ClassroomSelector'

function mockFetch(classes: { id: string; name: string }[] = []) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ classes }),
  })
}

function renderSelector(value: string | null | undefined = null) {
  const onChange = vi.fn()
  const result = render(<ClassroomSelector value={value} onChange={onChange} />)
  return { onChange, ...result }
}

describe('ClassroomSelector', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a classroom label and a disabled select while loading', () => {
    renderSelector()
    expect(screen.getByLabelText('Classroom')).toBeInTheDocument()
    expect(screen.getByLabelText('Classroom')).toBeDisabled()
  })

  it('lists classes and calls onChange with the picked id', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(mockFetch([{ id: 'c1', name: 'Period 2' }]))
    const { onChange } = renderSelector()
    const select = await screen.findByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())
    fireEvent.change(select, { target: { value: 'c1' } })
    expect(onChange).toHaveBeenCalledWith('c1')
  })

  it('selects "No class" and calls onChange with null', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(mockFetch([{ id: 'c1', name: 'Period 2' }]))
    const { onChange } = renderSelector('c1')
    const select = await screen.findByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())
    fireEvent.change(select, { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('shows the stored class as selected', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(mockFetch([{ id: 'c1', name: 'Period 2' }]))
    renderSelector('c1')
    const select = await screen.findByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())
    expect((select as HTMLSelectElement).value).toBe('c1')
  })

  it('falls back to "No class" when the stored class is gone', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(mockFetch([]))
    renderSelector('deleted')
    const select = await screen.findByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())
    expect((select as HTMLSelectElement).value).toBe('')
  })

  it('shows an error when classes fail to load', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('down'))
    renderSelector()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load classrooms.')
  })

  it('creates a new classroom inline and selects it', async () => {
    const fetchMock = vi.fn(async (url: string, init?: { method?: string }) => {
      if (init?.method === 'POST') {
        return { ok: true, json: async () => ({ class: { id: 'c9', name: 'Green group' } }) }
      }
      return { ok: true, json: async () => ({ classes: [{ id: 'c1', name: 'Period 2' }] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    const { onChange } = renderSelector()
    const select = await screen.findByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())

    fireEvent.change(select, { target: { value: '__new__' } })
    fireEvent.change(screen.getByLabelText('New classroom name'), { target: { value: 'Green group' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('c9'))
    expect(fetchMock).toHaveBeenCalledWith('/api/classes', expect.objectContaining({ method: 'POST' }))
  })

  it('creates a new classroom with Enter in the name field', async () => {
    const fetchMock = vi.fn(async (url: string, init?: { method?: string }) => {
      if (init?.method === 'POST') {
        return { ok: true, json: async () => ({ class: { id: 'c9', name: 'Green group' } }) }
      }
      return { ok: true, json: async () => ({ classes: [{ id: 'c1', name: 'Period 2' }] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    const { onChange } = renderSelector()
    const select = await screen.findByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())

    fireEvent.change(select, { target: { value: '__new__' } })
    const input = screen.getByLabelText('New classroom name')
    fireEvent.change(input, { target: { value: 'Green group' } })
    // Other keys do not submit.
    fireEvent.keyDown(input, { key: 'a' })
    expect(fetchMock).not.toHaveBeenCalledWith('/api/classes', expect.objectContaining({ method: 'POST' }))
    fireEvent.keyDown(input, { key: 'Enter' })

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('c9'))
    expect(fetchMock).toHaveBeenCalledWith('/api/classes', expect.objectContaining({ method: 'POST' }))
  })

  it('shows an error when creation fails', async () => {
    const fetchMock = mockFetch([])
    vi.stubGlobal('fetch', fetchMock)
    renderSelector()
    const select = await screen.findByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())

    fireEvent.change(select, { target: { value: '__new__' } })
    fireEvent.change(screen.getByLabelText('New classroom name'), { target: { value: 'Nope' } })
    fetchMock.mockRejectedValueOnce(new Error('down'))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the classroom. Try again.')
  })

  it('cancels creation', async () => {
    const { onChange } = renderSelector()
    const select = await screen.findByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())
    fireEvent.change(select, { target: { value: '__new__' } })
    expect(screen.getByLabelText('New classroom name')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('New classroom name')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
