import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import AddVideoToPatternFlow from './AddVideoToPatternFlow'
import type { PatternVideo, SpellingPattern, WordList } from '@/models/WordList'

const { getLists, updateList, notifyListsChanged } = vi.hoisted(() => ({
  getLists: vi.fn(),
  updateList: vi.fn(),
  notifyListsChanged: vi.fn(),
}))
vi.mock('@/lib/lists-api', () => ({ getLists, updateList, notifyListsChanged }))

const video: PatternVideo = {
  videoId: 'GdmcWQCbqY8',
  title: 'Long A Song',
  channel: 'Jack Hartmann',
  source: 'curated',
}

function makePattern(overrides: Partial<SpellingPattern> = {}): SpellingPattern {
  return {
    id: 'p1',
    sound: 'long a',
    pattern: 'ai',
    frequency: 'common',
    words: ['rain'],
    ...overrides,
  }
}

function makeList(overrides: Partial<WordList> = {}): WordList {
  return {
    id: 'l1',
    userId: 'u1',
    name: 'Week 5: Long A',
    patterns: [makePattern()],
    createdAt: '2026-10-06T00:00:00.000Z',
    updatedAt: '2026-10-06T00:00:00.000Z',
    ...overrides,
  }
}

const list1 = makeList()
const list2 = makeList({
  id: 'l2',
  name: 'Week 6: Long E',
  patterns: [makePattern({ id: 'p2', sound: 'long e', pattern: 'ee' })],
})

function renderFlow(props: { onBack?: () => void; onDone?: () => void } = {}) {
  const onBack = props.onBack ?? vi.fn()
  const onDone = props.onDone ?? vi.fn()
  render(<AddVideoToPatternFlow video={video} onBack={onBack} onDone={onDone} />)
  return { onBack, onDone }
}

function listPicker() {
  return within(screen.getByRole('region', { name: 'Pick a list' }))
}

function patternPicker() {
  return within(screen.getByRole('region', { name: 'Pick a pattern' }))
}

describe('AddVideoToPatternFlow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getLists.mockResolvedValue([list1, list2])
    updateList.mockResolvedValue(list1)
  })

  it('shows a loading spinner while the lists load', () => {
    getLists.mockImplementation(() => new Promise(() => {}))
    renderFlow()
    expect(screen.getByRole('status', { name: 'Loading your lists' })).toBeInTheDocument()
  })

  it('lists her lists with pattern counts after loading', async () => {
    renderFlow()
    const picker = await waitFor(() => listPicker())
    expect(picker.getByRole('button', { name: 'Add to list Week 5: Long A' })).toBeInTheDocument()
    expect(picker.getAllByText('1 pattern')).toHaveLength(2)
    expect(picker.getByRole('button', { name: 'Add to list Week 6: Long E' })).toBeInTheDocument()
  })

  it('pluralizes the pattern count', async () => {
    getLists.mockResolvedValue([
      makeList({ patterns: [makePattern(), makePattern({ id: 'p3', sound: 'long a', pattern: 'ay' })] }),
    ])
    renderFlow()
    const picker = await waitFor(() => listPicker())
    expect(picker.getByText('2 patterns')).toBeInTheDocument()
  })

  it('Back on the list picker returns to the player', async () => {
    const { onBack, onDone } = renderFlow()
    await waitFor(() => listPicker())
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onDone).not.toHaveBeenCalled()
  })

  it('shows a load error with a retry that reloads', async () => {
    getLists.mockRejectedValueOnce(new Error('offline'))
    renderFlow()
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load your lists')
    // The retry runs the fetch again and lands on the list picker.
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(getLists).toHaveBeenCalledTimes(2)
    expect(await screen.findByRole('region', { name: 'Pick a list' })).toBeInTheDocument()
  })

  it('shows an empty state when she has no lists, and Done closes', async () => {
    getLists.mockResolvedValue([])
    const { onBack, onDone } = renderFlow()
    expect(await screen.findByText(/You do not have any lists yet/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onBack).not.toHaveBeenCalled()
  })

  it('Back on the no-lists notice returns to the player', async () => {
    getLists.mockResolvedValue([])
    const { onBack } = renderFlow()
    await screen.findByText(/You do not have any lists yet/)
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it('picking a list shows its patterns with target sounds', async () => {
    renderFlow()
    const picker = await waitFor(() => listPicker())
    fireEvent.click(picker.getByRole('button', { name: 'Add to list Week 6: Long E' }))
    const patterns = patternPicker()
    expect(patterns.getByText('Add to a pattern in Week 6: Long E')).toBeInTheDocument()
    expect(patterns.getByRole('button', { name: 'Add to pattern ee' })).toBeInTheDocument()
    expect(patterns.getByText('long e')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Pick a list' })).not.toBeInTheDocument()
  })

  it('Back on the pattern picker returns to the list picker', async () => {
    renderFlow()
    fireEvent.click((await waitFor(() => listPicker())).getByRole('button', { name: 'Add to list Week 5: Long A' }))
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('region', { name: 'Pick a list' })).toBeInTheDocument()
  })

  it('attaching saves the video to the pattern and shows a success message', async () => {
    const { onDone } = renderFlow()
    fireEvent.click((await waitFor(() => listPicker())).getByRole('button', { name: 'Add to list Week 5: Long A' }))
    fireEvent.click(patternPicker().getByRole('button', { name: 'Add to pattern ai' }))
    expect(screen.getByRole('status', { name: 'Saving the video' })).toBeInTheDocument()
    await waitFor(() => {
      expect(updateList).toHaveBeenCalledTimes(1)
    })
    expect(updateList).toHaveBeenCalledWith('l1', {
      patterns: [expect.objectContaining({ id: 'p1', videos: [video] })],
    })
    expect(notifyListsChanged).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Added to Week 5: Long A, pattern ai.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('leaves the other patterns in the list untouched when saving', async () => {
    const other = makePattern({ id: 'p9', sound: 'long a', pattern: 'ay' })
    getLists.mockResolvedValue([makeList({ patterns: [other, makePattern()] })])
    renderFlow()
    fireEvent.click((await waitFor(() => listPicker())).getByRole('button', { name: 'Add to list Week 5: Long A' }))
    fireEvent.click(patternPicker().getByRole('button', { name: 'Add to pattern ai' }))
    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith('l1', {
        patterns: [other, expect.objectContaining({ id: 'p1', videos: [video] })],
      })
    })
  })

  it('appends to the pattern videos that are already there', async () => {
    const existing: PatternVideo = { videoId: 'ZfbWOTCgRE0', title: 'Old song', source: 'curated' }
    getLists.mockResolvedValue([makeList({ patterns: [makePattern({ videos: [existing] })] })])
    renderFlow()
    fireEvent.click((await waitFor(() => listPicker())).getByRole('button', { name: 'Add to list Week 5: Long A' }))
    fireEvent.click(patternPicker().getByRole('button', { name: 'Add to pattern ai' }))
    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith('l1', {
        patterns: [expect.objectContaining({ videos: [existing, video] })],
      })
    })
  })

  it('shows a notice and does not save when the video is already on the pattern', async () => {
    getLists.mockResolvedValue([makeList({ patterns: [makePattern({ videos: [video] })] })])
    const { onDone } = renderFlow()
    fireEvent.click((await waitFor(() => listPicker())).getByRole('button', { name: 'Add to list Week 5: Long A' }))
    fireEvent.click(patternPicker().getByRole('button', { name: 'Add to pattern ai' }))
    expect(await screen.findByText('This video is already on pattern ai.')).toBeInTheDocument()
    expect(updateList).not.toHaveBeenCalled()
    expect(notifyListsChanged).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('returns to the pattern picker from the already-attached notice', async () => {
    getLists.mockResolvedValue([makeList({ patterns: [makePattern({ videos: [video] })] })])
    renderFlow()
    fireEvent.click((await waitFor(() => listPicker())).getByRole('button', { name: 'Add to list Week 5: Long A' }))
    fireEvent.click(patternPicker().getByRole('button', { name: 'Add to pattern ai' }))
    await screen.findByText('This video is already on pattern ai.')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('region', { name: 'Pick a pattern' })).toBeInTheDocument()
  })

  it('shows a notice and does not save when the pattern already has 20 videos', async () => {
    const full = Array.from({ length: 20 }, (_, i) => ({
      videoId: `AAAAAA${String(i).padStart(5, '0')}`,
      title: `Song ${i}`,
      source: 'curated' as const,
    }))
    getLists.mockResolvedValue([makeList({ patterns: [makePattern({ videos: full })] })])
    renderFlow()
    fireEvent.click((await waitFor(() => listPicker())).getByRole('button', { name: 'Add to list Week 5: Long A' }))
    fireEvent.click(patternPicker().getByRole('button', { name: 'Add to pattern ai' }))
    expect(await screen.findByText('Pattern ai already has the maximum of 20 videos.')).toBeInTheDocument()
    expect(updateList).not.toHaveBeenCalled()
  })

  it('shows a save error with a retry that saves', async () => {
    updateList.mockRejectedValueOnce(new Error('offline'))
    renderFlow()
    fireEvent.click((await waitFor(() => listPicker())).getByRole('button', { name: 'Add to list Week 5: Long A' }))
    fireEvent.click(patternPicker().getByRole('button', { name: 'Add to pattern ai' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save the video')
    expect(notifyListsChanged).not.toHaveBeenCalled()
    // The retry re-saves the same video to the same pattern.
    updateList.mockResolvedValue(list1)
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => {
      expect(updateList).toHaveBeenCalledTimes(2)
    })
    expect(screen.getByText('Added to Week 5: Long A, pattern ai.')).toBeInTheDocument()
  })

  it('Back on the save error returns to the pattern picker', async () => {
    updateList.mockRejectedValueOnce(new Error('offline'))
    renderFlow()
    fireEvent.click((await waitFor(() => listPicker())).getByRole('button', { name: 'Add to list Week 5: Long A' }))
    fireEvent.click(patternPicker().getByRole('button', { name: 'Add to pattern ai' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByRole('region', { name: 'Pick a pattern' })).toBeInTheDocument()
    expect(updateList).toHaveBeenCalledTimes(1)
  })
})
