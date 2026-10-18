import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import WorksheetPicker, { WORKSHEET_TYPE_INFO } from './WorksheetPicker'
import type { WordList } from '@/models/WordList'

const { getList } = vi.hoisted(() => ({ getList: vi.fn() }))
vi.mock('@/lib/lists-api', () => ({ getList }))

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }))
vi.mock('@/lib/report-error', () => ({ reportError }))

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5: Long A',
  patterns: [
    { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'] },
    { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'common', words: ['rain'], isLocked: true },
  ],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('WorksheetPicker', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getList.mockResolvedValue(list)
  })

  it('describes all seven worksheet types', () => {
    expect(Object.keys(WORKSHEET_TYPE_INFO)).toHaveLength(7)
  })

  it('shows a loading state while the list loads', () => {
    getList.mockImplementation(() => new Promise(() => {}))
    render(<WorksheetPicker listId="l1" />)
    expect(screen.getByRole('status', { name: 'Loading worksheets' })).toBeInTheDocument()
  })

  it('shows a not-found state for a missing list', async () => {
    getList.mockRejectedValue(new Error('List not found'))
    render(<WorksheetPicker listId="l1" />)
    expect(await screen.findByText('List not found')).toBeInTheDocument()
    expect(reportError).toHaveBeenCalled()
  })

  it('shows an error state with retry', async () => {
    getList.mockRejectedValueOnce(new Error('boom'))
    render(<WorksheetPicker listId="l1" />)
    expect(await screen.findByText('Could not load this list')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    await waitFor(() => expect(getList).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Printable worksheets')).toBeInTheDocument()
  })

  it('shows an error state for a non-Error rejection', async () => {
    getList.mockRejectedValueOnce('a string, not an Error')
    render(<WorksheetPicker listId="l1" />)
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
    const { unmount } = render(<WorksheetPicker listId="l1" />)
    expect(screen.getByRole('status', { name: 'Loading worksheets' })).toBeInTheDocument()

    unmount()
    resolveLoad(list)
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('heading', { name: 'Printable worksheets' })).not.toBeInTheDocument()
  })

  it('does not update state if unmounted during a failing load', async () => {
    let rejectLoad!: (e: Error) => void
    getList.mockImplementation(
      () =>
        new Promise((_, rej) => {
          rejectLoad = rej
        })
    )
    const { unmount } = render(<WorksheetPicker listId="l1" />)

    unmount()
    rejectLoad(new Error('network down'))
    await new Promise((r) => setTimeout(r, 50))
    expect(screen.queryByRole('heading', { name: 'Could not load this list' })).not.toBeInTheDocument()
  })

  it('checks every type by default and prints the full selection', async () => {
    render(<WorksheetPicker listId="l1" />)
    expect(await screen.findByRole('heading', { name: 'Printable worksheets' })).toBeInTheDocument()
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(7)
    boxes.forEach((box) => expect(box).toBeChecked())

    fireEvent.click(screen.getByRole('button', { name: 'Preview and print' }))
    expect(push).toHaveBeenCalledWith(
      '/lists/l1/worksheets/print?types=spelling-list,cut-sort,fill-blank,word-search,crossword,reading,parent-note'
    )
  })

  it('toggles a single type off and prints the rest', async () => {
    render(<WorksheetPicker listId="l1" />)
    await screen.findByRole('heading', { name: 'Printable worksheets' })
    fireEvent.click(screen.getByRole('checkbox', { name: 'Word search' }))
    expect(screen.getByRole('checkbox', { name: 'Word search' })).not.toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: 'Preview and print' }))
    const url = push.mock.calls[0][0] as string
    expect(url).not.toContain('word-search')
    expect(url).toContain('crossword')

    // Toggling back on re-checks it.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Word search' }))
    expect(screen.getByRole('checkbox', { name: 'Word search' })).toBeChecked()
  })

  it('uses a theme-adaptive accent color for the type checkboxes', async () => {
    // Issue #435: accent-black renders as a washed-out gray in dark mode
    // (Chromium brightens dark accent colors under color-scheme: dark).
    // accent-ink follows the theme's ink token, matching the checked card's
    // border-ink highlight in both themes.
    render(<WorksheetPicker listId="l1" />)
    await screen.findByRole('heading', { name: 'Printable worksheets' })
    const boxes = screen.getAllByRole('checkbox')
    expect(boxes).toHaveLength(7)
    boxes.forEach((box) => {
      expect(box).not.toHaveClass('accent-black')
      expect(box).toHaveClass('accent-ink')
    })
  })

  it('clear disables printing with a hint; select all restores it', async () => {
    render(<WorksheetPicker listId="l1" />)
    await screen.findByRole('heading', { name: 'Printable worksheets' })

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(screen.getByRole('button', { name: 'Preview and print' })).toBeDisabled()
    expect(screen.getByText('Select at least one worksheet type to continue.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(screen.getByRole('button', { name: 'Preview and print' })).not.toBeDisabled()
    expect(screen.getAllByRole('checkbox').every((box) => (box as HTMLInputElement).checked)).toBe(true)
  })

  it('shows a no-words notice when the list has nothing printable', async () => {
    getList.mockResolvedValue({
      ...list,
      patterns: [{ id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'common', words: ['rain'], isLocked: true }],
    })
    render(<WorksheetPicker listId="l1" />)
    expect(await screen.findByText('No words to print yet')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Preview and print' })).not.toBeInTheDocument()
  })
})
