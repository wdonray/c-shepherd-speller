import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import PrebuiltWeekActions from './PrebuiltWeekActions'
import { getPrebuiltWeek } from '@/lib/prebuilt-lists'
import type { WordList } from '@/models/WordList'

const { createList, notifyListsChanged } = vi.hoisted(() => ({
  createList: vi.fn(),
  notifyListsChanged: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({ createList, notifyListsChanged }))

const { mockPush } = vi.hoisted(() => ({ mockPush: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}))

vi.mock('./PullPatternsModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="pull-patterns-modal">
      <button type="button" onClick={onClose}>
        Close modal
      </button>
    </div>
  ),
}))

const week = getPrebuiltWeek('prebuilt-g2-w06')!

function makeList(overrides: Partial<WordList> = {}): WordList {
  return {
    id: 'list_new_1',
    userId: 'u1',
    name: 'Grade 2 - Week 6',
    patterns: [],
    createdAt: '2026-10-18T00:00:00.000Z',
    updatedAt: '2026-10-18T00:00:00.000Z',
    ...overrides,
  }
}

describe('PrebuiltWeekActions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the copy and pull buttons', () => {
    render(<PrebuiltWeekActions week={week} />)
    expect(screen.getByRole('button', { name: 'Copy to my lists' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add patterns to...' })).toBeInTheDocument()
  })

  it('groups the actions into "Make it yours" and a "Try it" segmented set (issue #487)', () => {
    render(<PrebuiltWeekActions week={week} />)

    // "Make it yours" owns exactly the two take-the-content actions.
    const ownGroup = screen.getByRole('group', { name: 'Make it yours' })
    expect(within(ownGroup).getByRole('button', { name: 'Copy to my lists' })).toBeInTheDocument()
    expect(within(ownGroup).getByRole('button', { name: 'Add patterns to...' })).toBeInTheDocument()
    expect(within(ownGroup).getAllByRole('button')).toHaveLength(2)

    // "Try it" owns exactly the three try-before-you-copy actions as one set.
    const tryGroup = screen.getByRole('group', { name: 'Try it' })
    expect(within(tryGroup).getByRole('button', { name: 'Present' })).toBeInTheDocument()
    expect(within(tryGroup).getByRole('button', { name: 'Practice' })).toBeInTheDocument()
    expect(within(tryGroup).getByRole('button', { name: 'Worksheets' })).toBeInTheDocument()
    expect(within(tryGroup).getAllByRole('button')).toHaveLength(3)

    // Each visible caption labels its group (accessible name comes from it).
    expect(tryGroup.getAttribute('aria-labelledby')).toBe(
      screen.getByText('Try it', { selector: 'p' }).getAttribute('id')
    )
    expect(ownGroup.getAttribute('aria-labelledby')).toBe(
      screen.getByText('Make it yours', { selector: 'p' }).getAttribute('id')
    )
  })

  it('copies the week and shows a confirmation naming the new list', async () => {
    const newList = makeList()
    createList.mockResolvedValue(newList)
    render(<PrebuiltWeekActions week={week} />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy to my lists' }))
    expect(screen.getByRole('button', { name: 'Copying...' })).toBeDisabled()

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Grade 2 - Week 6 is now in your lists')
    })

    // The create payload carries the week's patterns (without ids) and the
    // grade/week metadata.
    expect(createList).toHaveBeenCalledWith({
      name: 'Grade 2 - Week 6',
      gradeLevel: 'Grade 2',
      week: '6',
      patterns: week.patterns.map((p) => ({
        sound: p.sound,
        pattern: p.pattern,
        frequency: p.frequency,
        words: p.words,
      })),
    })
    expect(notifyListsChanged).toHaveBeenCalled()

    // The confirmation restates what she got (Phase A research).
    const status = screen.getByRole('status')
    const wordCount = week.patterns.reduce((sum, p) => sum + p.words.length, 0)
    expect(status).toHaveTextContent(`${week.patterns.length} patterns`)
    expect(status).toHaveTextContent(`${wordCount} words`)

    fireEvent.click(screen.getByRole('button', { name: 'Open my list' }))
    expect(mockPush).toHaveBeenCalledWith('/lists/list_new_1')
  })

  it('shows an inline error with retry when copying fails', async () => {
    createList.mockRejectedValueOnce(new Error('nope')).mockResolvedValueOnce(makeList())
    render(<PrebuiltWeekActions week={week} />)

    fireEvent.click(screen.getByRole('button', { name: 'Copy to my lists' }))
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not copy the list')
    })

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('is now in your lists')
    })
    expect(createList).toHaveBeenCalledTimes(2)
  })

  it('opens and closes the pull-patterns modal', async () => {
    render(<PrebuiltWeekActions week={week} />)
    expect(screen.queryByTestId('pull-patterns-modal')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Add patterns to...' }))
    expect(screen.getByTestId('pull-patterns-modal')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close modal' }))
    await waitFor(() => {
      expect(screen.queryByTestId('pull-patterns-modal')).not.toBeInTheDocument()
    })
  })
})

describe('PrebuiltWeekActions use-this-week buttons (issue #463, Phase C)', () => {
  it('navigates to present, practice, and worksheets for the week', () => {
    render(<PrebuiltWeekActions week={week} />)

    fireEvent.click(screen.getByRole('button', { name: 'Present' }))
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/display?prebuilt='))

    fireEvent.click(screen.getByRole('button', { name: 'Practice' }))
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/practice?prebuilt='))

    fireEvent.click(screen.getByRole('button', { name: 'Worksheets' }))
    expect(mockPush).toHaveBeenCalledWith(expect.stringContaining('/lists/prebuilt/'))
  })
})
