import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WorksheetsPrintPage from './WorksheetsPrintPage'
import { getPrebuiltWeek } from '@/lib/prebuilt-lists'
import type { WordList } from '@/models/WordList'
import type { WorksheetType } from '@/lib/worksheets'

const { getList, updateList } = vi.hoisted(() => ({ getList: vi.fn(), updateList: vi.fn() }))
vi.mock('@/lib/lists-api', () => ({ getList, updateList }))

const { fetchExampleSentences } = vi.hoisted(() => ({ fetchExampleSentences: vi.fn() }))
vi.mock('@/lib/example-sentences', () => ({ fetchExampleSentences }))

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }))
vi.mock('@/lib/report-error', () => ({ reportError }))

// BackBreadcrumb (issue #504) is a client component that calls useRouter.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: vi.fn() }),
}))

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

  it('marks the print job for portrait orientation (issue #451)', async () => {
    getList.mockResolvedValue(fullList)
    const { container } = render(<WorksheetsPrintPage listId="l1" selectedTypes={['reading']} />)
    await waitFor(() => expect(printSpy).toHaveBeenCalled())
    // The CSS `page: worksheet` hook (globals.css @page worksheet) forces
    // portrait; this class is what wires the print root to that page.
    expect(container.querySelector('.print-page.worksheet-print')).toBeInTheDocument()
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

    it('links back to the worksheet picker from the gap flow', async () => {
      render(<WorksheetsPrintPage listId="l1" selectedTypes={['reading']} />)
      expect(await screen.findByRole('heading', { name: 'Sentences needed' })).toBeInTheDocument()
      const back = screen.getByRole('link', { name: 'Printable worksheets' })
      expect(back).toHaveAttribute('href', '/lists/l1/worksheets')
    })

    it('keeps accept-all disabled until every word has loaded its suggestions', async () => {
      fetchExampleSentences.mockImplementation(() => new Promise(() => {}))
      render(<WorksheetsPrintPage listId="l1" selectedTypes={['reading']} />)
      expect(await screen.findByRole('heading', { name: 'Sentences needed' })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Accept all suggestions' })).toBeDisabled()
    })

    it('fills the first suggestion for words that have one and skips words without', async () => {
      getList.mockResolvedValue({
        ...list,
        patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['bake', 'late'] }],
      })
      fetchExampleSentences.mockImplementation((word: string) =>
        Promise.resolve(
          word === 'bake'
            ? { sentences: ['Bake the bread.', 'Bake it twice.'], source: 'local' as const }
            : { sentences: [], source: 'local' as const }
        )
      )
      render(<WorksheetsPrintPage listId="l1" selectedTypes={['reading']} />)
      expect(await screen.findByRole('heading', { name: 'Sentences needed' })).toBeInTheDocument()

      const acceptAll = screen.getByRole('button', { name: 'Accept all suggestions' })
      await waitFor(() => expect(acceptAll).toBeEnabled())
      fireEvent.click(acceptAll)

      const boxes = screen.getAllByLabelText(/Or write your own sentence/)
      expect(boxes).toHaveLength(2)
      expect(boxes[0]).toHaveValue('Bake the bread.')
      expect(boxes[1]).toHaveValue('')
      // Filling is not submitting: nothing was saved and the gap stays open.
      expect(updateList).not.toHaveBeenCalled()
      expect(screen.getByRole('heading', { name: 'Sentences needed' })).toBeInTheDocument()
    })

    it('does not overwrite a teacher-typed sentence', async () => {
      // Two gap words: typing in one keeps the accept state (the other box
      // is still empty), so accept-all can run without flipping to approve.
      getList.mockResolvedValue({
        ...list,
        patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['bake', 'late'] }],
      })
      render(<WorksheetsPrintPage listId="l1" selectedTypes={['reading']} />)
      expect(await screen.findAllByText('Bake the bread.')).not.toHaveLength(0)

      const boxes = screen.getAllByLabelText(/Or write your own sentence/)
      fireEvent.change(boxes[0], { target: { value: 'My own take.' } })
      const acceptAll = screen.getByRole('button', { name: 'Accept all suggestions' })
      await waitFor(() => expect(acceptAll).toBeEnabled())
      fireEvent.click(acceptAll)

      expect(boxes[0]).toHaveValue('My own take.')
      expect(boxes[1]).toHaveValue('Bake the bread.')
    })

    it('disables accept-all while a sentence save is in flight', async () => {
      updateList.mockImplementation(() => new Promise(() => {}))
      render(<WorksheetsPrintPage listId="l1" selectedTypes={['reading']} />)
      expect(await screen.findByText('Bake the bread.')).toBeInTheDocument()

      fireEvent.click(screen.getByRole('button', { name: 'Use this' }))
      expect(screen.getByRole('button', { name: 'Accept all suggestions' })).toBeDisabled()
    })

    it('treats a prototype-named word like an ordinary word', async () => {
      // "constructor" reads the inherited Object constructor off a plain
      // object; lookups must be prototype-safe.
      getList.mockResolvedValue({
        ...list,
        patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['constructor'] }],
      })
      render(<WorksheetsPrintPage listId="l1" selectedTypes={['reading']} />)
      expect(await screen.findByRole('heading', { name: 'Sentences needed' })).toBeInTheDocument()

      const acceptAll = screen.getByRole('button', { name: 'Accept all suggestions' })
      await waitFor(() => expect(acceptAll).toBeEnabled())
      fireEvent.click(acceptAll)
      expect(screen.getByLabelText(/Or write your own sentence/)).toHaveValue('Bake the bread.')
      expect(updateList).not.toHaveBeenCalled()
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

  describe('approve-all two-state button (issue #511)', () => {
    const twoGapList: WordList = {
      ...list,
      patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['bake', 'late'] }],
    }

    async function renderGapPage(listOverride: WordList = twoGapList) {
      getList.mockResolvedValue(listOverride)
      render(<WorksheetsPrintPage listId="l1" selectedTypes={['reading']} />)
      expect(await screen.findByRole('heading', { name: 'Sentences needed' })).toBeInTheDocument()
      const acceptAll = screen.getByRole('button', { name: 'Accept all suggestions' })
      await waitFor(() => expect(acceptAll).toBeEnabled())
      return acceptAll
    }

    it('flips to a green Approve all once every gap word has a filled box', async () => {
      const acceptAll = await renderGapPage()
      expect(acceptAll).toHaveClass('min-w-60')

      fireEvent.click(acceptAll)

      const approveAll = screen.getByRole('button', { name: 'Approve all' })
      expect(approveAll).toBeInTheDocument()
      // Primary green idiom, matching the per-word "Use this sentence" button.
      expect(approveAll).toHaveClass('bg-chunk-leaf')
      // Same reserved geometry as the accept state: no layout shift.
      expect(approveAll).toHaveClass('min-w-60')
      expect(screen.queryByRole('button', { name: 'Accept all suggestions' })).not.toBeInTheDocument()
    })

    it('saves every draft in a single write and advances to print', async () => {
      const acceptAll = await renderGapPage()
      fireEvent.click(acceptAll)
      fireEvent.click(screen.getByRole('button', { name: 'Approve all' }))

      expect(updateList).toHaveBeenCalledTimes(1)
      expect(updateList).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({
          patterns: expect.arrayContaining([
            expect.objectContaining({
              id: 'p1',
              sentences: { bake: 'Bake the bread.', late: 'Bake the bread.' },
            }),
          ]),
        })
      )
      expect(await screen.findAllByRole('heading', { name: 'Reading practice' })).toHaveLength(2)
      await waitFor(() => expect(printSpy).toHaveBeenCalled())
    })

    it('leaves already-saved patterns untouched when approving', async () => {
      // The base list fixture has p2 fully saved (rain/train have sentences),
      // so only bake is a gap word: this exercises the no-draft-word and
      // unchanged-pattern branches of the approve-all merge.
      const acceptAll = await renderGapPage(list)
      fireEvent.click(acceptAll)
      fireEvent.click(screen.getByRole('button', { name: 'Approve all' }))

      expect(updateList).toHaveBeenCalledTimes(1)
      const patternsArg = updateList.mock.calls[0][1].patterns
      expect(patternsArg[0]).toEqual(
        expect.objectContaining({
          id: 'p1',
          sentences: { cake: 'We baked a cake for the party.', bake: 'Bake the bread.' },
        })
      )
      // p2 had nothing to approve: it passes through as the same object,
      // sentences intact.
      expect(patternsArg[1]).toBe(list.patterns[1])
      expect(await screen.findAllByRole('heading', { name: 'Reading practice' })).toHaveLength(2)
      await waitFor(() => expect(printSpy).toHaveBeenCalled())
    })

    it('keeps a saved sentence for a word named like an Object prototype property', async () => {
      // Regression: drafts is a plain lookup, so drafts["constructor"] must
      // not resolve to the inherited Object constructor and clobber the
      // saved sentence (issue #511 CodeRabbit review).
      const acceptAll = await renderGapPage({
        ...list,
        patterns: [
          {
            id: 'p1',
            sound: 'long a',
            pattern: 'a_e',
            frequency: 'common',
            words: ['constructor', 'bake'],
            sentences: { constructor: 'The constructor built the house.' },
          },
        ],
      })
      fireEvent.click(acceptAll)
      fireEvent.click(screen.getByRole('button', { name: 'Approve all' }))

      expect(updateList).toHaveBeenCalledTimes(1)
      expect(updateList).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({
          patterns: [
            expect.objectContaining({
              id: 'p1',
              sentences: { constructor: 'The constructor built the house.', bake: 'Bake the bread.' },
            }),
          ],
        })
      )
      await waitFor(() => expect(printSpy).toHaveBeenCalled())
    })

    it('reverts to Accept all suggestions when a filled sentence is emptied', async () => {
      const acceptAll = await renderGapPage()
      fireEvent.click(acceptAll)
      expect(screen.getByRole('button', { name: 'Approve all' })).toBeInTheDocument()

      const boxes = screen.getAllByLabelText(/Or write your own sentence/)
      fireEvent.change(boxes[0], { target: { value: '   ' } })

      expect(screen.getByRole('button', { name: 'Accept all suggestions' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Approve all' })).not.toBeInTheDocument()
    })

    it('holds the accept state for a word with no suggestions until the teacher types', async () => {
      getList.mockResolvedValue({
        ...list,
        patterns: [{ id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['bake', 'zqxwv'] }],
      })
      fetchExampleSentences.mockImplementation((word: string) =>
        Promise.resolve(
          word === 'bake'
            ? { sentences: ['Bake the bread.'], source: 'local' as const }
            : { sentences: [], source: 'local' as const }
        )
      )
      render(<WorksheetsPrintPage listId="l1" selectedTypes={['reading']} />)
      expect(await screen.findByRole('heading', { name: 'Sentences needed' })).toBeInTheDocument()

      const acceptAll = screen.getByRole('button', { name: 'Accept all suggestions' })
      await waitFor(() => expect(acceptAll).toBeEnabled())
      fireEvent.click(acceptAll)

      // bake filled, zqxwv has nothing to accept: still the accept state.
      expect(screen.getByRole('button', { name: 'Accept all suggestions' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Approve all' })).not.toBeInTheDocument()

      const boxes = screen.getAllByLabelText(/Or write your own sentence/)
      expect(boxes).toHaveLength(2)
      fireEvent.change(boxes[1], { target: { value: 'Zqxwv is a made-up word.' } })

      expect(screen.getByRole('button', { name: 'Approve all' })).toBeInTheDocument()
    })

    it('disables Approve all while a per-word save is in flight', async () => {
      updateList.mockImplementation(() => new Promise(() => {}))
      const acceptAll = await renderGapPage()
      fireEvent.click(acceptAll)

      fireEvent.click(screen.getAllByRole('button', { name: 'Use this' })[0])
      expect(screen.getByRole('button', { name: 'Approve all' })).toBeDisabled()
    })

    it('shows an error and keeps the drafts when the approve-all save fails', async () => {
      updateList.mockRejectedValueOnce(new Error('network down'))
      const acceptAll = await renderGapPage()
      fireEvent.click(acceptAll)
      fireEvent.click(screen.getByRole('button', { name: 'Approve all' }))

      expect(await screen.findByRole('alert')).toHaveTextContent('Could not save those sentences')
      expect(reportError).toHaveBeenCalled()
      // Drafts are kept, so the approve state (not the accept state) stays.
      expect(screen.getByRole('button', { name: 'Approve all' })).toBeInTheDocument()
      expect(screen.getByRole('heading', { name: 'Sentences needed' })).toBeInTheDocument()
      expect(printSpy).not.toHaveBeenCalled()
    })

    it('keeps approve-all sentences local for prebuilt weeks', async () => {
      const week = getPrebuiltWeek('prebuilt-g2-w06')!
      render(<WorksheetsPrintPage prebuiltWeek={week} selectedTypes={['reading']} />)
      expect(await screen.findByRole('heading', { name: /Sentences needed/ })).toBeInTheDocument()

      const acceptAll = screen.getByRole('button', { name: 'Accept all suggestions' })
      await waitFor(() => expect(acceptAll).toBeEnabled())
      fireEvent.click(acceptAll)

      const approveAll = await screen.findByRole('button', { name: 'Approve all' })
      fireEvent.click(approveAll)

      await waitFor(() => expect(updateList).not.toHaveBeenCalled())
      // The gap resolves locally and the print job renders.
      expect(await screen.findByRole('button', { name: 'Print' })).toBeInTheDocument()
    })
  })
  describe('WorksheetsPrintPage prebuilt weeks (issue #463)', () => {
    const week = getPrebuiltWeek('prebuilt-g2-w06')!

    it('loads the week from bundled data without an API fetch', async () => {
      render(<WorksheetsPrintPage prebuiltWeek={week} selectedTypes={['spelling-list']} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument()
      })
      expect(getList).not.toHaveBeenCalled()
    })

    it('shows the Prebuilt badge and routes back links to the prebuilt picker', async () => {
      render(<WorksheetsPrintPage prebuiltWeek={week} selectedTypes={['spelling-list']} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Print' })).toBeInTheDocument()
      })
      expect(screen.getByRole('link', { name: /back to worksheets/i })).toHaveAttribute(
        'href',
        '/lists/prebuilt/prebuilt-g2-w06/worksheets'
      )
    })

    it('keeps gap-flow sentences local: never calls updateList', async () => {
      render(<WorksheetsPrintPage prebuiltWeek={week} selectedTypes={['reading']} />)
      expect(await screen.findByRole('heading', { name: /Sentences needed/ })).toBeInTheDocument()

      fireEvent.click((await screen.findAllByRole('button', { name: 'Use this' }))[0])

      // The gap resolves locally (the print job proceeds) with no API write.
      await waitFor(() => {
        expect(updateList).not.toHaveBeenCalled()
      })
    })
  })
})
