import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ListEditorPage from './ListEditorPage'
import type { WordList, SpellingPattern } from '@/models/WordList'

const { getList, updateList, notifyListsChanged } = vi.hoisted(() => ({
  getList: vi.fn(),
  updateList: vi.fn(),
  notifyListsChanged: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({
  getList,
  updateList,
  notifyListsChanged,
  LISTS_CHANGED_EVENT: 'shepherd-speller:lists-changed',
}))

vi.mock('@/lib/example-sentences', () => ({
  fetchExampleSentences: vi.fn().mockResolvedValue(['We baked a cake.']),
}))

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

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5: Long A',
  gradeLevel: '1',
  patterns: [patternA],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

async function renderReady(overrides: Partial<WordList> = {}) {
  getList.mockResolvedValue({ ...list, ...overrides })
  render(<ListEditorPage listId="l1" />)
  await screen.findByRole('heading', { name: 'Week 5: Long A' })
}

/** Wait for the 500ms auto-save debounce plus the mocked save round-trip. */
async function waitForSave() {
  await waitFor(() => expect(updateList).toHaveBeenCalled(), { timeout: 3000 })
  await waitFor(() => expect(screen.queryByText('Saving...')).not.toBeInTheDocument(), { timeout: 3000 })
}

describe('ListEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a loading skeleton, then the editor', async () => {
    getList.mockResolvedValue(list)
    render(<ListEditorPage listId="l1" />)

    expect(screen.getByRole('status', { name: 'Loading list editor' })).toBeInTheDocument()
    await screen.findByRole('heading', { name: 'Week 5: Long A' })
    expect(screen.getByText('Grade 1')).toBeInTheDocument()
    expect(screen.getByText('Spelling patterns (1)')).toBeInTheDocument()
  })

  it('shows a not-found page for an unknown list id', async () => {
    getList.mockRejectedValue(new Error('List not found'))
    render(<ListEditorPage listId="nope" />)

    await screen.findByRole('heading', { name: 'List not found' })
    expect(screen.getByText('This word list does not exist or was deleted.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to my lists' })).toHaveAttribute('href', '/')
  })

  it('shows an error card and retries when loading fails', async () => {
    getList.mockRejectedValueOnce(new Error('network down')).mockResolvedValueOnce(list)
    render(<ListEditorPage listId="l1" />)

    await screen.findByRole('heading', { name: 'Could not load this list' })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await screen.findByRole('heading', { name: 'Week 5: Long A' })
    expect(getList).toHaveBeenCalledTimes(2)
  })

  it('shows not-found after a retry that 404s', async () => {
    getList.mockRejectedValueOnce(new Error('network down')).mockRejectedValueOnce(new Error('List not found'))
    render(<ListEditorPage listId="l1" />)

    await screen.findByRole('heading', { name: 'Could not load this list' })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await screen.findByRole('heading', { name: 'List not found' })
  })

  it('auto-saves the list name after a debounce and shows the saved indicator', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    expect(screen.getByRole('heading', { name: 'Renamed' })).toBeInTheDocument()

    await waitForSave()
    expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ name: 'Renamed' }))
    expect(notifyListsChanged).toHaveBeenCalled()
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('debounces rapid edits into a single save', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    const name = screen.getByLabelText('List name')
    fireEvent.change(name, { target: { value: 'R' } })
    fireEvent.change(name, { target: { value: 'Re' } })
    fireEvent.change(name, { target: { value: 'Renamed' } })

    await waitForSave()
    expect(updateList).toHaveBeenCalledTimes(1)
    expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ name: 'Renamed' }))
  })

  it('does not save when the name is blank', async () => {
    await renderReady()

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: '   ' } })

    // Wait past the debounce; no save should fire.
    await new Promise((r) => setTimeout(r, 700))
    expect(updateList).not.toHaveBeenCalled()
    expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
  })

  it('auto-saves pattern edits', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    fireEvent.change(screen.getByLabelText('Pattern spelling'), { target: { value: 'ai' } })

    await waitForSave()
    expect(updateList).toHaveBeenCalledWith(
      'l1',
      expect.objectContaining({ patterns: [expect.objectContaining({ pattern: 'ai' })] })
    )
  })

  it('adds a pattern from the empty state', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady({ patterns: [] })

    expect(screen.getByText('No patterns yet')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add a pattern' }))

    expect(screen.getByLabelText('Pattern spelling')).toBeInTheDocument()
    await waitForSave()
    expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ patterns: [expect.anything()] }))
  })

  it('confirms and deletes a pattern', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    fireEvent.click(screen.getByRole('button', { name: 'Delete pattern a_e' }))
    expect(screen.getByRole('heading', { name: 'Delete this pattern?' })).toBeInTheDocument()
    expect(
      screen.getByText('Delete "a_e" with its 2 words? This cannot be undone. The rest of the list is untouched.')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete this pattern?' })).not.toBeInTheDocument()
    })
    await waitForSave()
    expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ patterns: [] }))
  })

  it('keeps the pattern when the delete is cancelled', async () => {
    await renderReady()

    fireEvent.click(screen.getByRole('button', { name: 'Delete pattern a_e' }))
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete this pattern?' })).not.toBeInTheDocument()
    })
    expect(screen.getByLabelText('Pattern spelling')).toBeInTheDocument()
    expect(updateList).not.toHaveBeenCalled()
  })

  it('shows an error alert when saving fails and keeps the input', async () => {
    updateList.mockRejectedValue(new Error('network down'))
    await renderReady()

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not save your changes.')
    })
    // The teacher's edit is preserved.
    expect(screen.getByLabelText('List name')).toHaveValue('Renamed')

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('flushes a pending save when leaving the page', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    getList.mockResolvedValue(list)
    const { unmount } = render(<ListEditorPage listId="l1" />)
    await screen.findByRole('heading', { name: 'Week 5: Long A' })

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    // Unmount before the debounce fires; the flush should save directly.
    unmount()

    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ name: 'Renamed' }))
    })
  })

  it('does not save on unmount when nothing is pending', async () => {
    getList.mockResolvedValue(list)
    const { unmount } = render(<ListEditorPage listId="l1" />)
    await screen.findByRole('heading', { name: 'Week 5: Long A' })

    unmount()
    await new Promise((r) => setTimeout(r, 700))
    expect(updateList).not.toHaveBeenCalled()
  })

  it('does not flush a blank name on unmount', async () => {
    getList.mockResolvedValue(list)
    const { unmount } = render(<ListEditorPage listId="l1" />)
    await screen.findByRole('heading', { name: 'Week 5: Long A' })

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: '' } })
    unmount()

    await new Promise((r) => setTimeout(r, 700))
    expect(updateList).not.toHaveBeenCalled()
  })

  it('auto-saves the grade level', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    fireEvent.change(screen.getByLabelText('Grade level'), { target: { value: '2' } })

    await waitForSave()
    expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ gradeLevel: '2' }))
  })

  it('hides the Saved indicator after two seconds', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    await waitForSave()
    expect(screen.getByText('Saved')).toBeInTheDocument()

    await waitFor(
      () => {
        expect(screen.queryByText('Saved')).not.toBeInTheDocument()
      },
      { timeout: 4000 }
    )
  })

  it('clears a pending Saved timer when a new save starts', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    await waitForSave()
    expect(screen.getByText('Saved')).toBeInTheDocument()

    // A second edit before the 2s Saved timer elapses must clear it.
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed again' } })
    await waitFor(() => expect(updateList).toHaveBeenCalledTimes(2), { timeout: 3000 })
    await waitFor(() => expect(screen.queryByText('Saving...')).not.toBeInTheDocument(), { timeout: 3000 })
    expect(screen.getByText('Saved')).toBeInTheDocument()
  })

  it('dismisses the delete dialog with the close button', async () => {
    await renderReady()

    fireEvent.click(screen.getByRole('button', { name: 'Delete pattern a_e' }))
    expect(screen.getByRole('heading', { name: 'Delete this pattern?' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete this pattern?' })).not.toBeInTheDocument()
    })
    expect(updateList).not.toHaveBeenCalled()
  })

  it('shows untitled and singular word count in the delete dialog', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady({
      patterns: [{ ...patternA, pattern: '', words: ['cake'] }],
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete this pattern' }))
    expect(screen.getByRole('heading', { name: 'Delete this pattern?' })).toBeInTheDocument()
    expect(
      screen.getByText('Delete "untitled" with its 1 word? This cannot be undone. The rest of the list is untouched.')
    ).toBeInTheDocument()
  })

  it('swallows a failed flush when leaving the page', async () => {
    updateList.mockRejectedValue(new Error('network down'))
    getList.mockResolvedValue(list)
    const { unmount } = render(<ListEditorPage listId="l1" />)
    await screen.findByRole('heading', { name: 'Week 5: Long A' })

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    // Unmount before the debounce fires; the flush rejects but must not throw.
    unmount()

    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ name: 'Renamed' }))
    })
  })

  it('shows Saving... while a save is in flight', async () => {
    let resolveSave!: (v: unknown) => void
    updateList.mockImplementation(
      () =>
        new Promise((r) => {
          resolveSave = r
        })
    )
    await renderReady()

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })

    await waitFor(
      () => {
        expect(screen.getByText('Saving...')).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
    resolveSave({ ...list, name: 'Renamed' })
    await waitFor(
      () => {
        expect(screen.queryByText('Saving...')).not.toBeInTheDocument()
      },
      { timeout: 3000 }
    )
  })

  it('does not update state if unmounted during load', async () => {
    let resolveLoad!: (v: WordList) => void
    getList.mockImplementation(
      () =>
        new Promise((r) => {
          resolveLoad = r
        })
    )
    const { unmount } = render(<ListEditorPage listId="l1" />)
    expect(screen.getByRole('status', { name: 'Loading list editor' })).toBeInTheDocument()

    unmount()
    resolveLoad(list)
    await new Promise((r) => setTimeout(r, 100))
    // No crash, no state update after unmount.
    expect(updateList).not.toHaveBeenCalled()
  })

  it('does not update state if unmounted during a failing load', async () => {
    let rejectLoad!: (e: Error) => void
    getList.mockImplementation(
      () =>
        new Promise((_, rej) => {
          rejectLoad = rej
        })
    )
    const { unmount } = render(<ListEditorPage listId="l1" />)

    unmount()
    rejectLoad(new Error('network down'))
    await new Promise((r) => setTimeout(r, 100))
    expect(updateList).not.toHaveBeenCalled()
  })

  it('stays on the error card when a retry also fails generically', async () => {
    getList.mockRejectedValue(new Error('network down'))
    render(<ListEditorPage listId="l1" />)

    await screen.findByRole('heading', { name: 'Could not load this list' })
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    await waitFor(() => {
      expect(getList).toHaveBeenCalledTimes(2)
    })
    expect(screen.getByRole('heading', { name: 'Could not load this list' })).toBeInTheDocument()
  })

  it('only updates the edited pattern when several exist', async () => {
    const patternB: SpellingPattern = { ...patternA, id: 'p2', pattern: 'ai' }
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady({ patterns: [patternA, patternB] })

    const selects = screen.getAllByLabelText('Pattern spelling')
    fireEvent.change(selects[0], { target: { value: 'ay' } })

    await waitForSave()
    expect(updateList).toHaveBeenCalledWith(
      'l1',
      expect.objectContaining({
        patterns: [
          expect.objectContaining({ id: 'p1', pattern: 'ay' }),
          expect.objectContaining({ id: 'p2', pattern: 'ai' }),
        ],
      })
    )
  })

  it('renders an empty grade input when the list has no grade level', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady({ gradeLevel: undefined })

    expect(screen.getByLabelText('Grade level')).toHaveValue('')
    expect(screen.queryByText('Grade 1')).not.toBeInTheDocument()
  })

  it('clears the grade level when the input is emptied', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    fireEvent.change(screen.getByLabelText('Grade level'), { target: { value: '' } })

    await waitForSave()
    expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ gradeLevel: undefined }))
  })

  it('links back to the lists overview', async () => {
    await renderReady()
    expect(screen.getByRole('link', { name: 'My lists' })).toHaveAttribute('href', '/')
  })
})
