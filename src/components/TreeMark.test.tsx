import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TreeMark } from './TreeMark'

describe('TreeMark', () => {
  it('is decorative (aria-hidden) by default', () => {
    const { container } = render(<TreeMark />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).not.toHaveAttribute('role')
  })

  it('exposes a label as an image when provided', () => {
    render(<TreeMark label="Shepherd Speller logo" />)
    const svg = screen.getByRole('img', { name: 'Shepherd Speller logo' })
    expect(svg).toBeInTheDocument()
    expect(svg).not.toHaveAttribute('aria-hidden')
  })

  it('merges a custom className', () => {
    const { container } = render(<TreeMark className="extra" />)
    expect(container.querySelector('svg')).toHaveClass('extra')
  })
})
