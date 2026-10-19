import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import PullPatternsModal from './PullPatternsModal'
import { getPrebuiltWeek } from '@/lib/prebuilt-lists'
import type { SpellingPattern, WordList } from '@/models/WordList'

const { getLists, createList, updateList, notifyListsChanged } = vi.hoisted(() => ({
  getLists: vi.fn(),
  createList: vi.fn(),
  updateList: vi.fn(),
  notifyListsChanged: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({ getLists, createList, updateList, notifyListsChanged }))

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

const week = getPrebuiltWeek('prebuilt-g2-w06')!

function makePattern(overrides: Partial<SpellingPattern> = {}): SpellingPattern {
  return {
    id: 'p1',
    sound: 'long a',
    pattern: 'ai',
    frequency: 'common',
    words: ['rain', 'train'],
    ...overrides,
  }
}

function makeList(overrides: Partial<WordList> = {}): WordList {
  return {
    id: 'list_1',
    userId: 'u1',
    name: 'My Spelling List',
    patterns: [makePattern()],
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
    ...overrides,
  }
}

const onClose = vi.fn()

describe('PullPatternsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a loading state, then the target picker and pattern checkboxes', async () => {
    getLists.mockResolvedValue([makeList()])
    render(<PullPatternsModal week={week} onClose={onClose} />)

    expect(screen.getByRole('status', { name: 'Loading your lists' })).toBeInTheDocument()

    await waitFor(() => {
      expect(screen.getByText('My Spelling List')).toBeInTheDocument()
    })
    // Every prebuilt pattern renders as a checkbox with the chip visual.
    for (const p of week.patterns) {
      const checkbox = screen.getByRole('checkbox', { name: `${p.pattern}, ${p.sound}` })
      expect(checkbox).toBeChecked()
    }
    expect(screen.getByText('Create a new list')).toBeInTheDocument()
  })

  it('shows a load error with retry when fetching lists fails', async () => {
    getLists.mockRejectedValueOnce(new Error('nope')).mockResolvedValueOnce([makeList()])
    render(<PullPatternsModal week={week} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not load your lists')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => {
      expect(screen.getByText('My Spelling List')).toBeInTheDocument()
    })
    expect(getLists).toHaveBeenCalledTimes(2)
  })

  it('offers only create-new when the teacher has no lists', async () => {
    getLists.mockResolvedValue([])
    render(<PullPatternsModal week={week} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByLabelText('New list name')).toBeInTheDocument()
    })
    expect(screen.queryByText('Add to')).not.toBeInTheDocument()
    expect(screen.getByLabelText('New list name')).toHaveValue('Grade 2 - Week 6')
  })

  it('creates a new list with the checked patterns', async () => {
    getLists.mockResolvedValue([makeList()])
    const created = makeList({ id: 'list_new_9', name: 'My pull' })
    createList.mockResolvedValue(created)
    render(<PullPatternsModal week={week} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('My Spelling List')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('radio', { name: 'Create a new list' }))
    fireEvent.change(screen.getByLabelText('New list name'), { target: { value: 'My pull' } })

    // Uncheck the first pattern.
    const first = week.patterns[0]
    fireEvent.click(screen.getByRole('checkbox', { name: `${first.pattern}, ${first.sound}` }))

    const addButton = screen.getByRole('button', { name: `Add ${week.patterns.length - 1} patterns` })
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Added')
    })
    expect(createList).toHaveBeenCalledWith({
      name: 'My pull',
      gradeLevel: 'Grade 2',
      patterns: week.patterns.slice(1).map((p) => ({
        sound: p.sound,
        pattern: p.pattern,
        frequency: p.frequency,
        words: p.words,
      })),
    })
    expect(notifyListsChanged).toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Open list' }))
    expect(mockPush).toHaveBeenCalledWith('/lists/list_new_9')
  })

  it('merges checked patterns into an existing list', async () => {
    // Target list has no overlapping pairs, so nothing is skipped.
    const target = makeList({
      id: 'list_2',
      name: 'Target',
      patterns: [makePattern({ id: 'px', sound: 'short a', pattern: 'a' })],
    })
    getLists.mockResolvedValue([target])
    const updated = { ...target, patterns: [...target.patterns, makePattern({ id: 'p_new' })] }
    updateList.mockResolvedValue(updated)
    render(<PullPatternsModal week={week} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('Target')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: `Add ${week.patterns.length} patterns to Target` }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Added')
    })
    expect(updateList).toHaveBeenCalledWith(
      'list_2',
      expect.objectContaining({
        patterns: expect.arrayContaining([
          expect.objectContaining({ id: 'px' }),
          expect.objectContaining({ pattern: week.patterns[0].pattern }),
        ]),
      })
    )
    // New patterns get generated ids.
    const sent = updateList.mock.calls[0][1].patterns
    const added = sent.filter((p: SpellingPattern) => p.id !== 'px')
    expect(added).toHaveLength(week.patterns.length)
    for (const p of added) {
      expect(p.id).toMatch(/^pat_/)
    }
  })

  it('skips duplicate pattern pairs with a visible reason', async () => {
    // The target already has the week's first pattern pair.
    const first = week.patterns[0]
    const target = makeList({
      id: 'list_3',
      name: 'Target',
      patterns: [makePattern({ id: 'pd', sound: first.sound, pattern: first.pattern })],
    })
    getLists.mockResolvedValue([target])
    updateList.mockResolvedValue(target)
    render(<PullPatternsModal week={week} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('Target')).toBeInTheDocument()
    })

    // The duplicate is named inline and in the summary notice.
    expect(screen.getByRole('status')).toHaveTextContent('1 pattern already in Target, so it will be skipped')

    const addButton = screen.getByRole('button', { name: `Add ${week.patterns.length - 1} patterns to Target` })
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Added')
    })
    const sent = updateList.mock.calls[0][1].patterns
    // Existing pattern plus all but the duplicate.
    expect(sent).toHaveLength(1 + week.patterns.length - 1)
    expect(screen.getByText('1 pattern skipped: already in the list.')).toBeInTheDocument()
  })

  it('blocks confirming when the 20-pattern cap would be exceeded', async () => {
    const many = Array.from({ length: 19 }, (_, i) =>
      makePattern({ id: `p${i}`, sound: `sound ${i}`, pattern: `zz${i}` })
    )
    const target = makeList({ id: 'list_4', name: 'Full', patterns: many })
    getLists.mockResolvedValue([target])
    render(<PullPatternsModal week={week} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('Full')).toBeInTheDocument()
    })

    expect(screen.getByRole('alert')).toHaveTextContent('Lists hold up to 20 patterns')
    const addButton = screen.getByRole('button', { name: `Add ${week.patterns.length} patterns to Full` })
    expect(addButton).toBeDisabled()
    expect(updateList).not.toHaveBeenCalled()
  })

  it('switches the target to another existing list', async () => {
    const first = makeList({ id: 'list_a', name: 'First' })
    const second = makeList({ id: 'list_b', name: 'Second', patterns: [] })
    getLists.mockResolvedValue([first, second])
    updateList.mockResolvedValue(second)
    render(<PullPatternsModal week={week} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('Second')).toBeInTheDocument()
    })

    // Switch the radio from the default (First) to Second.
    fireEvent.click(screen.getByRole('radio', { name: /Second/ }))

    fireEvent.click(screen.getByRole('button', { name: `Add ${week.patterns.length} patterns to Second` }))

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Added')
    })
    expect(updateList).toHaveBeenCalledWith('list_b', expect.objectContaining({ patterns: expect.any(Array) }))
    expect(screen.getByRole('status')).toHaveTextContent('Second')
  })

  it('disables confirm when no patterns are checked', async () => {
    getLists.mockResolvedValue([makeList()])
    render(<PullPatternsModal week={week} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByText('My Spelling List')).toBeInTheDocument()
    })

    for (const p of week.patterns) {
      fireEvent.click(screen.getByRole('checkbox', { name: `${p.pattern}, ${p.sound}` }))
    }

    const addButton = screen.getByRole('button', { name: 'Add 0 patterns to My Spelling List' })
    expect(addButton).toBeDisabled()
  })

  it('returns to the picker with selections intact when saving fails', async () => {
    getLists.mockResolvedValue([])
    createList.mockRejectedValueOnce(new Error('nope')).mockResolvedValueOnce(makeList({ id: 'list_new_2' }))
    render(<PullPatternsModal week={week} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByLabelText('New list name')).toBeInTheDocument()
    })

    const first = week.patterns[0]
    fireEvent.click(screen.getByRole('checkbox', { name: `${first.pattern}, ${first.sound}` }))

    fireEvent.click(screen.getByRole('button', { name: `Add ${week.patterns.length - 1} patterns` }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not add the patterns')
    })

    // The unchecked pattern stays unchecked; retry succeeds.
    expect(screen.getByRole('checkbox', { name: `${first.pattern}, ${first.sound}` })).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: `Add ${week.patterns.length - 1} patterns` }))
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Added')
    })
  })

  it('closes the modal from the done view', async () => {
    getLists.mockResolvedValue([])
    createList.mockResolvedValue(makeList({ id: 'list_new_3' }))
    render(<PullPatternsModal week={week} onClose={onClose} />)

    await waitFor(() => {
      expect(screen.getByLabelText('New list name')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByRole('button', { name: `Add ${week.patterns.length} patterns` }))
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Added')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onClose).toHaveBeenCalled()
  })
})
