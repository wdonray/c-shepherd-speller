import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import HelpDialog from './HelpDialog'

describe('HelpDialog', () => {
  it('renders nothing visible when closed', () => {
    render(<HelpDialog isOpen={false} onClose={vi.fn()} />)
    expect(screen.queryByText('Get help')).not.toBeInTheDocument()
    expect(screen.queryByText(/Quick answers for the classroom/)).not.toBeInTheDocument()
  })

  it('shows the title and description when open', () => {
    render(<HelpDialog isOpen onClose={vi.fn()} />)
    expect(screen.getByText('Get help')).toBeInTheDocument()
    expect(screen.getByText(/Quick answers for the classroom/)).toBeInTheDocument()
  })

  it('renders all four help sections', () => {
    render(<HelpDialog isOpen onClose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: 'Quick start' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Frequently asked questions' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Troubleshooting' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Contact' })).toBeInTheDocument()
  })

  it('shows the quick start steps', () => {
    render(<HelpDialog isOpen onClose={vi.fn()} />)
    expect(screen.getByText(/Create a list:/)).toBeInTheDocument()
    expect(screen.getByText(/Add patterns:/)).toBeInTheDocument()
    expect(screen.getByText(/Present and practice:/)).toBeInTheDocument()
  })

  it('expands FAQ items when clicked', () => {
    render(<HelpDialog isOpen onClose={vi.fn()} />)
    const summary = screen.getByText('What is a pattern chart?')
    expect(screen.queryByText(/Wider columns are more common spellings/)).not.toBeVisible()
    fireEvent.click(summary)
    expect(screen.getByText(/Wider columns are more common spellings/)).toBeVisible()
  })

  it('renders all six FAQ questions', () => {
    render(<HelpDialog isOpen onClose={vi.fn()} />)
    expect(screen.getByText('What is a pattern chart?')).toBeInTheDocument()
    expect(screen.getByText('How do I show a list on the projector?')).toBeInTheDocument()
    expect(screen.getByText('Can students practice on their own devices?')).toBeInTheDocument()
    expect(screen.getByText('Where is my data stored?')).toBeInTheDocument()
    expect(screen.getByText('Does PatternSpell work offline?')).toBeInTheDocument()
    expect(screen.getByText('What does "odd duck" mean?')).toBeInTheDocument()
  })

  it('shows troubleshooting guidance', () => {
    render(<HelpDialog isOpen onClose={vi.fn()} />)
    expect(screen.getByText(/No voice?/)).toBeInTheDocument()
    expect(screen.getByText(/Lists not loading?/)).toBeInTheDocument()
    expect(screen.getByText(/Signed out unexpectedly?/)).toBeInTheDocument()
  })

  it('shows the support contact placeholder', () => {
    render(<HelpDialog isOpen onClose={vi.fn()} />)
    expect(screen.getByText(/\[SUPPORT CONTACT TBD\]/)).toBeInTheDocument()
  })

  it('does not show the old administrator dead-end line', () => {
    render(<HelpDialog isOpen onClose={vi.fn()} />)
    expect(screen.queryByText(/school administrator/)).not.toBeInTheDocument()
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
