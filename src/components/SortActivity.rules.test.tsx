import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import type { WordList } from '@/models/WordList'
import SortActivity from './SortActivity'

vi.mock('@/lib/sort-sounds', () => ({
  playCorrectSound: vi.fn(),
  playIncorrectSound: vi.fn(),
  playDropSound: vi.fn(),
  playPickupSound: vi.fn(),
  playWinFanfare: vi.fn(),
}))

const list = {
  id: 'list-1',
  userId: 'u1',
  name: 'Week 5',
  color: 'sky',
  patterns: [
    {
      id: 'pat-ae',
      pattern: 'a_e',
      words: ['cake', 'bake'],
      lockedWords: [],
    },
    {
      id: 'pat-ai',
      pattern: 'ai',
      words: ['rain'],
      lockedWords: [],
    },
    {
      id: 'pat-odd',
      pattern: 'odd',
      words: ['said'],
      lockedWords: [],
    },
  ],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
} as unknown as WordList

// Force the mobile layout: match the max-width query, nothing else.
const originalMatchMedia = window.matchMedia
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }),
  })
})

afterEach(() => {
  window.matchMedia = originalMatchMedia
})

function placeViaBar(word: string, pattern: string) {
  fireEvent.click(screen.getByRole('button', { name: `Select the word ${word}` }))
  fireEvent.click(screen.getByRole('button', { name: `Put ${word} in the ${pattern} column` }))
}

describe('SortActivity rule capture', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string, init?: RequestInit) => {
        if (url === '/api/classes/c1') {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              class: {
                id: 'c1',
                name: 'Period 2',
                rules: { a_e: { rule: 'Magic e.' } },
              },
            }),
          })
        }
        if (String(url).includes('/api/classes/c1/rules') && init?.method === 'PUT') {
          const payload = JSON.parse(String(init.body))
          return Promise.resolve({
            ok: true,
            json: async () => ({
              rules: { a_e: { rule: 'Magic e.' }, ...payload.rules },
            }),
          })
        }
        return Promise.resolve({ ok: true, json: async () => ({}) })
      })
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  async function winAndOpenCapture() {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    placeViaBar('cake', 'a_e')
    placeViaBar('bake', 'a_e')
    placeViaBar('rain', 'ai')
    placeViaBar('said', 'odd')
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tell the rule' }))
    return screen.getByRole('dialog')
  }

  it('opens rule capture from the win dialog and saves unscoped rules to the list', async () => {
    const capture = await winAndOpenCapture()
    expect(within(capture).getByText('What rule did you discover?')).toBeInTheDocument()
    fireEvent.change(within(capture).getByLabelText(/Pattern a_e/), {
      target: { value: 'Magic e.' },
    })
    fireEvent.click(within(capture).getByRole('button', { name: 'Save rules' }))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/lists/list-1', expect.objectContaining({ method: 'PUT' }))
    })
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.patterns.find((p: { pattern: string }) => p.pattern === 'a_e').rule).toBe('Magic e.')
    // The dialog closes after a successful save.
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('saves rules to the active class when one is selected', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    placeViaBar('cake', 'a_e')
    placeViaBar('bake', 'a_e')
    placeViaBar('rain', 'ai')
    placeViaBar('said', 'odd')
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tell the rule' }))
    const capture = screen.getByRole('dialog')
    // The class's existing rule is prefilled (recall).
    expect(within(capture).getByText('What rule did Period 2 discover?')).toBeInTheDocument()
    await waitFor(() => {
      expect(within(capture).getByLabelText(/Pattern a_e/)).toHaveValue('Magic e.')
    })
    fireEvent.change(within(capture).getByLabelText(/Pattern ai/), {
      target: { value: 'ai never ends a word.' },
    })
    fireEvent.click(within(capture).getByRole('button', { name: 'Save rules' }))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/classes/c1/rules', expect.objectContaining({ method: 'PUT' }))
    })
    const putCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find((c) =>
      String(c[0]).includes('/api/classes/c1/rules')
    )
    expect(putCall).toBeDefined()
    const body = JSON.parse(String(putCall![1].body))
    expect(body.rules).toEqual({ ai: { rule: 'ai never ends a word.' } })
  })

  it('shows an error when saving rules fails', async () => {
    const capture = await winAndOpenCapture()
    ;(fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('down'))
    fireEvent.click(within(capture).getByRole('button', { name: 'Save rules' }))
    expect(await within(capture).findByRole('alert')).toHaveTextContent('Could not save the rules.')
  })

  it('shows an error when the list save returns an error status', async () => {
    const capture = await winAndOpenCapture()
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 500 })
    fireEvent.change(within(capture).getByLabelText(/Pattern a_e/), {
      target: { value: 'Magic e.' },
    })
    fireEvent.click(within(capture).getByRole('button', { name: 'Save rules' }))
    expect(await within(capture).findByRole('alert')).toHaveTextContent('Could not save the rules.')
  })

  it('shows an error when the class rules save returns an error status', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    placeViaBar('cake', 'a_e')
    placeViaBar('bake', 'a_e')
    placeViaBar('rain', 'ai')
    placeViaBar('said', 'odd')
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tell the rule' }))
    const capture = screen.getByRole('dialog')
    // The class fetch (call 0) succeeded; fail only the rules PUT.
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) =>
      String(url).includes('/rules')
        ? Promise.resolve({ ok: false, status: 500 })
        : Promise.resolve({ ok: true, json: async () => ({}) })
    )
    fireEvent.change(within(capture).getByLabelText(/Pattern ai/), {
      target: { value: 'ai never ends a word.' },
    })
    fireEvent.click(within(capture).getByRole('button', { name: 'Save rules' }))
    expect(await within(capture).findByRole('alert')).toHaveTextContent('Could not save the rules.')
  })

  it('keeps the current rules when the save response is malformed', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    placeViaBar('cake', 'a_e')
    placeViaBar('bake', 'a_e')
    placeViaBar('rain', 'ai')
    placeViaBar('said', 'odd')
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tell the rule' }))
    const capture = screen.getByRole('dialog')
    await waitFor(() => {
      expect(within(capture).getByLabelText(/Pattern a_e/)).toHaveValue('Magic e.')
    })
    // PUT succeeds but returns no rules: the component must not crash.
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) =>
      String(url).includes('/rules')
        ? Promise.resolve({ ok: true, json: async () => ({}) })
        : Promise.resolve({ ok: true, json: async () => ({}) })
    )
    fireEvent.change(within(capture).getByLabelText(/Pattern ai/), {
      target: { value: 'ai never ends a word.' },
    })
    fireEvent.click(within(capture).getByRole('button', { name: 'Save rules' }))
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('omits cleared rules from the class payload', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    placeViaBar('cake', 'a_e')
    placeViaBar('bake', 'a_e')
    placeViaBar('rain', 'ai')
    placeViaBar('said', 'odd')
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tell the rule' }))
    const capture = screen.getByRole('dialog')
    await waitFor(() => {
      expect(within(capture).getByLabelText(/Pattern a_e/)).toHaveValue('Magic e.')
    })
    // Clear the existing rule: it must not be sent.
    fireEvent.change(within(capture).getByLabelText(/Pattern a_e/), { target: { value: '' } })
    fireEvent.click(within(capture).getByRole('button', { name: 'Save rules' }))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/classes/c1/rules', expect.objectContaining({ method: 'PUT' }))
    })
    const putCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.find((c) =>
      String(c[0]).includes('/api/classes/c1/rules')
    )
    expect(putCall).toBeDefined()
    const body = JSON.parse(String(putCall![1].body))
    expect(body.rules).toEqual({})
  })

  it('clears an unscoped rule when the field is emptied', async () => {
    const listWithRule = {
      ...list,
      patterns: list.patterns.map((p) => (p.pattern === 'a_e' ? { ...p, rule: 'Magic e.' } : p)),
    } as unknown as WordList
    render(<SortActivity list={listWithRule} onExit={vi.fn()} />)
    placeViaBar('cake', 'a_e')
    placeViaBar('bake', 'a_e')
    placeViaBar('rain', 'ai')
    placeViaBar('said', 'odd')
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tell the rule' }))
    const capture = screen.getByRole('dialog')
    fireEvent.change(within(capture).getByLabelText(/Pattern a_e/), { target: { value: '' } })
    fireEvent.click(within(capture).getByRole('button', { name: 'Save rules' }))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/lists/list-1', expect.objectContaining({ method: 'PUT' }))
    })
    const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body)
    expect(body.patterns.find((p: { pattern: string }) => p.pattern === 'a_e').rule).toBeUndefined()
  })

  it('prefills unscoped rules from the list patterns', async () => {
    const listWithRule = {
      ...list,
      patterns: list.patterns.map((p) => (p.pattern === 'ai' ? { ...p, rule: 'ai never ends a word.' } : p)),
    } as unknown as WordList
    render(<SortActivity list={listWithRule} onExit={vi.fn()} />)
    placeViaBar('cake', 'a_e')
    placeViaBar('bake', 'a_e')
    placeViaBar('rain', 'ai')
    placeViaBar('said', 'odd')
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tell the rule' }))
    const capture = screen.getByRole('dialog')
    expect(within(capture).getByLabelText(/Pattern ai/)).toHaveValue('ai never ends a word.')
  })

  it('continues without rule recall when the class fetch fails', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('down'))
    render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    placeViaBar('cake', 'a_e')
    placeViaBar('bake', 'a_e')
    placeViaBar('rain', 'ai')
    placeViaBar('said', 'odd')
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tell the rule' }))
    const capture = await screen.findByRole('dialog')
    // No class loaded: falls back to the generic heading.
    expect(within(capture).getByText('What rule did you discover?')).toBeInTheDocument()
  })

  it('ignores the class fetch result after unmount', async () => {
    let resolveFetch!: (value: { ok: boolean; json: () => Promise<unknown> }) => void
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        })
    )
    const { unmount } = render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    unmount()
    // Resolving after unmount must not set state (no React warning, no crash).
    resolveFetch({ ok: true, json: async () => ({ class: { id: 'c1', name: 'x', rules: {} } }) })
    await new Promise((r) => setTimeout(r, 10))
  })

  it('ignores a class fetch rejection after unmount', async () => {
    let rejectFetch!: (reason: Error) => void
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation(
      () =>
        new Promise((_, reject) => {
          rejectFetch = reject
        })
    )
    const { unmount } = render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    unmount()
    rejectFetch(new Error('down'))
    await new Promise((r) => setTimeout(r, 10))
  })

  it('continues without rule recall when the class fetch returns an error status', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 404 })
    render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    placeViaBar('cake', 'a_e')
    placeViaBar('bake', 'a_e')
    placeViaBar('rain', 'ai')
    placeViaBar('said', 'odd')
    const dialog = await screen.findByRole('dialog')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Tell the rule' }))
    const capture = await screen.findByRole('dialog')
    expect(within(capture).getByText('What rule did you discover?')).toBeInTheDocument()
  })

  it('skips rule capture without saving', async () => {
    const capture = await winAndOpenCapture()
    fireEvent.click(within(capture).getByRole('button', { name: 'Skip' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalledWith('/api/lists/list-1', expect.anything())
  })

  it('shows the class rule under the desktop column header', async () => {
    // Desktop layout: restore the real matchMedia.
    window.matchMedia = originalMatchMedia
    render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    const column = await screen.findByLabelText('Pattern a_e drop column')
    expect(within(column).getByText('Your class decided:')).toBeInTheDocument()
    expect(within(column).getByText('Magic e.')).toBeInTheDocument()
  })

  it('shows the class rule under the column header with the class label', async () => {
    // Desktop layout: restore the real matchMedia.
    window.matchMedia = originalMatchMedia
    render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    const column = await screen.findByLabelText('Pattern a_e drop column')
    expect(within(column).getByText('Your class decided:')).toBeInTheDocument()
    expect(within(column).getByText('Magic e.')).toBeInTheDocument()
  })

  it('edits a class rule from the desktop column header', async () => {
    window.matchMedia = originalMatchMedia
    render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    const column = await screen.findByLabelText('Pattern a_e drop column')
    fireEvent.click(within(column).getByRole('button', { name: 'Edit' }))
    fireEvent.change(within(column).getByLabelText('Edit rule'), {
      target: { value: 'Desktop edited rule.' },
    })
    fireEvent.click(within(column).getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/classes/c1/rules', expect.objectContaining({ method: 'PUT' }))
    })
    await waitFor(() => {
      expect(within(column).getByText('Desktop edited rule.')).toBeInTheDocument()
    })
  })

  it('shows the class rule under the column header with the class label', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    const column = await screen.findByLabelText('Pattern a_e column')
    expect(within(column).getByText('Your class decided:')).toBeInTheDocument()
    expect(within(column).getByText('Magic e.')).toBeInTheDocument()
  })

  it('shows the unscoped rule under the column header with the default label', async () => {
    const listWithRule = {
      ...list,
      patterns: list.patterns.map((p) => (p.pattern === 'ai' ? { ...p, rule: 'ai never ends a word.' } : p)),
    } as unknown as WordList
    render(<SortActivity list={listWithRule} onExit={vi.fn()} />)
    const column = await screen.findByLabelText('Pattern ai column')
    expect(within(column).getByText('The rule:')).toBeInTheDocument()
    expect(within(column).getByText('ai never ends a word.')).toBeInTheDocument()
  })

  it('edits a class rule from the column header', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    const column = await screen.findByLabelText('Pattern a_e column')
    // The rules PUT returns the merged rules.
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) =>
      String(url).includes('/rules')
        ? Promise.resolve({
            ok: true,
            json: async () => ({ rules: { a_e: { rule: 'Magic e makes the vowel say its name.' } } }),
          })
        : Promise.resolve({ ok: true, json: async () => ({}) })
    )
    fireEvent.click(within(column).getByRole('button', { name: 'Edit' }))
    fireEvent.change(within(column).getByLabelText('Edit rule'), {
      target: { value: 'Magic e makes the vowel say its name.' },
    })
    fireEvent.click(within(column).getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/classes/c1/rules', expect.objectContaining({ method: 'PUT' }))
    })
    // The updated rule displays immediately.
    await waitFor(() => {
      expect(within(column).getByText('Magic e makes the vowel say its name.')).toBeInTheDocument()
    })
  })

  it('edits an unscoped rule from the column header', async () => {
    const listWithRule = {
      ...list,
      patterns: list.patterns.map((p) => (p.pattern === 'ai' ? { ...p, rule: 'ai never ends a word.' } : p)),
    } as unknown as WordList
    render(<SortActivity list={listWithRule} onExit={vi.fn()} />)
    const column = await screen.findByLabelText('Pattern ai column')
    fireEvent.click(within(column).getByRole('button', { name: 'Edit' }))
    fireEvent.change(within(column).getByLabelText('Edit rule'), {
      target: { value: 'ai is in the middle.' },
    })
    fireEvent.click(within(column).getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/lists/list-1', expect.objectContaining({ method: 'PUT' }))
    })
    await waitFor(() => {
      expect(within(column).getByText('ai is in the middle.')).toBeInTheDocument()
    })
  })

  it('keeps the current rules when the column save response is malformed', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    const column = await screen.findByLabelText('Pattern a_e column')
    // PUT succeeds but returns no rules: the component must not crash.
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) =>
      String(url).includes('/rules')
        ? Promise.resolve({ ok: true, json: async () => ({}) })
        : Promise.resolve({ ok: true, json: async () => ({}) })
    )
    fireEvent.click(within(column).getByRole('button', { name: 'Edit' }))
    fireEvent.change(within(column).getByLabelText('Edit rule'), {
      target: { value: 'Updated rule.' },
    })
    fireEvent.click(within(column).getByRole('button', { name: 'Save' }))
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/classes/c1/rules', expect.objectContaining({ method: 'PUT' }))
    })
    // The original rule is kept (fallback), no crash. The card stays in
    // edit mode; cancel to see the restored rule.
    fireEvent.click(within(column).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => {
      expect(within(column).getByText('Magic e.')).toBeInTheDocument()
    })
  })

  it('shows an error when saving a column rule fails', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    const column = await screen.findByLabelText('Pattern a_e column')
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) =>
      String(url).includes('/rules')
        ? Promise.reject(new Error('down'))
        : Promise.resolve({ ok: true, json: async () => ({}) })
    )
    fireEvent.click(within(column).getByRole('button', { name: 'Edit' }))
    fireEvent.click(within(column).getByRole('button', { name: 'Save' }))
    expect(await within(column).findByRole('alert')).toHaveTextContent('Could not save the rule.')
  })

  it('shows an error when the column rule save returns an error status', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    const column = await screen.findByLabelText('Pattern a_e column')
    ;(fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) =>
      String(url).includes('/rules')
        ? Promise.resolve({ ok: false, status: 500 })
        : Promise.resolve({ ok: true, json: async () => ({}) })
    )
    fireEvent.click(within(column).getByRole('button', { name: 'Edit' }))
    fireEvent.click(within(column).getByRole('button', { name: 'Save' }))
    expect(await within(column).findByRole('alert')).toHaveTextContent('Could not save the rule.')
  })

  it('shows an error when the unscoped column rule save returns an error status', async () => {
    const listWithRule = {
      ...list,
      patterns: list.patterns.map((p) => (p.pattern === 'ai' ? { ...p, rule: 'ai never ends a word.' } : p)),
    } as unknown as WordList
    render(<SortActivity list={listWithRule} onExit={vi.fn()} />)
    const column = await screen.findByLabelText('Pattern ai column')
    ;(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 500 })
    fireEvent.click(within(column).getByRole('button', { name: 'Edit' }))
    fireEvent.click(within(column).getByRole('button', { name: 'Save' }))
    expect(await within(column).findByRole('alert')).toHaveTextContent('Could not save the rule.')
  })
})
