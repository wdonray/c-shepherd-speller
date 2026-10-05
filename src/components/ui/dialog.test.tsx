import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from './dialog'

describe('Dialog', () => {
  it('renders nothing when closed', () => {
    render(
      <Dialog>
        <DialogContent>
          <DialogTitle>Hidden</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    expect(screen.queryByText('Hidden')).not.toBeInTheDocument()
  })

  it('renders content when open', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Visible title</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    expect(screen.getByText('Visible title')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('opens via the trigger', () => {
    render(
      <Dialog>
        <DialogTrigger>Open it</DialogTrigger>
        <DialogContent>
          <DialogTitle>Triggered</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    expect(screen.queryByText('Triggered')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open it' }))
    expect(screen.getByText('Triggered')).toBeInTheDocument()
  })

  it('calls onOpenChange with false on Escape', () => {
    const onOpenChange = vi.fn()
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Escapable</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('calls onOpenChange with false when the default close button is clicked', () => {
    const onOpenChange = vi.fn()
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Closable</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})

describe('DialogContent', () => {
  it('renders the overlay and close button by default', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>With close</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument()
  })

  it('hides the close button when showCloseButton is false', () => {
    render(
      <Dialog open>
        <DialogContent showCloseButton={false}>
          <DialogTitle>No close</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
  })

  it('merges a custom className onto the content', () => {
    render(
      <Dialog open>
        <DialogContent className="custom-content">
          <DialogTitle>Titled</DialogTitle>
        </DialogContent>
      </Dialog>
    )
    expect(document.querySelector('[data-slot="dialog-content"]')).toHaveClass('custom-content')
  })
})

describe('DialogClose', () => {
  it('closes the dialog when clicked', () => {
    function Harness() {
      const [open, setOpen] = useState(true)
      return (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent>
            <DialogTitle>Custom close</DialogTitle>
            <DialogClose>Dismiss</DialogClose>
          </DialogContent>
        </Dialog>
      )
    }
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText('Custom close')).not.toBeInTheDocument()
  })
})

describe('Dialog sub-components', () => {
  function renderFull() {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dialog title</DialogTitle>
            <DialogDescription>Dialog description</DialogDescription>
          </DialogHeader>
          <DialogFooter>Footer actions</DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  it('renders header, title, description, and footer', () => {
    renderFull()
    expect(screen.getByText('Dialog title')).toHaveAttribute('data-slot', 'dialog-title')
    expect(screen.getByText('Dialog description')).toHaveAttribute('data-slot', 'dialog-description')
    expect(screen.getByText('Footer actions')).toHaveAttribute('data-slot', 'dialog-footer')
    expect(screen.getByText('Dialog title').closest('[data-slot="dialog-header"]')).toBeInTheDocument()
  })

  it('merges custom classNames', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogHeader className="h-extra">H</DialogHeader>
          <DialogTitle className="t-extra">T</DialogTitle>
          <DialogDescription className="d-extra">D</DialogDescription>
          <DialogFooter className="f-extra">F</DialogFooter>
        </DialogContent>
      </Dialog>
    )
    expect(screen.getByText('H')).toHaveClass('h-extra')
    expect(screen.getByText('T')).toHaveClass('t-extra')
    expect(screen.getByText('D')).toHaveClass('d-extra')
    expect(screen.getByText('F')).toHaveClass('f-extra')
  })
})

describe('DialogOverlay and DialogPortal', () => {
  it('renders an overlay with base classes', () => {
    render(
      <Dialog open>
        <DialogPortal>
          <DialogOverlay />
        </DialogPortal>
      </Dialog>
    )
    const overlay = document.querySelector('[data-slot="dialog-overlay"]')
    expect(overlay).toBeInTheDocument()
    expect(overlay).toHaveClass('bg-black/50')
  })

  it('merges a custom className on the overlay', () => {
    render(
      <Dialog open>
        <DialogPortal>
          <DialogOverlay className="overlay-extra" />
        </DialogPortal>
      </Dialog>
    )
    expect(document.querySelector('[data-slot="dialog-overlay"]')).toHaveClass('overlay-extra')
  })
})
