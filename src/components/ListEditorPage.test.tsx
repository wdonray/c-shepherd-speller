import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import ListEditorPage from './ListEditorPage'
import { ErrorToaster } from './error-toaster'
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

const { logActivity } = vi.hoisted(() => ({
  logActivity: vi.fn(),
}))
vi.mock('@/lib/activity', () => ({ logActivity }))

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

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
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
  const result = render(
    <>
      <ListEditorPage listId="l1" />
      <ErrorToaster />
    </>
  )
  await screen.findByRole('heading', { name: 'Week 5: Long A' })
  return result
}

/** Wait for the 500ms auto-save debounce plus the mocked save round-trip. */
async function waitForSave() {
  await waitFor(() => expect(updateList).toHaveBeenCalled(), { timeout: 3000 })
  await waitFor(() => expect(screen.queryByText('Saving...')).not.toBeInTheDocument(), { timeout: 3000 })
}

/** Wait long enough for a debounced save attempt to fire, for tests where no save is expected. */
const SAVE_DEBOUNCE_WAIT_MS = 750

/**
 * jsdom has no layout and no Web Animations API, so stub both to assert the
 * bottom button's FLIP shift. `tops` feeds successive getBoundingClientRect
 * top values: the first call is addPattern's "before" measurement, the
 * second the layout effect's "after" measurement. Extra entries are reused
 * for rapid double-adds.
 */
function stubBottomButtonAnimation(tops: number[]) {
  const remaining = [...tops]
  const rectSpy = vi.spyOn(window.HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    () =>
      ({
        top: remaining.length > 1 ? remaining.shift()! : remaining[0],
        left: 0,
        bottom: 0,
        right: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      }) as unknown as DOMRect
  )
  const cancelMock = vi.fn()
  const animateMock = vi.fn(() => ({ cancel: cancelMock }) as unknown as Animation)
  Object.defineProperty(window.HTMLElement.prototype, 'animate', {
    value: animateMock,
    configurable: true,
    writable: true,
  })
  return {
    animateMock,
    cancelMock,
    restore: () => {
      rectSpy.mockRestore()
      // `animate` is not a jsdom own-property; deleting restores its absence.
      delete (window.HTMLElement.prototype as { animate?: unknown }).animate
    },
  }
}

describe('ListEditorPage', () => {
  let scrollIntoViewMock: ReturnType<typeof vi.fn<(options?: ScrollIntoViewOptions | boolean) => void>>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    // jsdom does not implement scrollIntoView; stub it so the add-pattern
    // scroll can be asserted (and so existing add-pattern tests don't throw).
    scrollIntoViewMock = vi.fn<(options?: ScrollIntoViewOptions | boolean) => void>()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock
  })

  afterEach(() => {
    vi.useRealTimers()
    delete (window.HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
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
    expect(screen.getByRole('link', { name: 'Back to my lists' })).toHaveAttribute('href', '/lists')
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

  it('logs one edited activity event after the first successful save of a visit', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    const name = screen.getByLabelText('List name')
    fireEvent.change(name, { target: { value: 'Renamed' } })
    fireEvent.change(name, { target: { value: 'Renamed again' } })

    // Nothing is logged before the save completes.
    expect(logActivity).not.toHaveBeenCalled()

    await waitForSave()
    expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ name: 'Renamed again' }))
    expect(logActivity).toHaveBeenCalledTimes(1)
    expect(logActivity).toHaveBeenCalledWith('edited', 'Renamed again', 'l1')
  })

  it('does not log an edited activity event when the save fails', async () => {
    updateList.mockRejectedValue(new Error('network down'))
    await renderReady()

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })

    await waitForSave()
    expect(logActivity).not.toHaveBeenCalled()
  })

  it('does not log an edited activity event when the name is blank and the save is skipped', async () => {
    await renderReady()

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: '   ' } })

    // Let the debounce elapse; the save is skipped for blank names, so just
    // wait out the timer rather than waiting for a save.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, SAVE_DEBOUNCE_WAIT_MS))
    })
    expect(updateList).not.toHaveBeenCalled()
    expect(logActivity).not.toHaveBeenCalled()
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

  it('adds a pattern from the empty state and saves it once complete', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady({ patterns: [] })

    expect(screen.getByText('No patterns yet')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Add a pattern' }))

    expect(screen.getByLabelText('Pattern spelling')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Target sound'), { target: { value: 'long a' } })
    fireEvent.change(screen.getByLabelText('Pattern spelling'), { target: { value: 'ai' } })

    await waitForSave()
    expect(updateList).toHaveBeenCalledWith(
      'l1',
      expect.objectContaining({ patterns: [expect.objectContaining({ sound: 'long a', pattern: 'ai' })] })
    )
  })

  it('smooth-scrolls the new pattern card into view after adding', async () => {
    await renderReady({ patterns: [] })

    fireEvent.click(screen.getByRole('button', { name: 'Add a pattern' }))

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1)
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
    // The scroll targets the new card specifically: its wrapper carries the
    // sticky-header offset and contains the untitled pattern section.
    const scrolledElement = scrollIntoViewMock.mock.instances[0] as HTMLElement
    expect(scrolledElement.classList.contains('scroll-mt-24')).toBe(true)
    expect(scrolledElement.querySelector('section[aria-label="Untitled pattern"]')).not.toBeNull()
  })

  it('scrolls instantly when the user prefers reduced motion', async () => {
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
    try {
      await renderReady({ patterns: [] })

      fireEvent.click(screen.getByRole('button', { name: 'Add a pattern' }))

      expect(scrollIntoViewMock).toHaveBeenCalledTimes(1)
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' })
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: originalMatchMedia,
      })
    }
  })

  it('renders a centered add-pattern button below the pattern list', async () => {
    await renderReady()

    // The header keeps its "+ Add a pattern" button; the new bottom button
    // is the plain "Add a pattern" one, centered under the list.
    const bottomButton = screen.getByRole('button', { name: 'Add a pattern' })
    expect(bottomButton).toBeInTheDocument()
    expect(bottomButton.parentElement).toHaveClass('flex', 'justify-center')
  })

  it('adds a pattern from the bottom button', async () => {
    await renderReady()

    fireEvent.click(screen.getByRole('button', { name: 'Add a pattern' }))

    expect(screen.getByText('Spelling patterns (2)')).toBeInTheDocument()
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1)
    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' })
  })

  it('animates the bottom button gliding down after a pattern is added', async () => {
    const { animateMock, restore } = stubBottomButtonAnimation([100, 500])
    try {
      await renderReady()

      fireEvent.click(screen.getByRole('button', { name: '+ Add a pattern' }))

      // The button moved from document Y 100 to 500, so the animation
      // starts 400px up and settles to its new position.
      expect(animateMock).toHaveBeenCalledTimes(1)
      expect(animateMock).toHaveBeenCalledWith([{ transform: 'translateY(-400px)' }, { transform: 'translateY(0)' }], {
        duration: 300,
        easing: 'ease-out',
      })
    } finally {
      restore()
    }
  })

  it('skips the shift animation when the button did not move', async () => {
    const { animateMock, restore } = stubBottomButtonAnimation([100])
    try {
      await renderReady()

      fireEvent.click(screen.getByRole('button', { name: '+ Add a pattern' }))

      expect(animateMock).not.toHaveBeenCalled()
    } finally {
      restore()
    }
  })

  it('skips the shift animation when the user prefers reduced motion', async () => {
    const originalMatchMedia = window.matchMedia
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      configurable: true,
      value: (query: string) => ({
        matches: query === '(prefers-reduced-motion: reduce)',
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      }),
    })
    const { animateMock, restore } = stubBottomButtonAnimation([100, 500])
    try {
      await renderReady()

      fireEvent.click(screen.getByRole('button', { name: '+ Add a pattern' }))

      expect(animateMock).not.toHaveBeenCalled()
    } finally {
      restore()
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: originalMatchMedia,
      })
    }
  })

  it('cancels the in-flight shift animation when adding again quickly', async () => {
    const { animateMock, cancelMock, restore } = stubBottomButtonAnimation([100, 500, 500, 500])
    try {
      await renderReady()

      fireEvent.click(screen.getByRole('button', { name: '+ Add a pattern' }))
      expect(animateMock).toHaveBeenCalledTimes(1)
      fireEvent.click(screen.getByRole('button', { name: '+ Add a pattern' }))

      // The second add cancels the first animation so its measurement
      // reads the wrapper's true layout position.
      expect(cancelMock).toHaveBeenCalled()
    } finally {
      restore()
    }
  })

  it('cancels the shift animation when the page unmounts', async () => {
    const { animateMock, cancelMock, restore } = stubBottomButtonAnimation([100, 500])
    try {
      getList.mockResolvedValue(list)
      const { unmount } = render(<ListEditorPage listId="l1" />)
      await screen.findByRole('heading', { name: 'Week 5: Long A' })

      fireEvent.click(screen.getByRole('button', { name: '+ Add a pattern' }))
      expect(animateMock).toHaveBeenCalledTimes(1)

      unmount()
      expect(cancelMock).toHaveBeenCalled()
    } finally {
      restore()
    }
  })

  it('does not auto-save a new pattern until its required fields are filled', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady({ patterns: [] })

    fireEvent.click(screen.getByRole('button', { name: 'Add a pattern' }))

    // A blank pattern is local-only: no save fires at all.
    await new Promise((r) => setTimeout(r, 700))
    expect(updateList).not.toHaveBeenCalled()

    // Filling only the sound keeps it a draft; the save fires but the
    // incomplete pattern is held out of the payload.
    fireEvent.change(screen.getByLabelText('Target sound'), { target: { value: 'long a' } })
    await waitForSave()
    expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ patterns: [] }))

    // Filling the spelling completes it: the next save includes it.
    fireEvent.change(screen.getByLabelText('Pattern spelling'), { target: { value: 'ai' } })
    await waitFor(() =>
      expect(updateList).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({ patterns: [expect.objectContaining({ sound: 'long a', pattern: 'ai' })] })
      )
    )
  })

  it('discards an incomplete new pattern when leaving the page', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    getList.mockResolvedValue({ ...list, patterns: [] })
    const { unmount } = render(<ListEditorPage listId="l1" />)
    await screen.findByRole('button', { name: 'Add a pattern' })

    fireEvent.click(screen.getByRole('button', { name: 'Add a pattern' }))
    fireEvent.change(screen.getByLabelText('Target sound'), { target: { value: 'long a' } })
    // Unmount before the debounce fires; the flush must not persist the draft.
    unmount()

    await new Promise((r) => setTimeout(r, 100))
    const calls = updateList.mock.calls
    expect(calls.length).toBeGreaterThan(0)
    for (const [, data] of calls) {
      expect((data as { patterns: unknown[] }).patterns).toEqual([])
    }
  })

  it('holds the save while a saved pattern’s required field is empty', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady({ patterns: [] })

    fireEvent.click(screen.getByRole('button', { name: 'Add a pattern' }))
    fireEvent.change(screen.getByLabelText('Target sound'), { target: { value: 'long a' } })
    fireEvent.change(screen.getByLabelText('Pattern spelling'), { target: { value: 'ai' } })
    await waitForSave()
    const savedCalls = updateList.mock.calls.length

    // Clearing the spelling mid-edit holds the save instead of sending a
    // payload the API would reject: no PUT, no error toast, input preserved,
    // and the unsaved indicator stays on.
    fireEvent.change(screen.getByLabelText('Pattern spelling'), { target: { value: '' } })
    await new Promise((r) => setTimeout(r, SAVE_DEBOUNCE_WAIT_MS))
    expect(updateList.mock.calls.length).toBe(savedCalls)
    expect(screen.queryByText('Something went wrong. Please try again.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Pattern spelling')).toHaveValue('')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    // Re-typing the spelling completes the pattern; the next save includes it.
    fireEvent.change(screen.getByLabelText('Pattern spelling'), { target: { value: 'ai' } })
    await waitFor(() =>
      expect(updateList).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({ patterns: [expect.objectContaining({ sound: 'long a', pattern: 'ai' })] })
      )
    )
  })

  it('does not flush a mid-edit pattern with an empty required field on unmount', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    getList.mockResolvedValue(list)
    const { unmount } = render(<ListEditorPage listId="l1" />)
    await screen.findByRole('heading', { name: 'Week 5: Long A' })

    // Clear a saved pattern's spelling and let the debounced save fire (it
    // holds instead of PUTting); leaving the page must not flush the doomed
    // PUT either.
    fireEvent.change(screen.getByLabelText('Pattern spelling'), { target: { value: '' } })
    await new Promise((r) => setTimeout(r, SAVE_DEBOUNCE_WAIT_MS))
    const callsBeforeUnmount = updateList.mock.calls.length
    unmount()
    await new Promise((r) => setTimeout(r, 100))
    expect(updateList.mock.calls.length).toBe(callsBeforeUnmount)
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

  it('shows a toast when saving fails and keeps the input', async () => {
    updateList.mockRejectedValue(new Error('network down'))
    await renderReady()

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })

    await waitFor(() => {
      expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
    })
    // The teacher's edit is preserved.
    expect(screen.getByLabelText('List name')).toHaveValue('Renamed')
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
    await waitFor(() => {
      expect(notifyListsChanged).toHaveBeenCalled()
    })
  })

  it('does not log a second edited event when a later edit is flushed on unmount', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    getList.mockResolvedValue(list)
    const { unmount } = render(<ListEditorPage listId="l1" />)
    await screen.findByRole('heading', { name: 'Week 5: Long A' })

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    await waitForSave()
    expect(logActivity).toHaveBeenCalledTimes(1)

    // A second edit is flushed on unmount; the successful flush must not log again.
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed again' } })
    unmount()

    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ name: 'Renamed again' }))
    })
    await waitFor(() => {
      expect(notifyListsChanged).toHaveBeenCalled()
    })
    expect(logActivity).toHaveBeenCalledTimes(1)
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

  it('auto-saves a picked list color', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    fireEvent.click(screen.getByRole('radio', { name: 'Blue' }))

    await waitForSave()
    expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ color: 'sky' }))
  })

  it('pre-selects the stored list color', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady({ color: 'coral' })

    expect(screen.getByRole('radio', { name: 'Red' })).toHaveAttribute('aria-checked', 'true')
  })

  it('updates every pattern top bar when the list color changes', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    const { container } = await renderReady()

    expect(container.querySelector('.bg-leaf.h-2')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Blue' }))

    await waitFor(() => {
      expect(container.querySelector('.bg-sky.h-2')).toBeInTheDocument()
    })
    expect(container.querySelector('.bg-leaf.h-2')).not.toBeInTheDocument()
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
    expect(screen.getByRole('link', { name: 'My lists' })).toHaveAttribute('href', '/lists')
  })

  it('shows an unsaved-changes indicator until the debounced save completes', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()
    expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    await waitForSave()
    await waitFor(() => expect(screen.queryByText('Unsaved changes')).not.toBeInTheDocument())
  })

  it('asks for confirmation when leaving with unsaved changes', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('link', { name: 'My lists' }))

    expect(screen.getByText('Leave without saving?')).toBeInTheDocument()
    expect(
      screen.getByText('You have unsaved changes. If you leave now, those changes will be lost.')
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
    await waitFor(() => expect(screen.queryByText('Leave without saving?')).not.toBeInTheDocument())
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('navigates to the lists overview after confirming leave', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('link', { name: 'My lists' }))
    fireEvent.click(screen.getByRole('button', { name: 'Leave without saving' }))

    expect(pushMock).toHaveBeenCalledWith('/lists')
  })

  it('does not interrupt navigation when nothing is unsaved', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    fireEvent.click(screen.getByRole('link', { name: 'My lists' }))

    expect(screen.queryByText('Leave without saving?')).not.toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('goes back after confirming leave from the back button', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    const goSpy = vi.spyOn(window.history, 'go').mockImplementation(() => {})
    const backSpy = vi.spyOn(window.history, 'back').mockImplementation(() => {})

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(screen.getByText('Leave without saving?')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Leave without saving' }))
    expect(goSpy).toHaveBeenCalledWith(-2)

    goSpy.mockRestore()
    backSpy.mockRestore()
  })

  it('closes the leave confirmation with Escape without navigating', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('link', { name: 'My lists' }))
    expect(screen.getByText('Leave without saving?')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByText('Leave without saving?')).not.toBeInTheDocument())
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('deletes a newly added pattern without persisting it', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    fireEvent.click(screen.getByRole('button', { name: '+ Add a pattern' }))
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete this pattern' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: 'Delete this pattern?' })).not.toBeInTheDocument()
    })
    // The incomplete pattern never reaches the server: the save only carries the original patterns.
    await waitForSave()
    expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ patterns: [patternA] }))
  })
})
