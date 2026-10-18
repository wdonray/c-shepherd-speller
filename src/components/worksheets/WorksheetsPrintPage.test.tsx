import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WorksheetsPrintPage from './WorksheetsPrintPage'
import type { WordList } from '@/models/WordList'
import type { WorksheetType } from '@/lib/worksheets'

const { getList, updateList } = vi.hoisted(() => ({ getList: vi.fn(), updateList: vi.fn() }))
vi.mock('@/lib/lists-api', () => ({ getList, updateList }))

const { fetchExampleSentences } = vi.hoisted(() => ({ fetchExampleSentences: vi.fn() }))
vi.mock('@/lib/example-sentences', () => ({ fetchExampleSentences }))

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }))
vi.mock('@/lib/report-error', () => ({ reportError }))

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const ALL_TYPES: WorksheetType[] = [
  'spelling-list',
  'cut-sort',
  'fill-blank',
  'word-search',
  'crossword',
  'reading',
  'parent-note',
]

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5: Long A',
  week: '5',
  patterns: [
    {
      id: 'p1',
      sound: 'long a',
      pattern: 'a_e',
      frequency: 'common',
      words: ['cake', 'bake'],
      sentences: { cake: 'We baked a cake for the party.' },
    },
    {
      id: 'p2',
      sound: 'long a',
      pattern: 'ai',
      frequency: 'common',
      words: ['rain', 'train'],
      sentences: { rain: 'The rain fell all afternoon.', train: 'We rode the train to the city.' },
    },
  ],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

const fullList: WordList = {
  ...list,
  patterns: list.patterns.map((p) =>
    p.id === 'p1' ? { ...p, sentences: { ...p.sentences, bake: 'I like to bake bread.' } } : p
  ),
}

describe('WorksheetsPrintPage', () => {
  const printSpy = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    getList.mockResolvedValue(list)
    updateList.mockResolvedValue({} as WordList)
    fetchExampleSentences.mockResolvedValue({ sentences: ['Bake the bread.'], source: 'local' })
    Object.defineProperty(window, 'print', { value: printSpy, writable: true, configurable: true })
  })

  it('shows a loading state and does not print yet', () => {
    getList.mockImplementation(() => new Promise(() => {}))
    render(<WorksheetsPrintPage listId="l1" selectedTypes={ALL_TYPES} />)
    expect(screen.getByRole('status', { name: 'Loading worksheets' })).toBeInTheDocument()
    expect(printSpy).not.toHaveBeenCalled()
  })

  it('shows a not-found state for a missing list', async () => {
    getList.mockRejectedValue(new Error('List not found'))
    render(<WorksheetsPrintPage listId="l1" selectedTypes={ALL_TYPES} />)
    expect(await screen.findByText('List not found')).toBeInTheDocument()
    expect(printSpy).not.toHaveBeenCalled()
  })

  it('shows an error state with retry', async () => {
    getList.mockRejectedValueOnce(new Error('boom'))
    render(<WorksheetsPrintPage listId="l1" selectedTypes={ALL_TYPES} />)
    expect(await screen.findByText('Could not load this list')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(getList).toHaveBeenCalledTimes(2))
  })

  it('prints every selected worksheet followed by its answer key', async () => {
    getList.mockResolvedValue(fullList)
    render(<WorksheetsPrintPage listId="l1" selectedTypes={ALL_TYPES} />)
    await waitFor(() => expect(printSpy).toHaveBeenCalled())
    // Every keyed worksheet renders twice: the sheet and its answer key.
    expect(screen.getAllByRole('heading', { name: 'Spelling list' })).toHaveLength(2)
    expect(screen.getAllByRole('heading', { name: 'Cut and sort' })).toHaveLength(2)
    expect(screen.getAllByRole('heading', { name: 'Fill in the blank' })).toHaveLength(2)
    expect(screen.getAllByRole('heading', { name: 'Word search' })).toHaveLength(2)
    expect(screen.getAllByRole('heading', { name: 'Crossword' })).toHaveLength(2)
    expect(screen.getAllByRole('heading', { name: 'Reading practice' })).toHaveLength(2)
    // The parent note has no key: it renders once, after the answer key.
    expect(screen.getAllByRole('heading', { name: 'A note for families' })).toHaveLength(1)
    expect(screen.getByRole('heading', { name: 'Answer key' })).toBeInTheDocument()
    // The toolbar Print button re-opens the dialog.
    fireEvent.click(screen.getByRole('button', { name: 'Print' }))
    expect(printSpy).toHaveBeenCalledTimes(2)
  })

  it('omits the answer key when only the parent note is selected', async () => {
    getList.mockResolvedValue({ ...fullList, week: undefined })
    render(<WorksheetsPrintPage listId="l1" selectedTypes={['parent-note']} />)
    expect(await screen.findByRole('heading', { name: 'A note for families' })).toBeInTheDocument()
    await waitFor(() => expect(printSpy).toHaveBeenCalled())
    expect(screen.queryByRole('heading', { name: 'Answer key' })).not.toBeInTheDocument()
  })

  it('shows a no-words state when the list has nothing printable', async () => {
    getList.mockResolvedValue({
      ...list,
      patterns: [{ id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'common', words: ['rain'], isLocked: true }],
    })
    render(<WorksheetsPrintPage listId="l1" selectedTypes={['reading']} />)
    expect(await screen.findByText('No words to print')).toBeInTheDocument()
    expect(printSpy).not.toHaveBeenCalled()
  })

  describe('sentence gap flow', () => {
    it('holds printing until the gap is resolved, then prints', async () => {
      render(<WorksheetsPrintPage listId="l1" selectedTypes={['reading']} />)
      expect(await screen.findByRole('heading', { name: 'Sentences needed' })).toBeInTheDocument()
      expect(printSpy).not.toHaveBeenCalled()
      expect(await screen.findByText('Bake the bread.')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Use this' }))
      expect(updateList).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({
          patterns: expect.arrayContaining([
            expect.objectContaining({
              id: 'p1',
              sentences: { cake: 'We baked a cake for the party.', bake: 'Bake the bread.' },
            }),
          ]),
        })
      )
      expect(await screen.findAllByRole('heading', { name: 'Reading practice' })).toHaveLength(2)
      await waitFor(() => expect(printSpy).toHaveBeenCalled())
    })

    it('accepts a teacher-typed sentence', async () => {
      // The pattern has no sentences object yet: saving creates it.
      getList.mockResolvedValue({
        ...list,
        patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['bake'] }],
      })
      render(<WorksheetsPrintPage listId="l1" selectedTypes={['reading']} />)
      expect(await screen.findByRole('heading', { name: 'Sentences needed' })).toBeInTheDocument()
      const useTyped = screen.getByRole('button', { name: 'Use this sentence' })
      expect(useTyped).toBeDisabled()

      fireEvent.change(screen.getByLabelText(/Or write your own sentence/), { target: { value: 'Bake it twice.' } })
      fireEvent.click(screen.getByRole('button', { name: 'Use this sentence' }))
      expect(updateList).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({
          patterns: expect.arrayContaining([
            expect.objectContaining({
              sentences: { bake: 'Bake it twice.' },
            }),
          ]),
        })
      )
      await waitFor(() => expect(printSpy).toHaveBeenCalled())
    })

    it('removes the word from the worksheet instead', async () => {
      render(<WorksheetsPrintPage listId="l1" selectedTypes={['reading']} />)
      expect(await screen.findByRole('heading', { name: 'Sentences needed' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Remove bake from worksheet' }))
      expect(updateList).not.toHaveBeenCalled()
      expect(await screen.findAllByRole('heading', { name: 'Reading practice' })).toHaveLength(2)
      await waitFor(() => expect(printSpy).toHaveBeenCalled())
      expect(screen.queryByText('Bake the bread.')).not.toBeInTheDocument()
    })

    it('shows a no-words state when every word is removed', async () => {
      getList.mockResolvedValue({
        ...list,
        patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['bake'] }],
      })
      render(<WorksheetsPrintPage listId="l1" selectedTypes={['reading']} />)
      expect(await screen.findByRole('heading', { name: 'Sentences needed' })).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Remove bake from worksheet' }))
      expect(await screen.findByText('No words to print')).toBeInTheDocument()
      expect(printSpy).not.toHaveBeenCalled()
    })

    it('shows a message when the bank has no suggestion', async () => {
      fetchExampleSentences.mockResolvedValue({ sentences: [], source: 'local' })
      render(<WorksheetsPrintPage listId="l1" selectedTypes={['reading']} />)
      expect(await screen.findByText(/No suggestions found for this word/)).toBeInTheDocument()
    })

    it('shows a per-word loading state while suggestions are fetched', async () => {
      fetchExampleSentences.mockImplementation(() => new Promise(() => {}))
      render(<WorksheetsPrintPage listId="l1" selectedTypes={['reading']} />)
      expect(await screen.findByRole('heading', { name: 'Sentences needed' })).toBeInTheDocument()
      expect(screen.getByRole('status', { name: 'Finding sentences for bake' })).toBeInTheDocument()
      expect(printSpy).not.toHaveBeenCalled()
    })

    it('shows an error when saving a sentence fails', async () => {
      updateList.mockRejectedValueOnce(new Error('offline'))
      render(<WorksheetsPrintPage listId="l1" selectedTypes={['reading']} />)
      expect(await screen.findByText('Bake the bread.')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Use this' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('Could not save that sentence.')
      expect(printSpy).not.toHaveBeenCalled()
      // The gap stays open so the teacher can retry.
      expect(screen.getByRole('heading', { name: 'Sentences needed' })).toBeInTheDocument()
    })

    it('disables the gap controls while a save is in flight', async () => {
      getList.mockResolvedValue({
        ...list,
        patterns: [
          {
            id: 'p1',
            sound: 'long a',
            pattern: 'a_e',
            frequency: 'common',
            words: ['bake', 'late'],
            sentences: { cake: 'We baked a cake for the party.' },
          },
        ],
      })
      updateList.mockImplementation(() => new Promise(() => {}))
      render(<WorksheetsPrintPage listId="l1" selectedTypes={['reading']} />)
      const useButtons = await screen.findAllByRole('button', { name: 'Use this' })
      expect(useButtons).toHaveLength(2)

      fireEvent.click(useButtons[0])
      expect(updateList).toHaveBeenCalledTimes(1)
      screen.getAllByRole('button', { name: 'Use this' }).forEach((button) => expect(button).toBeDisabled())
      expect(screen.getByRole('button', { name: 'Remove bake from worksheet' })).toBeDisabled()
    })

    it('shows an error state for a non-Error rejection', async () => {
      getList.mockRejectedValueOnce('a string, not an Error')
      render(<WorksheetsPrintPage listId="l1" selectedTypes={ALL_TYPES} />)
      expect(await screen.findByText('Could not load this list')).toBeInTheDocument()
      expect(reportError).toHaveBeenCalled()
    })

    it('does not update state if unmounted during load', async () => {
      let resolveLoad!: (v: WordList) => void
      getList.mockImplementation(
        () =>
          new Promise((r) => {
            resolveLoad = r
          })
      )
      const { unmount } = render(<WorksheetsPrintPage listId="l1" selectedTypes={ALL_TYPES} />)
      expect(screen.getByRole('status', { name: 'Loading worksheets' })).toBeInTheDocument()

      unmount()
      resolveLoad(fullList)
      await new Promise((r) => setTimeout(r, 50))
      expect(printSpy).not.toHaveBeenCalled()
    })

    it('does not update state if unmounted during a failing load', async () => {
      let rejectLoad!: (e: Error) => void
      getList.mockImplementation(
        () =>
          new Promise((_, rej) => {
            rejectLoad = rej
          })
      )
      const { unmount } = render(<WorksheetsPrintPage listId="l1" selectedTypes={ALL_TYPES} />)

      unmount()
      rejectLoad(new Error('network down'))
      await new Promise((r) => setTimeout(r, 50))
      expect(printSpy).not.toHaveBeenCalled()
      expect(screen.queryByRole('heading', { name: 'Could not load this list' })).not.toBeInTheDocument()
    })
  })
})
