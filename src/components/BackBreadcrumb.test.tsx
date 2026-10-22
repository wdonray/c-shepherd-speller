import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import BackBreadcrumb from './BackBreadcrumb'
import { noteNavigation, resetNavigationHistoryForTests } from '@/lib/navigation-history'

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

const backMock = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ back: backMock }),
}))

vi.mock('@/lib/report-error', () => ({ reportError: vi.fn() }))

describe('BackBreadcrumb', () => {
  let historyLengthSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    backMock.mockClear()
    window.sessionStorage.clear()
    resetNavigationHistoryForTests()
    // jsdom history.length is shared across tests in the file; control it.
    historyLengthSpy = vi.spyOn(window.history, 'length', 'get').mockReturnValue(1)
  })

  afterEach(() => {
    historyLengthSpy.mockRestore()
  })

  it('renders a link to the parent with the parent label as its name', () => {
    render(<BackBreadcrumb href="/lists" label="My spelling lists" />)
    const link = screen.getByRole('link', { name: 'My spelling lists' })
    expect(link).toHaveAttribute('href', '/lists')
  })

  it('applies custom className alongside the base styles', () => {
    render(<BackBreadcrumb href="/home" label="Home" className="custom-class" />)
    const link = screen.getByRole('link', { name: 'Home' })
    expect(link).toHaveClass('custom-class')
    expect(link).toHaveClass('inline-flex')
  })

  it('keeps the back control at a 44px minimum touch target without shifting layout (issue #537)', () => {
    // The visible link stays text-sized; vertical padding grows the hit area
    // while an equal negative margin keeps the header geometry unchanged.
    // Both render modes share the same style string.
    const { unmount } = render(<BackBreadcrumb href="/display" label="Present a list" />)
    expect(screen.getByRole('link', { name: 'Present a list' })).toHaveClass('py-3', '-my-3')
    // Unmount: the mounted instance follows the navigation tracker and would
    // flip to button mode with the notes below.
    unmount()

    historyLengthSpy.mockReturnValue(2)
    noteNavigation('/home', '/home')
    noteNavigation('/display?list=abc', '/display?list=abc')
    render(<BackBreadcrumb href="/display" label="Present a list" />)
    expect(screen.getByRole('button', { name: 'Home' })).toHaveClass('py-3', '-my-3')
  })

  it('names the previous page and goes back through history when one exists (issue #504)', () => {
    historyLengthSpy.mockReturnValue(2)
    noteNavigation('/home', '/home')
    noteNavigation('/lists/abc', '/lists/abc')

    render(<BackBreadcrumb href="/lists" label="My spelling lists" />)

    const button = screen.getByRole('button', { name: 'Home' })
    expect(button).toHaveClass('inline-flex')
    expect(screen.queryByRole('link')).not.toBeInTheDocument()

    fireEvent.click(button)
    expect(backMock).toHaveBeenCalledTimes(1)
  })

  it('falls back to the parent link when there is no previous page', () => {
    historyLengthSpy.mockReturnValue(2)
    noteNavigation('/lists/abc', '/lists/abc')
    render(<BackBreadcrumb href="/lists" label="My spelling lists" />)
    expect(screen.getByRole('link', { name: 'My spelling lists' })).toHaveAttribute('href', '/lists')
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('falls back to the parent link when history has a single entry (new tab)', () => {
    noteNavigation('/home', '/home')
    noteNavigation('/lists/abc', '/lists/abc')
    render(<BackBreadcrumb href="/lists" label="My spelling lists" />)
    expect(screen.getByRole('link', { name: 'My spelling lists' })).toBeInTheDocument()
  })

  it('updates when the previous page changes while mounted', () => {
    historyLengthSpy.mockReturnValue(2)
    noteNavigation('/lists/abc', '/lists/abc')
    render(<BackBreadcrumb href="/lists" label="My spelling lists" />)
    expect(screen.getByRole('link', { name: 'My spelling lists' })).toBeInTheDocument()

    act(() => {
      // Simulate arriving here from Home via in-app navigation: the tracker
      // ran on the previous entries before this component mounted.
      resetNavigationHistoryForTests()
      noteNavigation('/home', '/home')
      noteNavigation('/lists/abc', '/lists/abc')
    })
    expect(screen.getByRole('button', { name: 'Home' })).toBeInTheDocument()
  })
})
