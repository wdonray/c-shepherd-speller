import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/*
 * Chunky design-system buttons: 16px radius, bold labels, and a 4px darker
 * bottom edge (box-shadow) that compresses on press. Colored variants use the
 * fixed contrast-verified fill/shadow pairs; only secondary and ghost adapt
 * to the theme.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-base font-bold transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 cursor-pointer select-none active:translate-y-[3px]",
  {
    variants: {
      variant: {
        default:
          'bg-chunk-leaf text-white shadow-[0_4px_0_var(--color-chunk-leaf-deep)] hover:brightness-105 active:shadow-[0_1px_0_var(--color-chunk-leaf-deep)]',
        secondary:
          'bg-card text-foreground border-2 border-line shadow-[0_4px_0_var(--line)] hover:brightness-[0.98] active:shadow-[0_1px_0_var(--line)]',
        sunny:
          'bg-chunk-sun text-chunk-sun-ink shadow-[0_4px_0_var(--color-chunk-sun-deep)] hover:brightness-105 active:shadow-[0_1px_0_var(--color-chunk-sun-deep)]',
        sky: 'bg-chunk-sky text-white shadow-[0_4px_0_var(--color-chunk-sky-deep)] hover:brightness-110 active:shadow-[0_1px_0_var(--color-chunk-sky-deep)]',
        destructive:
          'bg-chunk-coral text-white shadow-[0_4px_0_var(--color-chunk-coral-deep)] hover:brightness-110 active:shadow-[0_1px_0_var(--color-chunk-coral-deep)]',
        plum: 'bg-chunk-plum text-white shadow-[0_4px_0_var(--color-chunk-plum-deep)] hover:brightness-110 active:shadow-[0_1px_0_var(--color-chunk-plum-deep)]',
        ghost: 'text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl active:translate-y-0',
        link: 'text-sky-deep underline-offset-4 hover:underline rounded-none shadow-none active:translate-y-0',
        /**
         * Deprecated alias for secondary. The old shadcn `outline` variant was
         * removed from the design system; each screen migrates to `secondary`
         * in its redesign PR. New code must not use `outline`.
         */
        outline:
          'bg-card text-foreground border-2 border-line shadow-[0_4px_0_var(--line)] hover:brightness-[0.98] active:shadow-[0_1px_0_var(--line)]',
      },
      size: {
        default: 'h-11 px-5 py-2 has-[>svg]:px-4',
        sm: 'h-9 px-4 py-1.5 text-sm has-[>svg]:px-3',
        lg: 'h-14 px-8 text-lg has-[>svg]:px-6',
        icon: 'size-11',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />
}

export { Button, buttonVariants }
