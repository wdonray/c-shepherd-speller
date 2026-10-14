'use client'

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import HighlightedText from './HighlightedText'

describe('HighlightedText', () => {
  it('bolds the matched substring', () => {
    const { container } = render(<HighlightedText text="Week 5: Long A" query="long" />)
    const bold = container.querySelector('.font-extrabold')
    expect(bold?.textContent).toBe('Long')
    // The surrounding segments are not bold.
    const plain = Array.from(container.querySelectorAll(':scope > span > span:not(.font-extrabold)'))
    expect(plain.map((s) => s.textContent).join('')).toBe('Week 5:  A')
  })

  it('renders plain text when the query is empty', () => {
    render(<HighlightedText text="Week 5" query="" />)
    expect(screen.getByText('Week 5')).not.toHaveClass('font-extrabold')
  })

  it('renders plain text when nothing matches', () => {
    render(<HighlightedText text="Week 5" query="xyz" />)
    expect(screen.getByText('Week 5')).not.toHaveClass('font-extrabold')
  })
})
