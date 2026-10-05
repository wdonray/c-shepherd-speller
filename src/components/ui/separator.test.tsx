import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Separator } from './separator'

describe('Separator', () => {
  it('renders a decorative horizontal separator by default', () => {
    const { container } = render(<Separator />)
    const separator = container.querySelector('[data-slot="separator"]')
    expect(separator).toBeInTheDocument()
    expect(separator).toHaveAttribute('data-orientation', 'horizontal')
    expect(separator).toHaveClass('data-[orientation=horizontal]:h-px', 'data-[orientation=horizontal]:w-full')
    // Decorative separators carry role="none" and no aria-orientation.
    expect(separator).toHaveAttribute('role', 'none')
    expect(separator).not.toHaveAttribute('aria-orientation')
  })

  it('renders a vertical separator', () => {
    const { container } = render(<Separator orientation="vertical" />)
    const separator = container.querySelector('[data-slot="separator"]')
    expect(separator).toHaveAttribute('data-orientation', 'vertical')
    expect(separator).toHaveClass('data-[orientation=vertical]:h-full', 'data-[orientation=vertical]:w-px')
  })

  it('is semantic with a role when decorative is false', () => {
    const { container } = render(<Separator decorative={false} />)
    const separator = container.querySelector('[data-slot="separator"]')
    expect(separator).toHaveAttribute('role', 'separator')
    // Radix omits aria-orientation for horizontal (the default); it is only
    // rendered for vertical separators.
    expect(separator).not.toHaveAttribute('aria-orientation')
  })

  it('sets aria-orientation for a semantic vertical separator', () => {
    const { container } = render(<Separator decorative={false} orientation="vertical" />)
    const separator = container.querySelector('[data-slot="separator"]')
    expect(separator).toHaveAttribute('role', 'separator')
    expect(separator).toHaveAttribute('aria-orientation', 'vertical')
  })

  it('merges a custom className', () => {
    const { container } = render(<Separator className="custom-sep" />)
    expect(container.querySelector('[data-slot="separator"]')).toHaveClass('custom-sep')
  })
})
