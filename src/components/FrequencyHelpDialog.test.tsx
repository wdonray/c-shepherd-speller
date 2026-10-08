import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import FrequencyHelpDialog from './FrequencyHelpDialog'

describe('FrequencyHelpDialog', () => {
  it('renders nothing when closed', () => {
    render(<FrequencyHelpDialog isOpen={false} onClose={vi.fn()} accentFill="bg-leaf" />)
    expect(screen.queryByText('About frequency')).not.toBeInTheDocument()
  })

  it('explains each frequency level when open', () => {
    render(<FrequencyHelpDialog isOpen onClose={vi.fn()} accentFill="bg-leaf" />)
    expect(screen.getByText('About frequency')).toBeInTheDocument()
    expect(screen.getByText('Common')).toBeInTheDocument()
    expect(screen.getByText('Less common')).toBeInTheDocument()
    expect(screen.getByText('Rare')).toBeInTheDocument()
    expect(screen.getByText('Shows up in most words with this sound. Teach this spelling first.')).toBeInTheDocument()
  })

  it('closes when Got it is clicked', () => {
    const onClose = vi.fn()
    render(<FrequencyHelpDialog isOpen onClose={onClose} accentFill="bg-leaf" />)
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }))
    expect(onClose).toHaveBeenCalled()
  })
})
