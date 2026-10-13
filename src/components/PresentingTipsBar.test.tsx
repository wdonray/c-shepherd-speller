import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'

import PresentingTipsBar from './PresentingTipsBar'

describe('PresentingTipsBar', () => {
  beforeEach(() => {
    window.localStorage.removeItem('patternspell-presenting-tips-dismissed')
  })

  it('shows the presenting tips when not dismissed', () => {
    render(<PresentingTipsBar />)
    expect(screen.getByRole('region', { name: 'Presenting tips' })).toBeInTheDocument()
    expect(screen.getByText(/Press the fullscreen button for the biggest chart/)).toBeInTheDocument()
    expect(screen.getByText(/Lock a pattern to hide it/)).toBeInTheDocument()
  })

  it('dismisses the bar and remembers the choice', () => {
    render(<PresentingTipsBar />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss presenting tips' }))
    expect(screen.queryByRole('region', { name: 'Presenting tips' })).not.toBeInTheDocument()
    expect(window.localStorage.getItem('patternspell-presenting-tips-dismissed')).toBe('true')
  })

  it('stays hidden when already dismissed', () => {
    window.localStorage.setItem('patternspell-presenting-tips-dismissed', 'true')
    const { container } = render(<PresentingTipsBar />)
    expect(container).toBeEmptyDOMElement()
  })
})
