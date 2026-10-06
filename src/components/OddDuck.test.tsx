import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { OddDuck } from './OddDuck'

describe('OddDuck', () => {
  it('is decorative (aria-hidden) by default', () => {
    const { container } = render(<OddDuck />)
    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
    expect(svg).not.toHaveAttribute('role')
  })

  it('exposes a label as an image when provided', () => {
    render(<OddDuck label="Odd duck" />)
    const svg = screen.getByRole('img', { name: 'Odd duck' })
    expect(svg).toBeInTheDocument()
    expect(svg).not.toHaveAttribute('aria-hidden')
  })

  it('merges a custom className', () => {
    const { container } = render(<OddDuck className="text-plum" />)
    expect(container.querySelector('svg')).toHaveClass('text-plum')
  })
})
