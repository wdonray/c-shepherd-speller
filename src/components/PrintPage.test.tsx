import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import PrintPage from './PrintPage'
import type { WordList } from '@/models/WordList'

const { getList } = vi.hoisted(() => ({ getList: vi.fn() }))
vi.mock('@/lib/lists-api', () => ({ getList }))

const { reportError } = vi.hoisted(() => ({ reportError: vi.fn() }))
vi.mock('@/lib/report-error', () => ({ reportError }))

vi.mock('@/lib/tts', () => ({ speak: vi.fn() }))

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
    { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'], keywordEmoji: '🐝' },
    { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'less-common', words: ['rain'], isLocked: true },
  ],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('PrintPage', () => {
  const printSpy = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    getList.mockResolvedValue(list)
    Object.defineProperty(window, 'print', { value: printSpy, writable: true, configurable: true })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('shows a loading state while the list loads and does not print yet', () => {
    getList.mockImplementation(() => new Promise(() => {}))
    render(<PrintPage listId="l1" />)
    expect(screen.getByRole('status', { name: 'Loading print preview' })).toBeInTheDocument()
    expect(printSpy).not.toHaveBeenCalled()
  })

  it('renders the print chart and calls window.print() once the list loads', async () => {
    render(<PrintPage listId="l1" />)
    // The poster shows the target sound and only the unlocked pattern.
    expect(await screen.findByText('long a')).toBeInTheDocument()
    expect(screen.getByText('cake')).toBeInTheDocument()
    expect(screen.queryByText('rain')).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    await waitFor(() => {
      expect(printSpy).toHaveBeenCalledTimes(1)
    })
  })

  it('shows a not-found state without printing when the list does not exist', async () => {
    getList.mockRejectedValue(new Error('List not found'))
    render(<PrintPage listId="missing" />)
    expect(await screen.findByRole('heading', { name: 'List not found' })).toBeInTheDocument()
    expect(printSpy).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Back to my lists' })).toHaveAttribute('href', '/')
  })

  it('shows an error state without printing when loading fails, and retries', async () => {
    getList.mockRejectedValueOnce(new Error('network down'))
    render(<PrintPage listId="l1" />)
    expect(await screen.findByRole('heading', { name: 'Could not load this list' })).toBeInTheDocument()
    expect(printSpy).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('long a')).toBeInTheDocument()
    await waitFor(() => {
      expect(printSpy).toHaveBeenCalledTimes(1)
    })
    expect(getList).toHaveBeenCalledTimes(2)
  })

  it('treats a non-Error rejection as a load error', async () => {
    getList.mockRejectedValue('boom')
    render(<PrintPage listId="l1" />)
    expect(await screen.findByRole('heading', { name: 'Could not load this list' })).toBeInTheDocument()
    expect(printSpy).not.toHaveBeenCalled()
  })

  it('does not print if unmounted during load', async () => {
    let resolveLoad!: (v: WordList) => void
    getList.mockImplementation(
      () =>
        new Promise((r) => {
          resolveLoad = r
        })
    )
    const { unmount } = render(<PrintPage listId="l1" />)
    expect(screen.getByRole('status', { name: 'Loading print preview' })).toBeInTheDocument()

    unmount()
    resolveLoad(list)
    await new Promise((r) => setTimeout(r, 100))
    // No crash, no state update after unmount.
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
    const { unmount } = render(<PrintPage listId="l1" />)

    unmount()
    rejectLoad(new Error('network down'))
    await new Promise((r) => setTimeout(r, 100))
    expect(printSpy).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: 'Could not load this list' })).not.toBeInTheDocument()
  })
})
