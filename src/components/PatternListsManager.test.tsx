import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import PatternListsManager from './PatternListsManager'
import type { WordList } from '@/models/WordList'

const { getLists, createList, updateList, deleteList } = vi.hoisted(() => ({
  getLists: vi.fn(),
  createList: vi.fn(),
  updateList: vi.fn(),
  deleteList: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({ getLists, createList, updateList, deleteList }))

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5: Long A',
  patterns: [],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('PatternListsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading state, then the empty state', async () => {
    getLists.mockResolvedValue([])
    render(<PatternListsManager />)

    expect(screen.getByRole('status')).toHaveTextContent('Loading your word lists...')
    await waitFor(() => {
      expect(screen.getByText('No word lists yet.')).toBeInTheDocument()
    })
  })

  it('shows an error when loading fails', async () => {
    getLists.mockRejectedValue(new Error('network down'))
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('network down')
    })
  })

  it('shows a generic error when loading throws a non-Error', async () => {
    getLists.mockRejectedValue('string failure')
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to load lists')
    })
  })

  it('lists existing word lists', async () => {
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })
    expect(screen.getByText('My word lists (1)')).toBeInTheDocument()
  })

  it('creates a new list', async () => {
    getLists.mockResolvedValue([])
    createList.mockResolvedValue({ ...list, name: 'Week 6' })
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('No word lists yet.')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'New list' }))
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Week 6' } })
    fireEvent.change(screen.getByLabelText('Grade level (optional)'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }))

    await waitFor(() => {
      expect(createList).toHaveBeenCalledWith({ name: 'Week 6', gradeLevel: '1', patterns: [] })
    })
  })

  it('creates a list without a grade level', async () => {
    getLists.mockResolvedValue([])
    createList.mockResolvedValue({ ...list, name: 'Week 6' })
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('No word lists yet.')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'New list' }))
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Week 6' } })
    // Leave grade blank
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }))

    await waitFor(() => {
      expect(createList).toHaveBeenCalledWith({ name: 'Week 6', gradeLevel: undefined, patterns: [] })
    })
  })

  it('shows an error when list creation fails', async () => {
    getLists.mockResolvedValue([])
    createList.mockRejectedValue(new Error('create failed'))
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('No word lists yet.')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'New list' }))
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Week 6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('create failed')
    })
  })

  it('shows a generic error when creation throws a non-Error', async () => {
    getLists.mockResolvedValue([])
    createList.mockRejectedValue('string failure')
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('No word lists yet.')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'New list' }))
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Week 6' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to create list')
    })
  })

  it('does not create a list with a blank name', async () => {
    getLists.mockResolvedValue([])
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('No word lists yet.')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'New list' }))
    expect(screen.getByRole('button', { name: 'Create list' })).toBeDisabled()
    expect(createList).not.toHaveBeenCalled()
  })

  it('cancels list creation', async () => {
    getLists.mockResolvedValue([])
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('No word lists yet.')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'New list' }))
    expect(screen.getByLabelText('List name')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.queryByLabelText('List name')).not.toBeInTheDocument()
  })

  it('opens the editor when Edit is clicked', async () => {
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('List name')).toHaveValue('Week 5: Long A')
    expect(screen.getByText('Spelling patterns (0)')).toBeInTheDocument()
  })

  it('adds a pattern in the editor', async () => {
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add pattern' }))
    expect(screen.getByText('Spelling patterns (1)')).toBeInTheDocument()
  })

  it('edits a pattern in the editor', async () => {
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add pattern' }))
    // Add a second pattern so the map covers both branches
    fireEvent.click(screen.getByRole('button', { name: 'Add pattern' }))
    // Change the first pattern via the PatternEditor
    const patternInputs = screen.getAllByLabelText('Pattern')
    fireEvent.change(patternInputs[0], { target: { value: 'ai' } })
    expect(patternInputs[0]).toHaveValue('ai')
    // The second pattern is untouched
    expect(patternInputs[1]).toHaveValue('')
  })

  it('removes a pattern in the editor', async () => {
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add pattern' }))
    expect(screen.getByText('Spelling patterns (1)')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Remove pattern' }))
    expect(screen.getByText('Spelling patterns (0)')).toBeInTheDocument()
  })

  it('saves the edited list', async () => {
    getLists.mockResolvedValue([list])
    updateList.mockResolvedValue({ ...list, name: 'Renamed' })
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }))

    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ name: 'Renamed' }))
    })
  })

  it('updates only the saved list when multiple exist', async () => {
    const list2: WordList = { ...list, id: 'l2', name: 'Week 6' }
    getLists.mockResolvedValue([list, list2])
    updateList.mockResolvedValue({ ...list, name: 'Renamed' })
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })

    // Edit the first list
    const editButtons = screen.getAllByRole('button', { name: 'Edit' })
    fireEvent.click(editButtons[0])
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }))

    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ name: 'Renamed' }))
    })
    // Return to overview; the other list is untouched
    fireEvent.click(screen.getByRole('button', { name: 'All lists' }))
    await waitFor(() => {
      expect(screen.getByText('Week 6')).toBeInTheDocument()
    })
  })

  it('shows an error when save fails', async () => {
    getLists.mockResolvedValue([list])
    updateList.mockRejectedValue(new Error('save failed'))
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('save failed')
    })
  })

  it('shows a generic error when save throws a non-Error', async () => {
    getLists.mockResolvedValue([list])
    updateList.mockRejectedValue('string failure')
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to save list')
    })
  })

  it('updates the grade level in the editor', async () => {
    getLists.mockResolvedValue([list])
    updateList.mockResolvedValue(list)
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const gradeInput = screen.getByLabelText('Grade level (optional)')
    fireEvent.change(gradeInput, { target: { value: '2' } })
    expect(gradeInput).toHaveValue('2')
    // Clearing the grade sets it to undefined
    fireEvent.change(gradeInput, { target: { value: '' } })
    expect(gradeInput).toHaveValue('')
  })

  it('deletes a list after confirmation', async () => {
    getLists.mockResolvedValue([list])
    deleteList.mockResolvedValue(undefined)
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(screen.getByText('Delete word list?')).toBeInTheDocument()
    })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(deleteList).toHaveBeenCalledWith('l1')
    })
  })

  it('shows deleting state while delete is in progress', async () => {
    let resolveDelete: () => void
    const deletePromise = new Promise<void>((resolve) => {
      resolveDelete = resolve
    })
    getLists.mockResolvedValue([list])
    deleteList.mockReturnValue(deletePromise)
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(screen.getByText('Delete word list?')).toBeInTheDocument()
    })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(screen.getByText('Deleting...')).toBeInTheDocument()
    })
    resolveDelete!()
    await waitFor(() => {
      expect(screen.queryByText('Week 5: Long A')).not.toBeInTheDocument()
    })
  })

  it('shows an error when delete fails', async () => {
    getLists.mockResolvedValue([list])
    deleteList.mockRejectedValue(new Error('delete failed'))
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(screen.getByText('Delete word list?')).toBeInTheDocument()
    })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('delete failed')
    })
  })

  it('shows a generic error when delete throws a non-Error', async () => {
    getLists.mockResolvedValue([list])
    deleteList.mockRejectedValue('string failure')
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(screen.getByText('Delete word list?')).toBeInTheDocument()
    })
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Failed to delete list')
    })
  })

  it('does not delete when confirmation is cancelled', async () => {
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(screen.getByText('Delete word list?')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(deleteList).not.toHaveBeenCalled()
  })

  it('closes the dialog when Escape is pressed', async () => {
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(screen.getByText('Delete word list?')).toBeInTheDocument()
    })
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByText('Delete word list?')).not.toBeInTheDocument()
    })
    expect(deleteList).not.toHaveBeenCalled()
  })

  it('returns to the list overview from the editor', async () => {
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(screen.getByLabelText('List name')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'All lists' }))
    expect(screen.getByText('My word lists (1)')).toBeInTheDocument()
  })
})
