import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import HelpDialog from './HelpDialog'

describe('HelpDialog', () => {
  it('renders nothing visible when closed', () => {
    render(<HelpDialog isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByText('Get help')).not.toBeInTheDocument()
    expect(screen.queryByText(/If you need help/)).not.toBeInTheDocument()
  })

  it('shows the title and description when open', () => {
    render(<HelpDialog isOpen onClose={vi.fn()} />)
    expect(screen.getByText('Get help')).toBeInTheDocument()
    expect(screen.getByText(/If you need help/)).toBeInTheDocument()

    const email = screen.getByRole('link', { name: 'support@shepherdspeller.com' })
    expect(email).toHaveAttribute('href', 'mailto:support@shepherdspeller.com')
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    render(<HelpDialog isOpen onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledWith(false)
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(<HelpDialog isOpen onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledWith(false)
  })
})
