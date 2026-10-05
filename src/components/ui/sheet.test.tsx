import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from './sheet'

function renderOpenSheet(contentProps = {}) {
  return render(
    <Sheet open>
      <SheetContent {...contentProps}>
        <SheetHeader>
          <SheetTitle>Sheet title</SheetTitle>
          <SheetDescription>Sheet description</SheetDescription>
        </SheetHeader>
        <SheetFooter>Sheet footer</SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

describe('Sheet', () => {
  it('renders nothing when closed', () => {
    render(
      <Sheet>
        <SheetContent>
          <SheetTitle>Hidden sheet</SheetTitle>
        </SheetContent>
      </Sheet>
    )
    expect(screen.queryByText('Hidden sheet')).not.toBeInTheDocument()
  })

  it('renders content when open', () => {
    renderOpenSheet()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Sheet title')).toBeInTheDocument()
  })

  it('opens via the trigger', () => {
    render(
      <Sheet>
        <SheetTrigger>Open sheet</SheetTrigger>
        <SheetContent>
          <SheetTitle>Triggered sheet</SheetTitle>
        </SheetContent>
      </Sheet>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open sheet' }))
    expect(screen.getByText('Triggered sheet')).toBeInTheDocument()
  })

  it('calls onOpenChange with false on Escape', () => {
    const onOpenChange = vi.fn()
    render(
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetTitle>Escapable sheet</SheetTitle>
        </SheetContent>
      </Sheet>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

describe('SheetContent sides', () => {
  const sides = [
    { side: 'right' as const, expected: 'right-0' },
    { side: 'left' as const, expected: 'left-0' },
    { side: 'top' as const, expected: 'top-0' },
    { side: 'bottom' as const, expected: 'bottom-0' },
  ]

  it.each(sides)('applies side classes for side=$side', ({ side, expected }) => {
    renderOpenSheet({ side })
    expect(document.querySelector('[data-slot="sheet-content"]')).toHaveClass(expected)
  })

  it('defaults to the right side', () => {
    renderOpenSheet()
    expect(document.querySelector('[data-slot="sheet-content"]')).toHaveClass('right-0')
  })

  it('renders the overlay and the built-in close button', () => {
    renderOpenSheet()
    expect(document.querySelector('[data-slot="sheet-overlay"]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('closes via the built-in close button', () => {
    const onOpenChange = vi.fn()
    render(
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent>
          <SheetTitle>Close me</SheetTitle>
        </SheetContent>
      </Sheet>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('merges a custom className', () => {
    renderOpenSheet({ className: 'sheet-extra' })
    expect(document.querySelector('[data-slot="sheet-content"]')).toHaveClass('sheet-extra')
  })
})

describe('SheetClose', () => {
  it('closes the sheet when clicked', () => {
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent>
            <SheetTitle>Custom closer</SheetTitle>
            <SheetClose>Dismiss</SheetClose>
          </SheetContent>
        </Sheet>
      )
    }
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('Custom closer')).not.toBeInTheDocument()
  })
})

describe('Sheet sub-components', () => {
  it('renders header, title, description, and footer with slots', () => {
    renderOpenSheet()
    expect(screen.getByText('Sheet title')).toHaveAttribute('data-slot', 'sheet-title')
    expect(screen.getByText('Sheet description')).toHaveAttribute('data-slot', 'sheet-description')
    expect(screen.getByText('Sheet footer')).toHaveAttribute('data-slot', 'sheet-footer')
    expect(screen.getByText('Sheet title').closest('[data-slot="sheet-header"]')).toBeInTheDocument()
  })

  it('merges custom classNames', () => {
    render(
      <Sheet open>
        <SheetContent>
          <SheetHeader className="h-extra">H</SheetHeader>
          <SheetTitle className="t-extra">T</SheetTitle>
          <SheetDescription className="d-extra">D</SheetDescription>
          <SheetFooter className="f-extra">F</SheetFooter>
        </SheetContent>
      </Sheet>
    )
    expect(screen.getByText('H')).toHaveClass('h-extra')
    expect(screen.getByText('T')).toHaveClass('t-extra')
    expect(screen.getByText('D')).toHaveClass('d-extra')
    expect(screen.getByText('F')).toHaveClass('f-extra')
  })
})

describe('Sheet overlay', () => {
  it('renders the internal overlay with base classes', () => {
    renderOpenSheet()
    const overlay = document.querySelector('[data-slot="sheet-overlay"]')
    expect(overlay).toBeInTheDocument()
    expect(overlay).toHaveClass('bg-black/50')
  })
})
