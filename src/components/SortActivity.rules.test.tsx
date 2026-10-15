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

vi.mock('@/lib/confetti', () => ({
  fireWinConfetti: vi.fn(),
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

describe('SortActivity rule recall', () => {
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

  it('continues without rule recall when the class fetch fails', async () => {
    ;(fetch as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('down'))
    render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    // No class loaded: the column header shows no recalled rule.
    const column = await screen.findByLabelText('Pattern a_e column')
    expect(within(column).queryByText('Your class decided:')).not.toBeInTheDocument()
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
    const column = await screen.findByLabelText('Pattern a_e column')
    expect(within(column).queryByText('Your class decided:')).not.toBeInTheDocument()
  })

  it('does not re-celebrate when the list re-renders after a win', async () => {
    const { rerender } = render(<SortActivity list={list} onExit={vi.fn()} />)
    placeViaBar('cake', 'a_e')
    placeViaBar('bake', 'a_e')
    placeViaBar('rain', 'ai')
    placeViaBar('said', 'odd')
    await screen.findByRole('dialog')
    // A new list object (same content) recomputes the word bank and re-runs
    // the win effect; the already-celebrated win must not fire again.
    rerender(<SortActivity list={{ ...list }} onExit={vi.fn()} />)
    await new Promise((r) => setTimeout(r, 400))
    expect(screen.getAllByRole('dialog')).toHaveLength(1)
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

  it('does not show an Edit button on desktop column headers during the game', async () => {
    // Desktop layout: restore the real matchMedia.
    window.matchMedia = originalMatchMedia
    render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    const column = await screen.findByLabelText('Pattern a_e drop column')
    // The rule is still displayed, but mid-game editing is not allowed.
    expect(within(column).getByText('Your class decided:')).toBeInTheDocument()
    expect(within(column).getByText('Magic e.')).toBeInTheDocument()
    expect(within(column).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('does not show an Edit button on mobile column headers during the game', async () => {
    render(<SortActivity list={list} onExit={vi.fn()} classId="c1" />)
    const column = await screen.findByLabelText('Pattern a_e column')
    expect(within(column).getByText('Your class decided:')).toBeInTheDocument()
    expect(within(column).getByText('Magic e.')).toBeInTheDocument()
    expect(within(column).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })

  it('does not show an Edit button for unscoped rules during the game', async () => {
    const listWithRule = {
      ...list,
      patterns: list.patterns.map((p) => (p.pattern === 'ai' ? { ...p, rule: 'ai never ends a word.' } : p)),
    } as unknown as WordList
    render(<SortActivity list={listWithRule} onExit={vi.fn()} />)
    const column = await screen.findByLabelText('Pattern ai column')
    expect(within(column).getByText('The rule:')).toBeInTheDocument()
    expect(within(column).getByText('ai never ends a word.')).toBeInTheDocument()
    expect(within(column).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })
})
