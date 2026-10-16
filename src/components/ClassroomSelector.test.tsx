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

  it('styles the select to match the page text inputs', async () => {
    renderSelector()
    const select = await screen.findByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())
    const classes = (select as HTMLSelectElement).className
    // Same sizing, padding, border, and background as the shadcn Input
    // (issue #337); the native select arrow is replaced by a chevron.
    for (const cls of [
      'h-12',
      'px-4',
      'rounded-xl',
      'border-2',
      'border-line',
      'bg-card',
      'text-base',
      'appearance-none',
    ]) {
      expect(classes).toContain(cls)
    }
    expect(classes).not.toContain('h-11')
    expect(classes).not.toContain('font-bold')
    expect(select.parentElement?.querySelector('svg')).toBeInTheDocument()
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

  it('shows an error when the classes request returns an error status', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 500 })
    renderSelector()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load classrooms.')
  })

  it('handles a classes response with no classes key', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })
    renderSelector()
    const select = await screen.findByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())
    expect((select as HTMLSelectElement).value).toBe('')
  })

  it('ignores the classes fetch result after unmount', async () => {
    let resolveFetch!: (value: { ok: boolean; json: () => Promise<unknown> }) => void
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        })
    )
    const { unmount } = renderSelector()
    unmount()
    resolveFetch({ ok: true, json: async () => ({ classes: [] }) })
    await new Promise((r) => setTimeout(r, 10))
  })

  it('ignores a classes fetch rejection after unmount', async () => {
    let rejectFetch!: (reason: Error) => void
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectFetch = reject
        })
    )
    const { unmount } = renderSelector()
    unmount()
    rejectFetch(new Error('down'))
    await new Promise((r) => setTimeout(r, 10))
  })

  it('opens creation in a modal dialog rendered outside the page flow', async () => {
    const { container } = renderSelector()
    const select = await screen.findByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.change(select, { target: { value: '__new__' } })

    const dialog = screen.getByRole('dialog')
    expect(dialog).toBeInTheDocument()
    // The dialog portals to the document body, so it never shifts the
    // list edit page layout (issue #352).
    expect(container.contains(dialog)).toBe(false)
    expect(screen.getByRole('heading', { name: 'New classroom' })).toBeInTheDocument()
    const input = screen.getByLabelText('Classroom name')
    expect(input.className).toContain('w-full')
  })

  it('creates a new classroom from the modal and selects it', async () => {
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
    fireEvent.change(screen.getByLabelText('Classroom name'), { target: { value: 'Green group' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(onChange).toHaveBeenCalledWith('c9'))
    expect(fetchMock).toHaveBeenCalledWith('/api/classes', expect.objectContaining({ method: 'POST' }))
    // The new classroom is selected and the modal closes.
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
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
    const input = screen.getByLabelText('Classroom name')
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
    fireEvent.change(screen.getByLabelText('Classroom name'), { target: { value: 'Nope' } })
    fetchMock.mockRejectedValueOnce(new Error('down'))
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the classroom. Try again.')
  })

  it('cancels creation', async () => {
    const { onChange } = renderSelector()
    const select = await screen.findByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())
    fireEvent.change(select, { target: { value: '__new__' } })
    expect(screen.getByLabelText('Classroom name')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onChange).not.toHaveBeenCalled()
  })

  it('closes the modal with the X button without creating', async () => {
    const { onChange } = renderSelector()
    const select = await screen.findByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())
    fireEvent.change(select, { target: { value: '__new__' } })
    fireEvent.change(screen.getByLabelText('Classroom name'), { target: { value: 'Typed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onChange).not.toHaveBeenCalled()
    // The select reverts to the stored value ("No class" here).
    expect((select as HTMLSelectElement).value).toBe('')
  })

  it('does not create a classroom with a blank name', async () => {
    const { onChange } = renderSelector()
    const select = await screen.findByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())
    fireEvent.change(select, { target: { value: '__new__' } })
    const input = screen.getByLabelText('Classroom name')
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    // Enter with a blank name hits the guard in handleCreate.
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('ignores a second create while one is in flight', async () => {
    const { onChange } = renderSelector()
    const select = await screen.findByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())
    fireEvent.change(select, { target: { value: '__new__' } })
    // Hold the create request open.
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}))
    const input = screen.getByLabelText('Classroom name')
    fireEvent.change(input, { target: { value: 'Period 9' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    // Second Enter while creating: ignored, no second POST.
    fireEvent.keyDown(input, { key: 'Enter' })
    await new Promise((r) => setTimeout(r, 10))
    const posts = (fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) => c[1]?.method === 'POST')
    expect(posts).toHaveLength(1)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables Cancel and hides the X button while the create request is in flight', async () => {
    renderSelector()
    const select = await screen.findByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())
    fireEvent.change(select, { target: { value: '__new__' } })
    // Hold the create request open.
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}))
    fireEvent.change(screen.getByLabelText('Classroom name'), { target: { value: 'Period 9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Adding…' })).toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  })

  it('ignores the Escape close request while the create request is in flight', async () => {
    renderSelector()
    const select = await screen.findByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())
    fireEvent.change(select, { target: { value: '__new__' } })
    // Hold the create request open.
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}))
    fireEvent.change(screen.getByLabelText('Classroom name'), { target: { value: 'Period 9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Adding…' })).toBeInTheDocument())
    fireEvent.keyDown(document, { key: 'Escape' })
    // The modal stays open until the request resolves.
    await new Promise((r) => setTimeout(r, 10))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows an error when the create request returns an error status', async () => {
    renderSelector()
    const select = await screen.findByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 500 })
    fireEvent.change(select, { target: { value: '__new__' } })
    fireEvent.change(screen.getByLabelText('Classroom name'), { target: { value: 'Nope' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the classroom. Try again.')
  })

  it('creates a classroom before the initial load finishes', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string, init?: { method?: string }) => {
      if (init?.method === 'POST') {
        return Promise.resolve({ ok: true, json: async () => ({ class: { id: 'c9', name: 'Green group' } }) })
      }
      // The initial classes load hangs: the create lands while classes is still null.
      return new Promise(() => {})
    })
    const { onChange } = renderSelector()
    const select = screen.getByLabelText('Classroom')
    fireEvent.change(select, { target: { value: '__new__' } })
    fireEvent.change(screen.getByLabelText('Classroom name'), { target: { value: 'Green group' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('c9'))
  })
})
