import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { Button, buttonVariants } from './button'

describe('buttonVariants', () => {
  it('applies default variant and size classes by default', () => {
    const classes = buttonVariants({})
    expect(classes).toContain('bg-chunk-leaf')
    expect(classes).toContain('h-11')
    expect(classes).toContain('rounded-2xl')
    expect(classes).toContain('shadow-[0_4px_0_var(--color-chunk-leaf-deep)]')
  })

  it('applies distinct classes per variant', () => {
    const byVariant = {
      default: buttonVariants({ variant: 'default' }),
      secondary: buttonVariants({ variant: 'secondary' }),
      sunny: buttonVariants({ variant: 'sunny' }),
      sky: buttonVariants({ variant: 'sky' }),
      destructive: buttonVariants({ variant: 'destructive' }),
      plum: buttonVariants({ variant: 'plum' }),
      ghost: buttonVariants({ variant: 'ghost' }),
      link: buttonVariants({ variant: 'link' }),
      outline: buttonVariants({ variant: 'outline' }),
    }
    expect(byVariant.default).toContain('bg-chunk-leaf')
    expect(byVariant.secondary).toContain('bg-card')
    expect(byVariant.sunny).toContain('bg-chunk-sun')
    expect(byVariant.sky).toContain('bg-chunk-sky')
    expect(byVariant.destructive).toContain('bg-chunk-coral')
    expect(byVariant.plum).toContain('bg-chunk-plum')
    expect(byVariant.ghost).toContain('hover:bg-accent')
    expect(byVariant.link).toContain('hover:underline')
    // Deprecated alias: outline renders exactly like secondary.
    expect(byVariant.outline).toBe(byVariant.secondary)

    const unique = new Set(Object.values(byVariant))
    expect(unique.size).toBe(8)
  })

  it('applies distinct classes per size', () => {
    const bySize = {
      default: buttonVariants({ size: 'default' }),
      sm: buttonVariants({ size: 'sm' }),
      lg: buttonVariants({ size: 'lg' }),
      icon: buttonVariants({ size: 'icon' }),
    }
    expect(bySize.default).toContain('h-11')
    expect(bySize.sm).toContain('h-9')
    expect(bySize.lg).toContain('h-14')
    expect(bySize.icon).toContain('size-11')

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
    expect(button).toHaveClass('bg-chunk-leaf', 'h-11')
  })

  it('renders each variant with distinct classes', () => {
    const { rerender } = render(<Button variant="destructive">V</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-chunk-coral')

    rerender(<Button variant="secondary">V</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-card')

    rerender(<Button variant="sunny">V</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-chunk-sun')

    rerender(<Button variant="sky">V</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-chunk-sky')

    rerender(<Button variant="plum">V</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-chunk-plum')

    rerender(<Button variant="ghost">V</Button>)
    expect(screen.getByRole('button')).toHaveClass('hover:bg-accent')

    rerender(<Button variant="link">V</Button>)
    expect(screen.getByRole('button')).toHaveClass('hover:underline')
  })

  it('renders each size with distinct classes', () => {
    const { rerender } = render(<Button size="sm">S</Button>)
    expect(screen.getByRole('button')).toHaveClass('h-9')

    rerender(<Button size="lg">S</Button>)
    expect(screen.getByRole('button')).toHaveClass('h-14')

    rerender(<Button size="icon">S</Button>)
    expect(screen.getByRole('button')).toHaveClass('size-11')
  })

  it('renders the child element when asChild is true', () => {
    render(
      <Button asChild variant="secondary">
        <a href="/save">Save</a>
      </Button>
    )
    const link = screen.getByRole('link', { name: 'Save' })
    expect(link.tagName).toBe('A')
    expect(link).toHaveAttribute('data-slot', 'button')
    expect(link).toHaveClass('bg-card')
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
