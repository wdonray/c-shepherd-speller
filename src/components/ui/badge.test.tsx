import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Badge, badgeVariants } from './badge'

describe('badgeVariants', () => {
  it('applies default variant classes by default', () => {
    const classes = badgeVariants({})
    expect(classes).toContain('bg-primary')
    expect(classes).toContain('text-primary-foreground')
  })

  it('applies distinct classes per variant', () => {
    const byVariant = {
      default: badgeVariants({ variant: 'default' }),
      secondary: badgeVariants({ variant: 'secondary' }),
      destructive: badgeVariants({ variant: 'destructive' }),
      outline: badgeVariants({ variant: 'outline' }),
    }
    expect(byVariant.default).toContain('bg-primary')
    expect(byVariant.secondary).toContain('bg-secondary')
    expect(byVariant.destructive).toContain('bg-destructive')
    expect(byVariant.outline).toContain('text-foreground')

    const unique = new Set(Object.values(byVariant))
    expect(unique.size).toBe(4)
  })

  it('appends a custom className', () => {
    expect(badgeVariants({ className: 'custom' })).toContain('custom')
  })
})

describe('Badge', () => {
  it('renders a span with the badge slot and default variant', () => {
    render(<Badge>New</Badge>)
    const badge = screen.getByText('New')
    expect(badge.tagName).toBe('SPAN')
    expect(badge).toHaveAttribute('data-slot', 'badge')
    expect(badge).toHaveClass('bg-primary')
  })

  it('renders each variant with distinct classes', () => {
    const { rerender } = render(<Badge variant="secondary">S</Badge>)
    expect(screen.getByText('S')).toHaveClass('bg-secondary')

    rerender(<Badge variant="destructive">D</Badge>)
    expect(screen.getByText('D')).toHaveClass('bg-destructive')

    rerender(<Badge variant="outline">O</Badge>)
    expect(screen.getByText('O')).toHaveClass('text-foreground')
  })

  it('renders the child element when asChild is true', () => {
    render(
      <Badge asChild variant="secondary">
        <a href="/items">Linked</a>
      </Badge>
    )
    const link = screen.getByRole('link', { name: 'Linked' })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('data-slot', 'badge')
    expect(link).toHaveClass('bg-secondary')
  })

  it('merges a custom className', () => {
    render(<Badge className="extra">E</Badge>)
    expect(screen.getByText('E')).toHaveClass('extra')
  })

  it('forwards additional props', () => {
    render(<Badge data-testid="badge-id">B</Badge>)
    expect(screen.getByTestId('badge-id')).toBeInTheDocument()
  })
})
