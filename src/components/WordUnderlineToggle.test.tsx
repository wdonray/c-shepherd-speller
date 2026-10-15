import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WordUnderlineToggle from './WordUnderlineToggle'

describe('WordUnderlineToggle', () => {
  it('keeps a stable accessible name and pressed state when underlines are shown', () => {
    render(<WordUnderlineToggle showUnderlines={true} onToggle={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Show word underlines' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps a stable accessible name and unpressed state when underlines are hidden', () => {
    render(<WordUnderlineToggle showUnderlines={false} onToggle={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Show word underlines' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn()
    render(<WordUnderlineToggle showUnderlines={false} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show word underlines' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
