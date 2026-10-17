import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GhostText } from './ghost-text'

describe('GhostText', () => {
  it('renders the real copy invisibly with a pulsing highlight', () => {
    render(<GhostText text="Real copy here" highlightClassName="bg-line/40" />)
    const inner = screen.getByText('Real copy here')
    const outer = inner.parentElement
    expect(outer).toHaveAttribute('aria-hidden', 'true')
    expect(outer).toHaveClass('text-transparent')
    expect(inner).toHaveClass('animate-pulse', 'bg-line/40')
  })

  it('merges extra classes onto the outer span', () => {
    render(<GhostText text="Bold copy" highlightClassName="bg-line/60" className="font-bold" />)
    const outer = screen.getByText('Bold copy').parentElement
    expect(outer).toHaveClass('font-bold', 'text-transparent')
  })
})
