import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import NewListForm from './NewListForm'
import type { WordList } from '@/models/WordList'

const { createList, notifyListsChanged, logActivity, trackEvent, reportError } = vi.hoisted(() => ({
  createList: vi.fn(),
  notifyListsChanged: vi.fn(),
  logActivity: vi.fn(),
  trackEvent: vi.fn(),
  reportError: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({ createList, notifyListsChanged }))
vi.mock('@/lib/activity', () => ({ logActivity }))
vi.mock('@/lib/track-event', () => ({ trackEvent }))
vi.mock('@/lib/report-error', () => ({ reportError }))
vi.mock('@/lib/error-toast', () => ({
  getErrorMessage: (error: unknown) => (error instanceof Error ? error.message : 'Something went wrong.'),
}))

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const created: WordList = {
  id: 'l9',
  userId: 'u1',
  name: 'Week 7: Long O',
  gradeLevel: '2',
  patterns: [],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('NewListForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // The form inherits the teacher's default classroom; default to none.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ defaultClassId: null }),
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders the form with a back link to the lists page', () => {
    render(<NewListForm />)

    expect(screen.getByRole('heading', { name: 'New word list' })).toBeInTheDocument()
    expect(screen.getByLabelText('List name')).toBeInTheDocument()
    expect(screen.getByLabelText('Grade level (optional)')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My spelling lists' })).toHaveAttribute('href', '/lists')
  })

  it('disables Create list until a name is entered', () => {
    render(<NewListForm />)

    const createButton = screen.getByRole('button', { name: 'Create list' })
    expect(createButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: '  ' } })
    expect(createButton).toBeDisabled()

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Week 7' } })
    expect(createButton).toBeEnabled()
  })

  it('creates the list and redirects to its edit page', async () => {
    createList.mockResolvedValue(created)
    render(<NewListForm />)

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Week 7: Long O' } })
    fireEvent.change(screen.getByLabelText('Grade level (optional)'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }))

    await waitFor(() => {
      expect(createList).toHaveBeenCalledWith({
        name: 'Week 7: Long O',
        gradeLevel: '2',
        patterns: [],
      })
    })
    expect(logActivity).toHaveBeenCalledWith('created', 'Week 7: Long O', 'l9')
    expect(trackEvent).toHaveBeenCalledWith('list-created')
    expect(notifyListsChanged).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/lists/l9')
  })

  it('omits grade level when left blank', async () => {
    createList.mockResolvedValue({ ...created, gradeLevel: undefined })
    render(<NewListForm />)

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Week 7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }))

    await waitFor(() => {
      expect(createList).toHaveBeenCalledWith({ name: 'Week 7', gradeLevel: undefined, patterns: [] })
    })
  })

  it('sends the week when filled in', async () => {
    createList.mockResolvedValue({ ...created, week: '7' })
    render(<NewListForm />)

    expect(screen.getByLabelText('Week (optional)')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Week 7' } })
    fireEvent.change(screen.getByLabelText('Week (optional)'), { target: { value: ' 7 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }))

    await waitFor(() => {
      expect(createList).toHaveBeenCalledWith({ name: 'Week 7', gradeLevel: undefined, week: '7', patterns: [] })
    })
  })

  it('omits the week when left blank', async () => {
    createList.mockResolvedValue(created)
    render(<NewListForm />)

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Week 7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }))

    await waitFor(() => {
      expect(createList).toHaveBeenCalledWith({ name: 'Week 7', gradeLevel: undefined, week: undefined, patterns: [] })
    })
  })

  it('shows an inline error when creating fails', async () => {
    createList.mockRejectedValue(new Error('network down'))
    render(<NewListForm />)

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Week 7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('network down')
    })
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      location: 'NewListForm.handleSubmit',
    })
    // The form stays usable so the teacher can retry.
    expect(screen.getByRole('button', { name: 'Create list' })).toBeEnabled()
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('ignores submit when the name is empty', async () => {
    render(<NewListForm />)

    // Bypass the disabled button by submitting the form directly.
    fireEvent.submit(screen.getByRole('button', { name: 'Create list' }).closest('form')!)

    await waitFor(() => {
      expect(createList).not.toHaveBeenCalled()
    })
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('navigates back to the lists page on Cancel', () => {
    render(<NewListForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(mockPush).toHaveBeenCalledWith('/lists')
  })

  it('inherits the default classroom on create', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ defaultClassId: 'c1' }),
      })
    )
    createList.mockResolvedValue({ id: 'l9', name: 'Week 7' })
    render(<NewListForm />)

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Week 7' } })
    // Wait for the default to load before submitting.
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/classes/default'))
    await waitFor(() => new Promise((r) => setTimeout(r, 0)))
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }))

    await waitFor(() => {
      expect(createList).toHaveBeenCalledWith(expect.objectContaining({ name: 'Week 7', classId: 'c1' }))
    })
  })

  it('creates without a classroom when there is no default', async () => {
    createList.mockResolvedValue({ id: 'l9', name: 'Week 7' })
    render(<NewListForm />)

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Week 7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }))

    await waitFor(() => {
      expect(createList).toHaveBeenCalledWith({ name: 'Week 7', gradeLevel: undefined, patterns: [] })
    })
    expect(createList.mock.calls[0][0]).not.toHaveProperty('classId')
  })

  it('creates without a classroom when the default lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('down')))
    createList.mockResolvedValue({ id: 'l9', name: 'Week 7' })
    render(<NewListForm />)

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Week 7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }))

    await waitFor(() => {
      expect(createList).toHaveBeenCalled()
    })
    expect(createList.mock.calls[0][0]).not.toHaveProperty('classId')
  })
})
