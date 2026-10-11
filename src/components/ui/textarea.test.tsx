import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Textarea } from './textarea'

describe('Textarea', () => {
  it('renders a textarea with the textarea slot and base classes', () => {
    render(<Textarea />)
    const textarea = screen.getByRole('textbox')
    expect(textarea).toHaveAttribute('data-slot', 'textarea')
    expect(textarea).toHaveClass('min-h-36', 'rounded-xl', 'border-2', 'border-line')
  })

  it('merges a custom className', () => {
    render(<Textarea className="custom-textarea" />)
    expect(screen.getByRole('textbox')).toHaveClass('custom-textarea')
  })

  it('forwards value, onChange, and disabled', () => {
    const onChange = vi.fn()
    render(<Textarea aria-label="details" value="abc" onChange={onChange} disabled />)
    const textarea = screen.getByLabelText('details')
    expect(textarea).toHaveValue('abc')
    expect(textarea).toBeDisabled()
    fireEvent.change(textarea, { target: { value: 'abcd' } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('forwards placeholder, rows, and maxLength', () => {
    render(<Textarea placeholder="Describe it" rows={6} maxLength={5000} />)
    const textarea = screen.getByPlaceholderText('Describe it')
    expect(textarea).toHaveAttribute('rows', '6')
    expect(textarea).toHaveAttribute('maxLength', '5000')
  })
})
