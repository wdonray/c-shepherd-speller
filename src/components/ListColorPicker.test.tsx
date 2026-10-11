import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ListColorPicker from './ListColorPicker'
import { LIST_COLORS } from '@/models/WordList'

describe('ListColorPicker', () => {
  it('renders one swatch per curated color', () => {
    render(<ListColorPicker value="leaf" onChange={vi.fn()} />)
    expect(screen.getByRole('radiogroup', { name: 'List color' })).toBeInTheDocument()
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(LIST_COLORS.length)
  })

  it('marks the current value as checked', () => {
    render(<ListColorPicker value="sky" onChange={vi.fn()} />)
    expect(screen.getByRole('radio', { name: 'Blue' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Green' })).toHaveAttribute('aria-checked', 'false')
  })

  it('reports the picked color on click', () => {
    const onChange = vi.fn()
    render(<ListColorPicker value="leaf" onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Red' }))
    expect(onChange).toHaveBeenCalledWith('coral')
  })

  it('labels every swatch for assistive tech', () => {
    render(<ListColorPicker value="leaf" onChange={vi.fn()} />)
    for (const label of ['Green', 'Blue', 'Purple', 'Yellow', 'Red']) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument()
    }
  })
})
