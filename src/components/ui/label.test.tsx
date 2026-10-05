import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Label } from './label'

describe('Label', () => {
  it('renders a label element with the label slot and base classes', () => {
    render(<Label>Name</Label>)
    const label = screen.getByText('Name')
    expect(label.tagName).toBe('LABEL')
    expect(label).toHaveAttribute('data-slot', 'label')
    expect(label).toHaveClass('font-medium', 'text-sm')
  })

  it('forwards htmlFor', () => {
    render(
      <>
        <Label htmlFor="name-field">Name</Label>
        <input id="name-field" />
      </>
    )
    expect(screen.getByText('Name')).toHaveAttribute('for', 'name-field')
  })

  it('merges a custom className', () => {
    render(<Label className="custom-label">Labeled</Label>)
    expect(screen.getByText('Labeled')).toHaveClass('custom-label')
  })
})
