import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import NavigationTracker from './navigation-tracker'
import { noteNavigation } from '@/lib/navigation-history'

vi.mock('@/lib/navigation-history', () => ({ noteNavigation: vi.fn() }))

const usePathnameMock = vi.fn()
const useSearchParamsMock = vi.fn()

vi.mock('next/navigation', () => ({
  usePathname: () => usePathnameMock(),
  useSearchParams: () => useSearchParamsMock(),
}))

describe('NavigationTracker', () => {
  beforeEach(() => {
    vi.mocked(noteNavigation).mockClear()
    usePathnameMock.mockReturnValue('/home')
    useSearchParamsMock.mockReturnValue({ toString: () => '' })
  })

  it('renders nothing visible', () => {
    const { container } = render(<NavigationTracker />)
    expect(container).toBeEmptyDOMElement()
  })

  it('notes the current page on mount', () => {
    render(<NavigationTracker />)
    expect(noteNavigation).toHaveBeenCalledWith('/home', '/home')
  })

  it('includes the search string so same-route steps count as navigation', () => {
    usePathnameMock.mockReturnValue('/display')
    useSearchParamsMock.mockReturnValue({ toString: () => 'list=abc' })
    render(<NavigationTracker />)
    expect(noteNavigation).toHaveBeenCalledWith('/display?list=abc', '/display')
  })

  it('notes again when the pathname changes', () => {
    const { rerender } = render(<NavigationTracker />)
    expect(noteNavigation).toHaveBeenCalledWith('/home', '/home')

    usePathnameMock.mockReturnValue('/lists')
    rerender(<NavigationTracker />)
    expect(noteNavigation).toHaveBeenCalledWith('/lists', '/lists')
  })

  it('skips the note when the pathname is empty', () => {
    usePathnameMock.mockReturnValue('')
    render(<NavigationTracker />)
    expect(noteNavigation).not.toHaveBeenCalled()
  })
})
