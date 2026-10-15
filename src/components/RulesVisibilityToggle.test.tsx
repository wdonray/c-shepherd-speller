import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import RulesVisibilityToggle from './RulesVisibilityToggle'

describe('RulesVisibilityToggle', () => {
  it('keeps a stable accessible name and pressed state when rules are shown', () => {
    render(<RulesVisibilityToggle showRules={true} onToggle={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Show rules' })
    expect(button).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps a stable accessible name and unpressed state when rules are hidden', () => {
    render(<RulesVisibilityToggle showRules={false} onToggle={vi.fn()} />)
    const button = screen.getByRole('button', { name: 'Show rules' })
    expect(button).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onToggle when clicked', () => {
    const onToggle = vi.fn()
    render(<RulesVisibilityToggle showRules={true} onToggle={onToggle} />)
    fireEvent.click(screen.getByRole('button', { name: 'Show rules' }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
