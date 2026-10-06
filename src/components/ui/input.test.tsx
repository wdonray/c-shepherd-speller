import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Input } from './input'

describe('Input', () => {
  it('renders an input with the input slot and base classes', () => {
    render(<Input />)
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('data-slot', 'input')
    expect(input).toHaveClass('h-12', 'rounded-xl', 'border-2', 'border-line')
  })

  it('forwards the type prop', () => {
    render(<Input type="password" aria-label="secret" />)
    expect(screen.getByLabelText('secret')).toHaveAttribute('type', 'password')
  })

  it('defaults to no explicit type attribute value change', () => {
    render(<Input aria-label="plain" />)
    expect(screen.getByLabelText('plain').getAttribute('type')).toBeNull()
  })

  it('merges a custom className', () => {
    render(<Input className="custom-input" />)
    expect(screen.getByRole('textbox')).toHaveClass('custom-input')
  })

  it('forwards value, onChange, and disabled', () => {
    const onChange = vi.fn()
    render(<Input aria-label="name" value="abc" onChange={onChange} disabled />)
    const input = screen.getByLabelText('name')
    expect(input).toHaveValue('abc')
    expect(input).toBeDisabled()
    fireEvent.change(input, { target: { value: 'abcd' } })
    expect(onChange).toHaveBeenCalledTimes(1)
  })

  it('forwards placeholder and name', () => {
    render(<Input placeholder="Type here" name="word" />)
    const input = screen.getByPlaceholderText('Type here')
    expect(input).toHaveAttribute('name', 'word')
  })
})
