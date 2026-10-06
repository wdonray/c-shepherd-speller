import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Badge, badgeVariants } from './badge'

describe('badgeVariants', () => {
  it('applies default variant classes by default', () => {
    const classes = badgeVariants({})
    expect(classes).toContain('bg-leaf-soft')
    expect(classes).toContain('text-leaf-ink')
    expect(classes).toContain('rounded-full')
  })

  it('applies distinct classes per variant', () => {
    const byVariant = {
      default: badgeVariants({ variant: 'default' }),
      secondary: badgeVariants({ variant: 'secondary' }),
      destructive: badgeVariants({ variant: 'destructive' }),
      outline: badgeVariants({ variant: 'outline' }),
      plum: badgeVariants({ variant: 'plum' }),
      sun: badgeVariants({ variant: 'sun' }),
    }
    expect(byVariant.default).toContain('bg-leaf-soft')
    expect(byVariant.secondary).toContain('bg-sky-soft')
    expect(byVariant.destructive).toContain('bg-coral-soft')
    expect(byVariant.outline).toContain('text-foreground')
    expect(byVariant.plum).toContain('bg-plum-soft')
    expect(byVariant.sun).toContain('bg-sun-soft')

    const unique = new Set(Object.values(byVariant))
    expect(unique.size).toBe(6)
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
    expect(badge).toHaveClass('bg-leaf-soft')
  })

  it('renders each variant with distinct classes', () => {
    const { rerender } = render(<Badge variant="secondary">S</Badge>)
    expect(screen.getByText('S')).toHaveClass('bg-sky-soft')

    rerender(<Badge variant="destructive">D</Badge>)
    expect(screen.getByText('D')).toHaveClass('bg-coral-soft')

    rerender(<Badge variant="outline">O</Badge>)
    expect(screen.getByText('O')).toHaveClass('text-foreground')

    rerender(<Badge variant="plum">P</Badge>)
    expect(screen.getByText('P')).toHaveClass('bg-plum-soft')

    rerender(<Badge variant="sun">U</Badge>)
    expect(screen.getByText('U')).toHaveClass('bg-sun-soft')
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
    expect(link).toHaveClass('bg-sky-soft')
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
