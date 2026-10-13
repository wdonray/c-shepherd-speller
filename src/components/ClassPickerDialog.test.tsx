import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ClassPickerDialog from './ClassPickerDialog'

function renderDialog(overrides: Partial<Parameters<typeof ClassPickerDialog>[0]> = {}) {
  const props = {
    open: true,
    onSelect: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  }
  const result = render(<ClassPickerDialog {...props} />)
  return { ...props, ...result }
}

describe('ClassPickerDialog', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ classes: [] }),
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders nothing when closed', () => {
    renderDialog({ open: false })
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('lists classes and selects one on click', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        classes: [
          { id: 'c1', name: 'Period 2' },
          { id: 'c2', name: 'Blue group' },
        ],
      }),
    })
    const { onSelect } = renderDialog()
    const button = await screen.findByRole('button', { name: 'Period 2' })
    expect(screen.getByRole('button', { name: 'Blue group' })).toBeInTheDocument()
    fireEvent.click(button)
    expect(onSelect).toHaveBeenCalledWith('c1')
  })

  it('continues without a class', async () => {
    const { onSelect } = renderDialog()
    await screen.findByText('No classes yet.')
    fireEvent.click(screen.getByRole('button', { name: 'Continue without a class' }))
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('cancels via the Cancel button', async () => {
    const { onClose } = renderDialog()
    await screen.findByText('No classes yet.')
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('shows an error when classes fail to load', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('down'))
    renderDialog()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load classes.')
  })

  it('shows an error when the classes request returns an error status', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 500 })
    renderDialog()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load classes.')
  })

  it('handles a classes response with no classes key', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })
    renderDialog()
    expect(await screen.findByText('No classes yet.')).toBeInTheDocument()
  })

  it('ignores the classes fetch result after unmount', async () => {
    let resolveFetch!: (value: { ok: boolean; json: () => Promise<unknown> }) => void
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        })
    )
    const { unmount } = renderDialog()
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
    const { unmount } = renderDialog()
    unmount()
    rejectFetch(new Error('down'))
    await new Promise((r) => setTimeout(r, 10))
  })

  it('does not create a class with a blank name', async () => {
    renderDialog()
    await screen.findByText('No classes yet.')
    expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled()
    // Enter with a blank name hits the guard in handleCreate.
    fireEvent.keyDown(screen.getByLabelText('New class'), { key: 'Enter' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('ignores a second create while one is in flight', async () => {
    renderDialog()
    await screen.findByText('No classes yet.')
    // Hold the create request open.
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}))
    fireEvent.change(screen.getByLabelText('New class'), { target: { value: 'Period 9' } })
    fireEvent.keyDown(screen.getByLabelText('New class'), { key: 'Enter' })
    // Second Enter while creating: ignored, no second POST.
    fireEvent.keyDown(screen.getByLabelText('New class'), { key: 'Enter' })
    await new Promise((r) => setTimeout(r, 10))
    const posts = (fetch as ReturnType<typeof vi.fn>).mock.calls.filter((c) => c[1]?.method === 'POST')
    expect(posts).toHaveLength(1)
  })

  it('creates a class and selects it', async () => {
    const { onSelect } = renderDialog()
    await screen.findByText('No classes yet.')
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ class: { id: 'c9', name: 'Period 9' } }),
    })
    fireEvent.change(screen.getByLabelText('New class'), { target: { value: 'Period 9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/classes', expect.objectContaining({ method: 'POST' }))
    })
    expect(onSelect).toHaveBeenCalledWith('c9')
  })

  it('shows an error when creating a class fails', async () => {
    renderDialog()
    await screen.findByText('No classes yet.')
    ;(fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('down'))
    fireEvent.change(screen.getByLabelText('New class'), { target: { value: 'Period 9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the class.')
  })

  it('creates a class on Enter in the name field', async () => {
    const { onSelect } = renderDialog()
    await screen.findByText('No classes yet.')
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ class: { id: 'c9', name: 'Period 9' } }),
    })
    fireEvent.change(screen.getByLabelText('New class'), { target: { value: 'Period 9' } })
    fireEvent.keyDown(screen.getByLabelText('New class'), { key: 'Enter' })
    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith('c9')
    })
  })

  it('ignores non-Enter keys in the name field', async () => {
    const { onSelect } = renderDialog()
    await screen.findByText('No classes yet.')
    fireEvent.change(screen.getByLabelText('New class'), { target: { value: 'Period 9' } })
    fireEvent.keyDown(screen.getByLabelText('New class'), { key: 'a' })
    expect(onSelect).not.toHaveBeenCalled()
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('shows an error when the create request returns an error status', async () => {
    renderDialog()
    await screen.findByText('No classes yet.')
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 500 })
    fireEvent.change(screen.getByLabelText('New class'), { target: { value: 'Period 9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not create the class.')
  })
})
