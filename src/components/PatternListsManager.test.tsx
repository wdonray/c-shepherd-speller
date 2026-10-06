import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import PatternListsManager from './PatternListsManager'
import type { WordList, SpellingPattern } from '@/models/WordList'

const { getLists, createList, updateList, deleteList, notifyListsChanged, logActivity } = vi.hoisted(() => ({
  getLists: vi.fn(),
  createList: vi.fn(),
  updateList: vi.fn(),
  deleteList: vi.fn(),
  notifyListsChanged: vi.fn(),
  logActivity: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({
  getLists,
  createList,
  updateList,
  deleteList,
  notifyListsChanged,
  LISTS_CHANGED_EVENT: 'shepherd-speller:lists-changed',
}))
vi.mock('@/lib/activity', () => ({ logActivity }))

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const patternA: SpellingPattern = {
  id: 'p1',
  sound: 'long a',
  pattern: 'a_e',
  frequency: 'common',
  words: ['cake', 'bake'],
}
const patternB: SpellingPattern = {
  id: 'p2',
  sound: 'long a',
  pattern: 'ay',
  frequency: 'rare',
  words: ['day'],
}

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5: Long A',
  gradeLevel: '1',
  patterns: [patternA],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}
const list2: WordList = {
  id: 'l2',
  userId: 'u1',
  name: 'Week 6',
  patterns: [patternB],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

async function openFirstListEditor() {
  fireEvent.click((await screen.findAllByRole('button', { name: 'Open' }))[0])
  await screen.findByText('Spelling patterns (1)')
}

describe('PatternListsManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows loading skeletons, then the lists', async () => {
    getLists.mockResolvedValue([list, list2])
    render(<PatternListsManager />)

    expect(screen.getByRole('status', { name: 'Loading word lists' })).toHaveTextContent('Loading your word lists...')
    await waitFor(() => {
      expect(screen.getByText('My word lists (2)')).toBeInTheDocument()
    })
    expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
  })

  it('shows an error card and retries when loading fails', async () => {
    getLists.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce([list])
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('Could not load your lists')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => {
      expect(screen.getByText('My word lists (1)')).toBeInTheDocument()
    })
    expect(getLists).toHaveBeenCalledTimes(2)
  })

  it('shows the empty state when there are no lists', async () => {
    getLists.mockResolvedValue([])
    render(<PatternListsManager />)

    await waitFor(() => {
      expect(screen.getByText('No word lists yet')).toBeInTheDocument()
    })
  })

  it('opens the create dialog from the overview', async () => {
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)

    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('button', { name: 'New list' }))

    expect(screen.getByRole('heading', { name: 'New word list' })).toBeInTheDocument()
    expect(screen.getByText('Name it for the sound and week you are teaching.')).toBeInTheDocument()
  })

  it('cancelling the create dialog clears the form', async () => {
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)

    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('button', { name: 'New list' }))
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Draft' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    fireEvent.click(screen.getByRole('button', { name: 'New list' }))
    expect(screen.getByLabelText('List name')).toHaveValue('')
  })

  it('creates a list with a grade and opens its editor', async () => {
    getLists.mockResolvedValue([list])
    const created: WordList = { ...list, id: 'l9', name: 'Week 7: Long O', gradeLevel: '2', patterns: [] }
    createList.mockResolvedValue(created)
    render(<PatternListsManager />)

    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('button', { name: 'New list' }))
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Week 7: Long O' } })
    fireEvent.change(screen.getByLabelText('Grade level (optional)'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }))

    await waitFor(() => {
      expect(createList).toHaveBeenCalledWith({ name: 'Week 7: Long O', gradeLevel: '2', patterns: [] })
    })
    expect(logActivity).toHaveBeenCalledWith('created', 'Week 7: Long O')
    expect(notifyListsChanged).toHaveBeenCalled()
    expect(await screen.findByText('No patterns yet')).toBeInTheDocument()
    expect(screen.getByText('Grade 2')).toBeInTheDocument()
  })

  it('creates a list without a grade', async () => {
    getLists.mockResolvedValue([])
    const created: WordList = { ...list, id: 'l9', name: 'Week 7', patterns: [] }
    delete created.gradeLevel
    createList.mockResolvedValue(created)
    render(<PatternListsManager />)

    await screen.findByText('No word lists yet')
    // The empty state has its own New list button after the header one.
    fireEvent.click(screen.getAllByRole('button', { name: 'New list' })[1])
    expect(screen.getByRole('heading', { name: 'New word list' })).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Week 7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }))

    await waitFor(() => {
      expect(createList).toHaveBeenCalledWith({ name: 'Week 7', gradeLevel: undefined, patterns: [] })
    })
  })

  it('shows a toast when creating fails', async () => {
    getLists.mockResolvedValue([list])
    createList.mockRejectedValue(new Error('network down'))
    render(<PatternListsManager />)

    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('button', { name: 'New list' }))
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Week 7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create list' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not create the list.')
    })
    expect(screen.queryByRole('heading', { name: 'New word list' })).not.toBeInTheDocument()
  })

  it('returns to the overview from the editor', async () => {
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)

    await openFirstListEditor()
    fireEvent.click(screen.getByRole('button', { name: 'My lists' }))

    await waitFor(() => {
      expect(screen.getByText('My word lists (1)')).toBeInTheDocument()
    })
  })

  it('shows the editor heading, grade, and explainer', async () => {
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)

    await openFirstListEditor()
    expect(screen.getByRole('heading', { name: 'Week 5: Long A' })).toBeInTheDocument()
    expect(screen.getByText('Grade 1')).toBeInTheDocument()
    expect(screen.getByText(/One column per spelling/)).toBeInTheDocument()
  })

  it('marks the form dirty when the name changes and Cancel reverts it', async () => {
    getLists.mockResolvedValue([{ ...list }])
    render(<PatternListsManager />)

    await openFirstListEditor()
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Renamed' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByLabelText('List name')).toHaveValue('Week 5: Long A')
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  })

  it('shows Untitled list when the name is cleared', async () => {
    getLists.mockResolvedValue([{ ...list }])
    render(<PatternListsManager />)

    await openFirstListEditor()
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: '' } })
    expect(screen.getByRole('heading', { name: 'Untitled list' })).toBeInTheDocument()
  })

  it('edits and clears the grade level', async () => {
    getLists.mockResolvedValue([{ ...list }])
    updateList.mockImplementation(async (_id: string, data: Partial<WordList>) => ({ ...list, ...data }))
    render(<PatternListsManager />)

    await openFirstListEditor()
    const grade = screen.getByLabelText('Grade level')
    fireEvent.change(grade, { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }))
    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ gradeLevel: '2' }))
    })

    fireEvent.change(screen.getByLabelText('Grade level'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }))
    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ gradeLevel: undefined }))
    })
  })

  it('adds the first pattern from the empty state', async () => {
    const empty: WordList = { ...list, patterns: [] }
    getLists.mockResolvedValue([empty])
    render(<PatternListsManager />)

    fireEvent.click((await screen.findAllByRole('button', { name: 'Open' }))[0])
    await screen.findByText('Spelling patterns (0)')
    expect(screen.getByText('No patterns yet')).toBeInTheDocument()
    expect(
      screen.getByText('Add your first pattern: the target sound, one spelling, and how common it is.')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add a pattern' }))
    expect(screen.getByLabelText('Pattern spelling')).toBeInTheDocument()
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  })

  it('adds a pattern with the full-width button', async () => {
    getLists.mockResolvedValue([{ ...list }])
    render(<PatternListsManager />)

    await openFirstListEditor()
    fireEvent.click(screen.getByRole('button', { name: '+ Add a pattern' }))
    const inputs = screen.getAllByLabelText('Pattern spelling')
    expect(inputs).toHaveLength(2)
  })

  it('edits a pattern through its card and saves', async () => {
    getLists.mockResolvedValue([{ ...list, patterns: [{ ...patternA }] }])
    updateList.mockImplementation(async (_id: string, data: Partial<WordList>) => ({ ...list, ...data }))
    render(<PatternListsManager />)

    await openFirstListEditor()
    fireEvent.change(screen.getByLabelText('Pattern spelling'), { target: { value: 'ai' } })
    fireEvent.change(screen.getByLabelText('New word'), { target: { value: 'rain' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))

    fireEvent.click(screen.getByRole('button', { name: 'Save list' }))
    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({
          patterns: [expect.objectContaining({ pattern: 'ai', words: ['cake', 'bake', 'rain'] })],
        })
      )
    })
    expect(notifyListsChanged).toHaveBeenCalled()
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  })

  it('disables Save when clean or the name is empty', async () => {
    getLists.mockResolvedValue([{ ...list }])
    render(<PatternListsManager />)

    await openFirstListEditor()
    expect(screen.getByRole('button', { name: 'Save list' })).toBeDisabled()

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: '' } })
    expect(screen.getByRole('button', { name: 'Save list' })).toBeDisabled()
  })

  it('shows a toast when saving fails', async () => {
    getLists.mockResolvedValue([{ ...list }])
    updateList.mockRejectedValue(new Error('network down'))
    render(<PatternListsManager />)

    await openFirstListEditor()
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not save.')
    })
  })

  it('dismisses the toast manually', async () => {
    getLists.mockResolvedValue([{ ...list }])
    updateList.mockRejectedValue(new Error('network down'))
    render(<PatternListsManager />)

    await openFirstListEditor()
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }))
    await screen.findByRole('alert')

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('auto-dismisses the toast after six seconds', async () => {
    vi.useFakeTimers()
    getLists.mockResolvedValue([{ ...list }])
    updateList.mockRejectedValue(new Error('network down'))
    render(<PatternListsManager />)
    await act(async () => {})

    fireEvent.click(screen.getAllByRole('button', { name: 'Open' })[0])
    await act(async () => {})
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }))
    await act(async () => {})
    expect(screen.getByRole('alert')).toHaveTextContent('Could not save.')

    act(() => {
      vi.advanceTimersByTime(6000)
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('confirms and deletes a pattern', async () => {
    getLists.mockResolvedValue([{ ...list, patterns: [{ ...patternA }] }])
    render(<PatternListsManager />)

    await openFirstListEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Delete pattern a_e' }))

    expect(screen.getByRole('heading', { name: 'Delete this pattern?' })).toBeInTheDocument()
    expect(
      screen.getByText('Delete "a_e" with its 2 words? This cannot be undone. The rest of the list is untouched.')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(screen.getByText('No patterns yet')).toBeInTheDocument()
    })
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  })

  it('closes the pattern delete dialog with Escape', async () => {
    getLists.mockResolvedValue([{ ...list, patterns: [{ ...patternA }] }])
    render(<PatternListsManager />)

    await openFirstListEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Delete pattern a_e' }))
    await screen.findByRole('heading', { name: 'Delete this pattern?' })

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete this pattern?' })).not.toBeInTheDocument()
    })
    expect(screen.getByLabelText('Pattern spelling')).toHaveValue('a_e')
  })

  it('deletes an untitled pattern', async () => {
    getLists.mockResolvedValue([{ ...list, patterns: [{ ...patternA }] }])
    render(<PatternListsManager />)

    await openFirstListEditor()
    fireEvent.click(screen.getByRole('button', { name: '+ Add a pattern' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete this pattern' }))

    expect(
      screen.getByText('Delete "untitled" with its 0 words? This cannot be undone. The rest of the list is untouched.')
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(screen.getAllByLabelText('Pattern spelling')).toHaveLength(1)
    })
  })

  it('updates only the edited pattern when saving', async () => {
    getLists.mockResolvedValue([{ ...list, patterns: [{ ...patternA }, { ...patternB }] }])
    updateList.mockImplementation(async (_id: string, data: Partial<WordList>) => ({ ...list, ...data }))
    render(<PatternListsManager />)

    await screen.findByText('My word lists (1)')
    fireEvent.click((await screen.findAllByRole('button', { name: 'Open' }))[0])
    await screen.findByText('Spelling patterns (2)')

    fireEvent.change(screen.getAllByLabelText('Pattern spelling')[0], { target: { value: 'ai' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }))

    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({
          patterns: [
            expect.objectContaining({ id: 'p1', pattern: 'ai' }),
            expect.objectContaining({ id: 'p2', pattern: 'ay' }),
          ],
        })
      )
    })
  })

  it('keeps the pattern when the pattern delete is cancelled', async () => {
    getLists.mockResolvedValue([{ ...list, patterns: [{ ...patternA }] }])
    render(<PatternListsManager />)

    await openFirstListEditor()
    fireEvent.click(screen.getByRole('button', { name: 'Delete pattern a_e' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete this pattern?' })).not.toBeInTheDocument()
    })
    expect(screen.getByLabelText('Pattern spelling')).toHaveValue('a_e')
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  })

  it('uses the singular when deleting a one-word pattern', async () => {
    getLists.mockResolvedValue([{ ...list2 }])
    render(<PatternListsManager />)

    await screen.findByText('My word lists (1)')
    fireEvent.click((await screen.findAllByRole('button', { name: 'Open' }))[0])
    await screen.findByText('Spelling patterns (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Delete pattern ay' }))

    expect(
      screen.getByText('Delete "ay" with its 1 word? This cannot be undone. The rest of the list is untouched.')
    ).toBeInTheDocument()
  })

  it('confirms and deletes a list', async () => {
    getLists.mockResolvedValue([list, list2])
    deleteList.mockResolvedValue(undefined)
    render(<PatternListsManager />)

    await screen.findByText('My word lists (2)')
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete' })[0])

    expect(screen.getByRole('heading', { name: 'Delete this list?' })).toBeInTheDocument()
    expect(
      screen.getByText('Delete "Week 5: Long A" with its 1 pattern and 2 words? This cannot be undone.')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(deleteList).toHaveBeenCalledWith('l1')
    })
    expect(notifyListsChanged).toHaveBeenCalled()
    await waitFor(() => {
      expect(screen.getByText('My word lists (1)')).toBeInTheDocument()
    })
    expect(screen.queryByText('Week 5: Long A')).not.toBeInTheDocument()
  })

  it('uses singular counts in the list delete dialog', async () => {
    getLists.mockResolvedValue([list2])
    render(<PatternListsManager />)

    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(
      screen.getByText('Delete "Week 6" with its 1 pattern and 1 word? This cannot be undone.')
    ).toBeInTheDocument()
  })

  it('closes the list delete dialog with Escape', async () => {
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)

    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await screen.findByRole('heading', { name: 'Delete this list?' })

    fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete this list?' })).not.toBeInTheDocument()
    })
    expect(deleteList).not.toHaveBeenCalled()
  })

  it('uses the plural when deleting a multi-pattern list', async () => {
    const big: WordList = { ...list, patterns: [{ ...patternA }, { ...patternB }] }
    getLists.mockResolvedValue([big])
    deleteList.mockResolvedValue(undefined)
    render(<PatternListsManager />)

    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(
      screen.getByText('Delete "Week 5: Long A" with its 2 patterns and 3 words? This cannot be undone.')
    ).toBeInTheDocument()
  })

  it('updates only the saved list when several exist', async () => {
    getLists.mockResolvedValue([{ ...list }, { ...list2 }])
    updateList.mockImplementation(async (id: string, data: Partial<WordList>) => ({
      ...(id === 'l1' ? list : list2),
      ...data,
    }))
    render(<PatternListsManager />)

    await screen.findByText('My word lists (2)')
    fireEvent.click((await screen.findAllByRole('button', { name: 'Open' }))[0])
    await screen.findByText('Spelling patterns (1)')

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save list' }))

    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ name: 'Renamed' }))
    })
    expect(screen.getByText('No unsaved changes')).toBeInTheDocument()
  })

  it('dismisses the overview toast manually', async () => {
    getLists.mockResolvedValue([list])
    deleteList.mockRejectedValue(new Error('network down'))
    render(<PatternListsManager />)

    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('keeps the list when the list delete is cancelled', async () => {
    getLists.mockResolvedValue([list])
    render(<PatternListsManager />)

    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete this list?' })).not.toBeInTheDocument()
    })
    expect(deleteList).not.toHaveBeenCalled()
    expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
  })

  it('shows a toast when deleting a list fails', async () => {
    getLists.mockResolvedValue([list])
    deleteList.mockRejectedValue(new Error('network down'))
    render(<PatternListsManager />)

    await screen.findByText('My word lists (1)')
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not delete the list.')
    })
    expect(screen.getByText('Week 5: Long A')).toBeInTheDocument()
  })
})
