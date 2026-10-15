import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react'
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
    // ClassroomSelector fetches the teacher's classes on mount.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ classes: [{ id: 'c1', name: 'Period 2' }] }),
      })
    )
    // jsdom does not implement scrollIntoView; stub it so the add-pattern
    // scroll can be asserted (and so existing add-pattern tests don't throw).
    scrollIntoViewMock = vi.fn<(options?: ScrollIntoViewOptions | boolean) => void>()
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    delete (window.HTMLElement.prototype as { scrollIntoView?: unknown }).scrollIntoView
  })

  it('shows a loading skeleton, then the editor', async () => {
    getList.mockResolvedValue(list)
    render(<ListEditorPage listId="l1" />)

    expect(screen.getByRole('status', { name: 'Loading list editor' })).toBeInTheDocument()
    await screen.findByRole('heading', { name: 'Week 5: Long A' })
    expect(screen.getByText('Grade 1')).toBeInTheDocument()
    expect(screen.getByText('Spelling patterns (1)')).toBeInTheDocument()
    expect(screen.getByText(/so the pattern jumps out at a glance/)).toBeInTheDocument()
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

  it('shows the assigned week in the optional week field', async () => {
    await renderReady({ week: '5' })

    expect(screen.getByLabelText('Week (optional)')).toHaveValue('5')
  })

  it('auto-saves the week when edited', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    expect(screen.getByLabelText('Week (optional)')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('Week (optional)'), { target: { value: '6' } })

    await waitForSave()
    expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ week: '6' }))
    expect(notifyListsChanged).toHaveBeenCalled()
  })

  it('saves an empty week when the field is cleared', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady({ week: '5' })

    fireEvent.change(screen.getByLabelText('Week (optional)'), { target: { value: '' } })

    await waitForSave()
    expect(updateList).toHaveBeenCalledWith('l1', expect.objectContaining({ week: '' }))
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

  it('badges the edited pattern card Unsaved until the save lands', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()
    expect(screen.queryByText('Unsaved')).not.toBeInTheDocument()

    // Two edits in a row: the second re-marks an already-marked pattern.
    fireEvent.change(screen.getByLabelText('Pattern spelling'), { target: { value: 'ai' } })
    fireEvent.change(screen.getByLabelText('Pattern spelling'), { target: { value: 'ai' } })
    expect(screen.getByText('Unsaved')).toBeInTheDocument()

    await waitForSave()
    expect(screen.queryByText('Unsaved')).not.toBeInTheDocument()
  })

  it('badges only the pattern card that was edited', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    const patternB: SpellingPattern = { id: 'p2', sound: 'long e', pattern: 'ee', frequency: 'common', words: [] }
    await renderReady({ patterns: [patternA, patternB] })

    fireEvent.change(within(screen.getByRole('region', { name: 'Pattern ee' })).getByLabelText('Pattern spelling'), {
      target: { value: 'ea' },
    })

    expect(within(screen.getByRole('region', { name: 'Pattern a_e' })).queryByText('Unsaved')).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Pattern ea' })).getByText('Unsaved')).toBeInTheDocument()

    await waitForSave()
    expect(screen.queryByText('Unsaved')).not.toBeInTheDocument()
  })

  it('keeps the badge on a new pattern until it is complete and saved', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady({ patterns: [] })

    fireEvent.click(screen.getByRole('button', { name: 'Add a pattern' }))
    expect(screen.getByText('Unsaved')).toBeInTheDocument()

    // Still incomplete: saves fire for the rest of the list, but the draft is
    // filtered out of the payload, so the badge stays.
    fireEvent.change(screen.getByLabelText('Target sound'), { target: { value: 'long a' } })
    await waitForSave()
    for (const [, data] of updateList.mock.calls) {
      expect((data as { patterns: unknown[] }).patterns).toEqual([])
    }
    expect(screen.getByText('Unsaved')).toBeInTheDocument()

    // Completing the pattern saves it, which clears the badge.
    fireEvent.change(screen.getByLabelText('Pattern spelling'), { target: { value: 'ai' } })
    await waitFor(() =>
      expect(updateList).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({ patterns: [expect.objectContaining({ pattern: 'ai' })] })
      )
    )
    await waitFor(() => expect(screen.queryByText('Unsaved')).not.toBeInTheDocument())
  })

  it('keeps the badge on a local-only pattern while clearing it for saved ones', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    // Add an incomplete new pattern (stays local-only), then edit the saved one.
    fireEvent.click(screen.getByRole('button', { name: '+ Add a pattern' }))
    fireEvent.change(screen.getAllByLabelText('Target sound')[1], { target: { value: 'long a' } })
    fireEvent.change(screen.getAllByLabelText('Pattern spelling')[0], { target: { value: 'ai' } })

    // The save persists the edited pattern; the incomplete one is filtered out of the payload.
    await waitForSave()

    expect(within(screen.getByRole('region', { name: 'Pattern ai' })).queryByText('Unsaved')).not.toBeInTheDocument()
    // The incomplete draft never went to the server, so its badge stays on.
    expect(within(screen.getByRole('region', { name: 'Untitled pattern' })).getByText('Unsaved')).toBeInTheDocument()
  })

  it('drops the badge when the marked pattern is deleted', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReady()

    fireEvent.change(screen.getByLabelText('Pattern spelling'), { target: { value: 'ai' } })
    expect(screen.getByText('Unsaved')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Delete pattern ai' }))
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))

    await waitFor(() => {
      expect(screen.queryByText('Unsaved')).not.toBeInTheDocument()
    })
  })
})

describe('ListEditorPage classroom', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ classes: [{ id: 'c1', name: 'Period 2' }] }),
      })
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  async function renderReadyWithList(overrides: Partial<WordList> = {}) {
    getList.mockResolvedValue({ ...list, ...overrides })
    render(<ListEditorPage listId="l1" />)
    await screen.findByRole('heading', { name: 'Week 5: Long A' })
    const select = screen.getByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())
    return select as HTMLSelectElement
  }

  it('shows the list classroom as selected', async () => {
    const select = await renderReadyWithList({ classId: 'c1' })
    expect(select.value).toBe('c1')
  })

  it('saves a classroom change immediately', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    const select = await renderReadyWithList()
    expect(select.value).toBe('')
    fireEvent.change(select, { target: { value: 'c1' } })
    await waitFor(() => expect(updateList).toHaveBeenCalledWith('l1', { classId: 'c1' }))
    expect(notifyListsChanged).toHaveBeenCalled()
  })

  it('clears the classroom with "No class"', async () => {
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    const select = await renderReadyWithList({ classId: 'c1' })
    fireEvent.change(select, { target: { value: '' } })
    await waitFor(() => expect(updateList).toHaveBeenCalledWith('l1', { classId: null }))
  })

  it('reverts the classroom when saving fails', async () => {
    updateList.mockRejectedValue(new Error('network down'))
    const select = await renderReadyWithList()
    fireEvent.change(select, { target: { value: 'c1' } })
    await waitFor(() => expect(updateList).toHaveBeenCalledWith('l1', { classId: 'c1' }))
    // Reverted to "No class".
    expect(select.value).toBe('')
  })

  it('restores the previous classroom when clearing fails', async () => {
    updateList.mockRejectedValue(new Error('network down'))
    const select = await renderReadyWithList({ classId: 'c1' })
    expect(select.value).toBe('c1')
    fireEvent.change(select, { target: { value: '' } })
    await waitFor(() => expect(updateList).toHaveBeenCalledWith('l1', { classId: null }))
    // Reverted to the previously assigned classroom.
    expect(select.value).toBe('c1')
  })

  it('serializes rapid classroom changes so the last selection persists', async () => {
    // The default beforeEach mocks one class; this test needs two.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          classes: [
            { id: 'c1', name: 'Period 2' },
            { id: 'c2', name: 'Blue group' },
          ],
        }),
      })
    )
    const calls: Array<{ classId: string | null }> = []
    let resolveFirst: (value: unknown) => void = () => {}
    updateList.mockImplementation(async (_id: string, data: object) => {
      // Only track classroom PUTs (content autosaves have no classId key).
      if ('classId' in data) {
        const classId = (data as { classId?: string | null }).classId ?? null
        calls.push({ classId })
        if (calls.length === 1) {
          // Hold the first PUT open; the second selection happens while it is in flight.
          await new Promise((resolve) => {
            resolveFirst = resolve as (value: unknown) => void
          })
        }
      }
      return { ...list }
    })
    const select = await renderReadyWithList()
    fireEvent.change(select, { target: { value: 'c1' } })
    // Wait for the first PUT to start.
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]).toEqual({ classId: 'c1' })
    fireEvent.change(select, { target: { value: 'c2' } })
    // The second PUT waits for the first: it has not fired yet.
    await new Promise((r) => setTimeout(r, 50))
    expect(calls).toHaveLength(1)
    resolveFirst({ ok: true })
    // The second PUT now fires with the latest selection.
    await waitFor(() => expect(calls).toHaveLength(2), { timeout: 2000 })
    expect(calls[1]).toEqual({ classId: 'c2' })
    await waitFor(() => expect(notifyListsChanged).toHaveBeenCalled())
    expect(select.value).toBe('c2')
  })

  it('does not revert a newer selection when an older classroom save fails', async () => {
    // The default beforeEach mocks one class; this test needs two.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          classes: [
            { id: 'c1', name: 'Period 2' },
            { id: 'c2', name: 'Blue group' },
          ],
        }),
      })
    )
    let failFirst = true
    updateList.mockImplementation(async (_id: string, data: object) => {
      if ('classId' in data && failFirst) {
        failFirst = false
        throw new Error('network down')
      }
      return { ...list }
    })
    const select = await renderReadyWithList()
    // First selection's PUT fails.
    fireEvent.change(select, { target: { value: 'c1' } })
    await waitFor(() => expect(updateList).toHaveBeenCalledWith('l1', { classId: 'c1' }))
    // Reverted to "No class" (the last persisted value).
    await waitFor(() => expect(select.value).toBe(''))
    // Second selection succeeds; the failed first save does not clobber it.
    fireEvent.change(select, { target: { value: 'c2' } })
    await waitFor(() => expect(updateList).toHaveBeenCalledWith('l1', { classId: 'c2' }))
    expect(select.value).toBe('c2')
  })

  it('flushes a pending content autosave before the classroom save', async () => {
    const callOrder: string[] = []
    updateList.mockImplementation(async (_id: string, data: object) => {
      if ('classId' in data) {
        callOrder.push(`classroom:${(data as { classId?: string | null }).classId ?? 'null'}`)
      } else {
        callOrder.push(`content:${(data as { name?: string }).name ?? '?'}`)
      }
      return { ...list, ...(data as object) }
    })
    const select = await renderReadyWithList()
    // Edit the list name: schedules a debounced autosave.
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    // Change the classroom before the debounce fires.
    fireEvent.change(select, { target: { value: 'c1' } })
    // The content save is flushed first, then the classroom save.
    await waitFor(() => expect(callOrder).toHaveLength(2), { timeout: 2000 })
    expect(callOrder[0]).toBe('content:Renamed')
    expect(callOrder[1]).toBe('classroom:c1')
    expect(select.value).toBe('c1')
  })

  it('waits for an in-flight content save before the classroom save', async () => {
    const callOrder: string[] = []
    let resolveContent: (value: unknown) => void = () => {}
    let contentStarted = false
    updateList.mockImplementation(async (_id: string, data: object) => {
      if ('classId' in data) {
        callOrder.push(`classroom:${(data as { classId?: string | null }).classId ?? 'null'}`)
      } else {
        callOrder.push(`content:${(data as { name?: string }).name ?? '?'}`)
        if (!contentStarted) {
          contentStarted = true
          // Hold the content PUT open.
          await new Promise((resolve) => {
            resolveContent = resolve as (value: unknown) => void
          })
        }
      }
      return { ...list, ...(data as object) }
    })
    const select = await renderReadyWithList()
    // Edit the list name and wait for the autosave to start (in-flight).
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    await waitFor(() => expect(contentStarted).toBe(true), { timeout: 2000 })
    // Change the classroom while the content save is in-flight.
    fireEvent.change(select, { target: { value: 'c1' } })
    // The classroom PUT waits: only the content PUT has fired.
    await new Promise((r) => setTimeout(r, 50))
    expect(callOrder).toEqual(['content:Renamed'])
    resolveContent({ ok: true })
    // The classroom PUT now fires.
    await waitFor(() => expect(callOrder).toHaveLength(2), { timeout: 2000 })
    expect(callOrder[1]).toBe('classroom:c1')
    expect(select.value).toBe('c1')
  })

  it('drops a stale classroom save when a newer selection starts during content flush', async () => {
    // The default beforeEach mocks one class; this test needs two.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          classes: [
            { id: 'c1', name: 'Period 2' },
            { id: 'c2', name: 'Blue group' },
          ],
        }),
      })
    )
    const classroomPuts: Array<string | null> = []
    let resolveContent: (value: unknown) => void = () => {}
    updateList.mockImplementation(async (_id: string, data: object) => {
      if ('classId' in data) {
        classroomPuts.push((data as { classId?: string | null }).classId ?? null)
      } else {
        // Hold the content PUT open so the first classroom save waits in flush.
        await new Promise((resolve) => {
          resolveContent = resolve as (value: unknown) => void
        })
      }
      return { ...list, ...(data as object) }
    })
    const select = await renderReadyWithList()
    // Edit the list name: schedules a debounced autosave.
    fireEvent.change(screen.getByLabelText('List name'), { target: { value: 'Renamed' } })
    // First classroom selection: starts flushing the pending content save.
    fireEvent.change(select, { target: { value: 'c1' } })
    // Wait for the content flush to start.
    await new Promise((r) => setTimeout(r, 100))
    // Second selection while the first is still flushing: the first becomes stale.
    fireEvent.change(select, { target: { value: 'c2' } })
    resolveContent({ ok: true })
    // Only the latest selection's PUT fires; the stale one is dropped.
    await waitFor(() => expect(classroomPuts).toHaveLength(1), { timeout: 2000 })
    expect(classroomPuts[0]).toBe('c2')
    expect(select.value).toBe('c2')
  })
})

describe('ListEditorPage rules section', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useRealTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  async function renderReadyWithRules(listOverrides: Partial<WordList> = {}) {
    getList.mockResolvedValue({ ...list, ...listOverrides })
    render(<ListEditorPage listId="l1" />)
    await screen.findByRole('heading', { name: 'Week 5: Long A' })
    await screen.findByRole('heading', { name: 'Rules (1)' })
  }

  it('saves an unscoped rule to the pattern when there is no classroom', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ classes: [] }) })
    vi.stubGlobal('fetch', fetchMock)
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    await renderReadyWithRules()

    const field = screen.getByLabelText('Rule, in the kids\u2019 words')
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'Magic e.' } })
    fireEvent.blur(field)

    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({
          patterns: expect.arrayContaining([expect.objectContaining({ id: 'p1', rule: 'Magic e.' })]),
        })
      )
    })
  })

  it('loads classroom rules and saves a rule to the classroom', async () => {
    const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'PUT') {
        expect(JSON.parse(init.body as string)).toEqual({ rules: { a_e: { rule: 'Magic e.' } } })
        return { ok: true, json: async () => ({}) }
      }
      if (String(url).includes('/api/classes/')) {
        return {
          ok: true,
          json: async () => ({
            class: { id: 'c1', name: 'Period 2', rules: { a_e: { rule: 'Old rule.' } } },
          }),
        }
      }
      return { ok: true, json: async () => ({ classes: [{ id: 'c1', name: 'Period 2' }] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    await renderReadyWithRules({ classId: 'c1' })

    // The classroom rule wins over the pattern's unscoped rule.
    const field = screen.getByLabelText('Rule, in the kids\u2019 words')
    await waitFor(() => expect(field).toHaveValue('Old rule.'))
    expect(screen.getByText('Shared with Period 2')).toBeInTheDocument()

    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'Magic e.' } })
    fireEvent.blur(field)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/classes/c1/rules', expect.objectContaining({ method: 'PUT' }))
    })
    // The list's own patterns were not touched: the rule went to the class.
    expect(updateList).not.toHaveBeenCalled()
  })

  it('clears classroom rules when the classroom is removed', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/api/classes/')) {
        return {
          ok: true,
          json: async () => ({
            class: { id: 'c1', name: 'Period 2', rules: { a_e: { rule: 'Old rule.' } } },
          }),
        }
      }
      return { ok: true, json: async () => ({ classes: [{ id: 'c1', name: 'Period 2' }] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    getList.mockResolvedValue({ ...list, classId: 'c1' })
    render(<ListEditorPage listId="l1" />)
    await screen.findByRole('heading', { name: 'Week 5: Long A' })
    await screen.findByRole('heading', { name: 'Rules (1)' })

    const select = screen.getByLabelText('Classroom')
    await waitFor(() => expect(select).not.toBeDisabled())
    fireEvent.change(select, { target: { value: '' } })

    await waitFor(() => expect(updateList).toHaveBeenCalledWith('l1', { classId: null }))
    // Back to unscoped: the classroom rule no longer applies.
    await waitFor(() => {
      expect(screen.queryByText('Shared with Period 2')).not.toBeInTheDocument()
    })
  })

  it('treats an HTTP error from the classroom fetch as no classroom', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/api/classes/')) {
        return { ok: false, status: 500 }
      }
      return { ok: true, json: async () => ({ classes: [{ id: 'c1', name: 'Period 2' }] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    await renderReadyWithRules({ classId: 'c1' })

    // The classroom rule never loads: the field falls back to the (empty) unscoped rule.
    const field = screen.getByLabelText('Rule, in the kids\u2019 words')
    await waitFor(() => expect(field).toHaveValue(''))
    expect(screen.queryByText('Shared with Period 2')).not.toBeInTheDocument()
  })

  it('shows the classroom with unscoped rules when the class has no rules yet', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/api/classes/')) {
        return {
          ok: true,
          json: async () => ({ class: { id: 'c1', name: 'Period 2' } }),
        }
      }
      return { ok: true, json: async () => ({ classes: [{ id: 'c1', name: 'Period 2' }] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    await renderReadyWithRules({ classId: 'c1' })

    // The classroom is known, but no classroom rule exists for the pattern:
    // the field falls back to the unscoped rule and nothing is marked shared.
    const section = screen.getByRole('region', { name: 'Spelling rules' })
    await waitFor(() => {
      expect(within(section).getByText('Period 2')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Rule, in the kids\u2019 words')).toHaveValue('')
    expect(screen.queryByText('Shared with Period 2')).not.toBeInTheDocument()
  })

  it('ignores a classroom fetch that resolves after unmount', async () => {
    let resolveClassFetch: (res: object) => void = () => {}
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/api/classes/c1')) {
        return new Promise((resolve) => {
          resolveClassFetch = resolve
        })
      }
      return { ok: true, json: async () => ({ classes: [{ id: 'c1', name: 'Period 2' }] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    getList.mockResolvedValue({ ...list, classId: 'c1' })
    const { unmount } = render(<ListEditorPage listId="l1" />)
    await screen.findByRole('heading', { name: 'Week 5: Long A' })
    await screen.findByRole('heading', { name: 'Rules (1)' })

    unmount()
    resolveClassFetch({
      ok: true,
      json: async () => ({ class: { id: 'c1', name: 'Period 2', rules: { a_e: { rule: 'Old rule.' } } } }),
    })
    // Give the resolution a chance to run; no state update should happen.
    await new Promise((r) => setTimeout(r, 50))
  })

  it('keeps the draft and shows an error when saving a classroom rule fails', async () => {
    const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'PUT') {
        return { ok: false, status: 500 }
      }
      if (String(url).includes('/api/classes/')) {
        return {
          ok: true,
          json: async () => ({ class: { id: 'c1', name: 'Period 2', rules: { a_e: { rule: 'Old rule.' } } } }),
        }
      }
      return { ok: true, json: async () => ({ classes: [{ id: 'c1', name: 'Period 2' }] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    await renderReadyWithRules({ classId: 'c1' })

    const field = screen.getByLabelText('Rule, in the kids\u2019 words')
    await waitFor(() => expect(field).toHaveValue('Old rule.'))
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'Magic e.' } })
    fireEvent.blur(field)

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Could not save the rule. Try again.')
    })
    // The draft survives the failed save so the teacher can retry.
    expect(field).toHaveValue('Magic e.')
    expect(fetchMock).toHaveBeenCalledWith('/api/classes/c1/rules', expect.objectContaining({ method: 'PUT' }))
  })

  it('saves a classroom rule while the classroom is still loading', async () => {
    let resolveClassFetch: (res: object) => void = () => {}
    const fetchMock = vi.fn(async (url: string, init?: { method?: string; body?: string }) => {
      if (init?.method === 'PUT') {
        expect(JSON.parse(init.body as string)).toEqual({ rules: { a_e: { rule: 'Magic e.' } } })
        return { ok: true, json: async () => ({}) }
      }
      if (String(url).includes('/api/classes/c1')) {
        return new Promise((resolve) => {
          resolveClassFetch = resolve
        })
      }
      return { ok: true, json: async () => ({ classes: [{ id: 'c1', name: 'Period 2' }] }) }
    })
    vi.stubGlobal('fetch', fetchMock)
    await renderReadyWithRules({ classId: 'c1' })

    const field = screen.getByLabelText('Rule, in the kids\u2019 words')
    fireEvent.focus(field)
    fireEvent.change(field, { target: { value: 'Magic e.' } })
    fireEvent.blur(field)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/classes/c1/rules', expect.objectContaining({ method: 'PUT' }))
    })
    // Saved against a null previous value: the classroom rule map starts fresh.
    await waitFor(() => expect(field).toHaveValue('Magic e.'))
    resolveClassFetch({ ok: true, json: async () => ({ class: { id: 'c1', name: 'Period 2', rules: {} } }) })
  })

  it('clears an unscoped rule on one pattern without touching the other', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ classes: [] }) })
    vi.stubGlobal('fetch', fetchMock)
    updateList.mockImplementation(async (_id: string, data: object) => ({ ...list, ...data }))
    getList.mockResolvedValue({
      ...list,
      patterns: [
        { ...patternA, rule: 'Magic e.' },
        { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'less-common', words: ['rain'], rule: 'Keep ai.' },
      ],
    })
    render(<ListEditorPage listId="l1" />)
    await screen.findByRole('heading', { name: 'Week 5: Long A' })
    await screen.findByRole('heading', { name: 'Rules (2)' })

    const fields = screen.getAllByLabelText('Rule, in the kids\u2019 words')
    expect(fields).toHaveLength(2)
    fireEvent.focus(fields[0])
    fireEvent.change(fields[0], { target: { value: '' } })
    fireEvent.blur(fields[0])

    await waitFor(() => {
      expect(updateList).toHaveBeenCalledWith(
        'l1',
        expect.objectContaining({
          patterns: expect.arrayContaining([
            expect.objectContaining({ id: 'p1', rule: undefined }),
            expect.objectContaining({ id: 'p2', rule: 'Keep ai.' }),
          ]),
        })
      )
    })
  })
})
