import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/useNewVersionAvailable', () => ({
  useNewVersionAvailable: vi.fn(),
}))

import { useNewVersionAvailable } from '@/hooks/useNewVersionAvailable'
import { VersionReloadToast } from './version-reload-toast'

const mockedHook = vi.mocked(useNewVersionAvailable)
const originalLocation = window.location
let reloadMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.clearAllMocks()
  mockedHook.mockReturnValue(false)
  reloadMock = vi.fn()
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { reload: reloadMock },
  })
})

afterEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: originalLocation,
  })
})

describe('VersionReloadToast', () => {
  it('renders nothing when no update is available', () => {
    const { container } = render(<VersionReloadToast />)
    expect(container).toBeEmptyDOMElement()
  })

  it('announces the update politely without stealing focus', () => {
    mockedHook.mockReturnValue(true)
    render(<VersionReloadToast />)

    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
    expect(screen.getByText('A new version is available. Reload to get the latest.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss' })).toHaveAttribute('aria-label', 'Dismiss')
    expect(document.activeElement).toBe(document.body)
  })

  it('reloads the page when Reload is clicked', () => {
    mockedHook.mockReturnValue(true)
    render(<VersionReloadToast />)

    fireEvent.click(screen.getByRole('button', { name: 'Reload' }))
    expect(reloadMock).toHaveBeenCalledTimes(1)
  })

  it('hides for the session when dismissed with the X button', () => {
    mockedHook.mockReturnValue(true)
    const { container } = render(<VersionReloadToast />)
    expect(screen.getByRole('status')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(container).toBeEmptyDOMElement()
  })

  it('dismisses on Escape', () => {
    mockedHook.mockReturnValue(true)
    const { container } = render(<VersionReloadToast />)
    expect(screen.getByRole('status')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(container).toBeEmptyDOMElement()
  })

  it('ignores keys other than Escape', () => {
    mockedHook.mockReturnValue(true)
    render(<VersionReloadToast />)

    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByRole('status')).toBeInTheDocument()
  })
})
