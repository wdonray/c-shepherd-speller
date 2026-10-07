import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { VariantProps } from 'class-variance-authority'

import { Button, buttonVariants } from './button'

type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>['variant']>

/**
 * Issue 01 hover standard: every variant defines a visible hover treatment
 * and mirrors it on focus-visible (plus the base focus-visible ring).
 */
const hoverTreatments: Record<ButtonVariant, { hover: string[]; focusVisible: string[] }> = {
  default: { hover: ['hover:brightness-110'], focusVisible: ['focus-visible:brightness-110'] },
  secondary: {
    hover: ['hover:border-line-deep', 'hover:bg-accent'],
    focusVisible: ['focus-visible:border-line-deep', 'focus-visible:bg-accent'],
  },
  sunny: { hover: ['hover:brightness-110'], focusVisible: ['focus-visible:brightness-110'] },
  sky: { hover: ['hover:brightness-110'], focusVisible: ['focus-visible:brightness-110'] },
  destructive: { hover: ['hover:brightness-110'], focusVisible: ['focus-visible:brightness-110'] },
  plum: { hover: ['hover:brightness-110'], focusVisible: ['focus-visible:brightness-110'] },
  ghost: {
    hover: ['hover:bg-accent', 'hover:text-foreground'],
    focusVisible: ['focus-visible:bg-accent', 'focus-visible:text-foreground'],
  },
  link: { hover: ['hover:underline'], focusVisible: ['focus-visible:underline'] },
  outline: {
    hover: ['hover:border-line-deep', 'hover:bg-accent'],
    focusVisible: ['focus-visible:border-line-deep', 'focus-visible:bg-accent'],
  },
}

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

  it('defines a visible hover treatment and a matching focus-visible treatment for every variant', () => {
    for (const [variant, { hover, focusVisible }] of Object.entries(hoverTreatments)) {
      const classes = buttonVariants({ variant: variant as ButtonVariant })
      for (const c of hover) {
        expect(classes, `${variant} hover`).toContain(c)
      }
      for (const c of focusVisible) {
        expect(classes, `${variant} focus-visible`).toContain(c)
      }
    }
  })

  it('never uses hover transforms that would fight the chunky press effect', () => {
    for (const variant of Object.keys(hoverTreatments) as ButtonVariant[]) {
      const classes = buttonVariants({ variant })
      expect(classes, variant).not.toMatch(/hover:(translate|scale|rotate|skew)-/)
    }
  })

  it('keeps the chunky press effect and the focus-visible ring', () => {
    const chunky: ButtonVariant[] = ['default', 'secondary', 'sunny', 'sky', 'destructive', 'plum', 'outline']
    for (const variant of chunky) {
      const classes = buttonVariants({ variant })
      expect(classes, `${variant} press`).toContain('active:translate-y-[3px]')
    }
    // Ghost and link are flat on purpose: no press translate.
    for (const variant of ['ghost', 'link'] as ButtonVariant[]) {
      expect(buttonVariants({ variant }), `${variant} press`).toContain('active:translate-y-0')
    }
    for (const variant of Object.keys(hoverTreatments) as ButtonVariant[]) {
      const classes = buttonVariants({ variant })
      expect(classes, `${variant} ring`).toContain('focus-visible:ring-[3px]')
      expect(classes, `${variant} ring`).toContain('focus-visible:ring-ring/60')
    }
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
