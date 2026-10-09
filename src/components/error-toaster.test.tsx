import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toastError } from '@/lib/error-toast'
import { ErrorToaster } from './error-toaster'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ErrorToaster', () => {
  it('renders nothing when there are no toasts', () => {
    const { container } = render(<ErrorToaster />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows an assertive toast when toastError is called', () => {
    render(<ErrorToaster />)
    act(() => {
      toastError('Something went wrong. Please try again.')
    })
    const alert = screen.getByRole('alert')
    expect(alert).toHaveAttribute('aria-atomic', 'true')
    expect(screen.getByText('Something went wrong. Please try again.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss notification' })).toBeInTheDocument()
    expect(document.activeElement).toBe(document.body)
  })

  it('auto-dismisses after 8 seconds', () => {
    render(<ErrorToaster />)
    act(() => {
      toastError('boom')
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(7999)
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('dismisses when the close button is clicked', () => {
    render(<ErrorToaster />)
    act(() => {
      toastError('boom')
    })
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('ignores non-Escape keys', () => {
    render(<ErrorToaster />)
    act(() => {
      toastError('boom')
    })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('dismisses the most recent toast on Escape', () => {
    render(<ErrorToaster />)
    act(() => {
      toastError('first')
      toastError('second')
    })
    expect(screen.getAllByRole('alert')).toHaveLength(2)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getAllByRole('alert')).toHaveLength(1)
    expect(screen.getByText('first')).toBeInTheDocument()
  })

  it('pauses auto-dismiss while hovered', () => {
    render(<ErrorToaster />)
    act(() => {
      toastError('boom')
    })
    const alert = screen.getByRole('alert')
    fireEvent.mouseEnter(alert)
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.mouseLeave(alert)
    act(() => {
      vi.advanceTimersByTime(8000)
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('pauses auto-dismiss while focused', () => {
    render(<ErrorToaster />)
    act(() => {
      toastError('boom')
    })
    const alert = screen.getByRole('alert')
    fireEvent.focus(alert)
    act(() => {
      vi.advanceTimersByTime(10000)
    })
    expect(screen.getByRole('alert')).toBeInTheDocument()
    fireEvent.blur(alert)
    act(() => {
      vi.advanceTimersByTime(8000)
    })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('caps at 3 stacked toasts, evicting the oldest', () => {
    render(<ErrorToaster />)
    act(() => {
      toastError('one')
      toastError('two')
      toastError('three')
      toastError('four')
    })
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(3)
    expect(screen.queryByText('one')).not.toBeInTheDocument()
    expect(screen.getByText('four')).toBeInTheDocument()
  })
})
