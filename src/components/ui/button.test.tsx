import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Button, buttonVariants } from './button'

describe('buttonVariants', () => {
  it('applies default variant and size classes by default', () => {
    const classes = buttonVariants({})
    expect(classes).toContain('bg-primary')
    expect(classes).toContain('h-9')
  })

  it('applies distinct classes per variant', () => {
    const byVariant = {
      default: buttonVariants({ variant: 'default' }),
      destructive: buttonVariants({ variant: 'destructive' }),
      outline: buttonVariants({ variant: 'outline' }),
      secondary: buttonVariants({ variant: 'secondary' }),
      ghost: buttonVariants({ variant: 'ghost' }),
      link: buttonVariants({ variant: 'link' }),
    }
    expect(byVariant.default).toContain('bg-primary')
    expect(byVariant.destructive).toContain('bg-destructive')
    expect(byVariant.outline).toContain('bg-background')
    expect(byVariant.secondary).toContain('bg-secondary')
    expect(byVariant.ghost).toContain('hover:bg-accent')
    expect(byVariant.link).toContain('hover:underline')

    const unique = new Set(Object.values(byVariant))
    expect(unique.size).toBe(6)
  })

  it('applies distinct classes per size', () => {
    const bySize = {
      default: buttonVariants({ size: 'default' }),
      sm: buttonVariants({ size: 'sm' }),
      lg: buttonVariants({ size: 'lg' }),
      icon: buttonVariants({ size: 'icon' }),
    }
    expect(bySize.default).toContain('h-9')
    expect(bySize.sm).toContain('h-8')
    expect(bySize.lg).toContain('h-10')
    expect(bySize.icon).toContain('size-9')

    const unique = new Set(Object.values(bySize))
    expect(unique.size).toBe(4)
  })

  it('appends a custom className', () => {
    expect(buttonVariants({ className: 'custom' })).toContain('custom')
  })
})

describe('Button', () => {
  it('renders a button with the button slot and default classes', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByRole('button', { name: 'Click me' })
    expect(button.tagName).toBe('BUTTON')
    expect(button).toHaveAttribute('data-slot', 'button')
    expect(button).toHaveClass('bg-primary', 'h-9')
  })

  it('renders each variant with distinct classes', () => {
    const { rerender } = render(<Button variant="destructive">V</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-destructive')

    rerender(<Button variant="outline">V</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-background')

    rerender(<Button variant="secondary">V</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-secondary')

    rerender(<Button variant="ghost">V</Button>)
    expect(screen.getByRole('button')).toHaveClass('hover:bg-accent')

    rerender(<Button variant="link">V</Button>)
    expect(screen.getByRole('button')).toHaveClass('hover:underline')
  })

  it('renders each size with distinct classes', () => {
    const { rerender } = render(<Button size="sm">S</Button>)
    expect(screen.getByRole('button')).toHaveClass('h-8')

    rerender(<Button size="lg">S</Button>)
    expect(screen.getByRole('button')).toHaveClass('h-10')

    rerender(<Button size="icon">S</Button>)
    expect(screen.getByRole('button')).toHaveClass('size-9')
  })

  it('renders the child element when asChild is true', () => {
    render(
      <Button asChild variant="outline">
        <a href="/save">Save</a>
      </Button>
    )
    const link = screen.getByRole('link', { name: 'Save' })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('data-slot', 'button')
    expect(link).toHaveClass('bg-background')
  })

  it('forwards onClick and other button props', () => {
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled data-testid="btn">
        Go
      </Button>
    )
    const button = screen.getByTestId('btn')
    expect(button).toBeDisabled()
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })

  it('calls onClick when enabled', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Go</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
