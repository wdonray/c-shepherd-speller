import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'placeholder:text-muted-foreground selection:bg-sky-soft border-line flex min-h-36 w-full rounded-xl border-2 bg-card px-4 py-3 text-base transition-[color,box-shadow,border-color] outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
        'focus-visible:border-sky-deep focus-visible:ring-[3px] focus-visible:ring-ring/40',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
