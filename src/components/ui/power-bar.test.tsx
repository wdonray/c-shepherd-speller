import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FREQUENCY_LABELS, PowerBar } from './power-bar'

describe('PowerBar', () => {
  it('labels each level with its frequency name', () => {
    const { rerender } = render(<PowerBar level={3} />)
    expect(screen.getByRole('img', { name: 'Frequency: Common' })).toBeInTheDocument()

    rerender(<PowerBar level={2} />)
    expect(screen.getByRole('img', { name: 'Frequency: Less common' })).toBeInTheDocument()

    rerender(<PowerBar level={1} />)
    expect(screen.getByRole('img', { name: 'Frequency: Rare' })).toBeInTheDocument()
  })

  it('lights exactly `level` of the three segments', () => {
    const { container, rerender } = render(<PowerBar level={2} />)
    const segments = container.querySelectorAll('span[aria-hidden="true"]')
    expect(segments).toHaveLength(3)
    expect(segments[0]).toHaveClass('bg-leaf')
    expect(segments[1]).toHaveClass('bg-leaf')
    expect(segments[2]).toHaveClass('bg-line')

    rerender(<PowerBar level={1} />)
    const single = container.querySelectorAll('span[aria-hidden="true"]')
    expect(single[0]).toHaveClass('bg-leaf')
    expect(single[1]).toHaveClass('bg-line')
    expect(single[2]).toHaveClass('bg-line')
  })

  it('uses a custom fill class when provided', () => {
    const { container } = render(<PowerBar level={3} filledClassName="bg-plum" />)
    const segments = container.querySelectorAll('span[aria-hidden="true"]')
    for (const segment of segments) {
      expect(segment).toHaveClass('bg-plum')
    }
  })

  it('merges a custom className', () => {
    render(<PowerBar level={1} className="extra" />)
    expect(screen.getByRole('img', { name: 'Frequency: Rare' })).toHaveClass('extra')
  })

  it('exposes all three frequency labels', () => {
    expect(FREQUENCY_LABELS).toEqual({ 1: 'Rare', 2: 'Less common', 3: 'Common' })
  })
})
