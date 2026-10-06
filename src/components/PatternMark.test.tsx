import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PatternMark } from './PatternMark'

describe('PatternMark', () => {
  it('is decorative (aria-hidden) by default', () => {
    const { container } = render(<PatternMark />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).not.toHaveAttribute('role')
  })

  it('exposes a label as an image when provided', () => {
    render(<PatternMark label="PatternSpell logo" />)
    const svg = screen.getByRole('img', { name: 'PatternSpell logo' })
    expect(svg).toBeInTheDocument()
    expect(svg).not.toHaveAttribute('aria-hidden')
  })

  it('merges a custom className', () => {
    const { container } = render(<PatternMark className="extra" />)
    expect(container.querySelector('svg')).toHaveClass('extra')
  })
})
