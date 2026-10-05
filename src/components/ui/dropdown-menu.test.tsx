import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu'

function renderOpenMenu(children: React.ReactNode, contentProps = {}) {
  return render(
    <DropdownMenu defaultOpen>
      <DropdownMenuContent {...contentProps}>{children}</DropdownMenuContent>
    </DropdownMenu>
  )
}

describe('DropdownMenu', () => {
  it('renders nothing when closed', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('renders content with defaultOpen', () => {
    renderOpenMenu(<DropdownMenuItem>Visible item</DropdownMenuItem>)
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByText('Visible item')).toBeInTheDocument()
  })

  it('opens when the trigger is pressed', () => {
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Menu item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Open menu' }), {
      pointerType: 'mouse',
      button: 0,
    })
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })

  it('fires onOpenChange when opened', () => {
    const onOpenChange = vi.fn()
    render(
      <DropdownMenu onOpenChange={onOpenChange}>
        <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Item</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Trigger' }), {
      pointerType: 'mouse',
      button: 0,
    })
    expect(onOpenChange).toHaveBeenCalledWith(true)
  })
})

describe('DropdownMenuContent', () => {
  it('renders with the content slot and custom className', () => {
    renderOpenMenu(<DropdownMenuItem>Item</DropdownMenuItem>, { className: 'content-extra' })
    const content = screen.getByRole('menu')
    expect(content).toHaveAttribute('data-slot', 'dropdown-menu-content')
    expect(content).toHaveClass('content-extra', 'bg-popover')
  })

  it('accepts a custom sideOffset', () => {
    renderOpenMenu(<DropdownMenuItem>Item</DropdownMenuItem>, { sideOffset: 10 })
    expect(screen.getByRole('menu')).toBeInTheDocument()
  })
})

describe('DropdownMenuItem', () => {
  it('renders with the item slot and base classes', () => {
    renderOpenMenu(<DropdownMenuItem>Plain</DropdownMenuItem>)
    const item = screen.getByRole('menuitem', { name: 'Plain' })
    expect(item).toHaveAttribute('data-slot', 'dropdown-menu-item')
    expect(item).toHaveClass('cursor-pointer')
  })

  it('applies destructive variant attributes', () => {
    renderOpenMenu(<DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>)
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute('data-variant', 'destructive')
  })

  it('applies inset attribute', () => {
    renderOpenMenu(<DropdownMenuItem inset>Padded</DropdownMenuItem>)
    expect(screen.getByRole('menuitem', { name: 'Padded' })).toHaveAttribute('data-inset', 'true')
  })

  it('fires onSelect when clicked', () => {
    const onSelect = vi.fn()
    renderOpenMenu(<DropdownMenuItem onSelect={onSelect}>Clickable</DropdownMenuItem>)
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clickable' }))
    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('is not clickable when disabled', () => {
    const onSelect = vi.fn()
    renderOpenMenu(
      <DropdownMenuItem disabled onSelect={onSelect}>
        Disabled
      </DropdownMenuItem>
    )
    const item = screen.getByRole('menuitem', { name: 'Disabled' })
    expect(item).toHaveAttribute('data-disabled', '')
    fireEvent.click(item)
    expect(onSelect).not.toHaveBeenCalled()
  })
})

describe('DropdownMenuCheckboxItem', () => {
  it('renders unchecked without an indicator', () => {
    renderOpenMenu(<DropdownMenuCheckboxItem checked={false}>Unchecked</DropdownMenuCheckboxItem>)
    const item = screen.getByRole('menuitemcheckbox', { name: 'Unchecked' })
    expect(item).toHaveAttribute('data-slot', 'dropdown-menu-checkbox-item')
    expect(item.querySelector('svg')).not.toBeInTheDocument()
  })

  it('renders the check indicator when checked', () => {
    renderOpenMenu(<DropdownMenuCheckboxItem checked>Checked</DropdownMenuCheckboxItem>)
    const item = screen.getByRole('menuitemcheckbox', { name: 'Checked' })
    expect(item.getAttribute('aria-checked')).toBe('true')
    expect(item.querySelector('svg')).toBeInTheDocument()
  })
})

describe('DropdownMenuRadioGroup and DropdownMenuRadioItem', () => {
  it('renders radio items and marks the selected one', () => {
    renderOpenMenu(
      <DropdownMenuRadioGroup value="a">
        <DropdownMenuRadioItem value="a">Option A</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="b">Option B</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    )
    const optionA = screen.getByRole('menuitemradio', { name: 'Option A' })
    const optionB = screen.getByRole('menuitemradio', { name: 'Option B' })
    expect(optionA.getAttribute('aria-checked')).toBe('true')
    expect(optionB.getAttribute('aria-checked')).toBe('false')
    expect(optionA).toHaveAttribute('data-slot', 'dropdown-menu-radio-item')
  })

  it('fires onValueChange when a radio item is selected', () => {
    const onValueChange = vi.fn()
    renderOpenMenu(
      <DropdownMenuRadioGroup value="a" onValueChange={onValueChange}>
        <DropdownMenuRadioItem value="b">Option B</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    )
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Option B' }))
    expect(onValueChange).toHaveBeenCalledWith('b')
  })
})

describe('DropdownMenuLabel', () => {
  it('renders with the label slot', () => {
    renderOpenMenu(<DropdownMenuLabel>Section</DropdownMenuLabel>)
    expect(screen.getByText('Section')).toHaveAttribute('data-slot', 'dropdown-menu-label')
  })

  it('applies inset attribute', () => {
    renderOpenMenu(<DropdownMenuLabel inset>Inset label</DropdownMenuLabel>)
    expect(screen.getByText('Inset label')).toHaveAttribute('data-inset', 'true')
  })
})

describe('DropdownMenuSeparator', () => {
  it('renders with the separator slot', () => {
    renderOpenMenu(
      <>
        <DropdownMenuItem>Above</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Below</DropdownMenuItem>
      </>
    )
    const separator = document.querySelector('[data-slot="dropdown-menu-separator"]')
    expect(separator).toBeInTheDocument()
    expect(separator).toHaveAttribute('role', 'separator')
  })
})

describe('DropdownMenuShortcut', () => {
  it('renders with the shortcut slot and children', () => {
    renderOpenMenu(
      <DropdownMenuItem>
        Save <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
      </DropdownMenuItem>
    )
    const shortcut = screen.getByText('⌘S')
    expect(shortcut).toHaveAttribute('data-slot', 'dropdown-menu-shortcut')
    expect(shortcut).toHaveClass('ml-auto')
  })
})

describe('DropdownMenuGroup', () => {
  it('renders grouped items', () => {
    renderOpenMenu(
      <DropdownMenuGroup>
        <DropdownMenuItem>Grouped</DropdownMenuItem>
      </DropdownMenuGroup>
    )
    expect(screen.getByRole('menuitem', { name: 'Grouped' })).toBeInTheDocument()
    expect(document.querySelector('[data-slot="dropdown-menu-group"]')).toBeInTheDocument()
  })
})

describe('DropdownMenuSub', () => {
  it('renders the sub trigger with a chevron', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuContent>
          <DropdownMenuSub open>
            <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem>Sub item</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    const trigger = screen.getByRole('menuitem', { name: 'More' })
    expect(trigger).toHaveAttribute('data-slot', 'dropdown-menu-sub-trigger')
    expect(trigger.querySelector('svg')).toBeInTheDocument()

    const subContent = document.querySelector('[data-slot="dropdown-menu-sub-content"]')
    expect(subContent).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: 'Sub item' })).toBeInTheDocument()
  })

  it('applies inset attribute on the sub trigger', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger inset>Inset sub</DropdownMenuSubTrigger>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    )
    expect(screen.getByRole('menuitem', { name: 'Inset sub' })).toHaveAttribute('data-inset', 'true')
  })
})

describe('DropdownMenuPortal', () => {
  it('renders its children into the document', () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuTrigger>Trigger</DropdownMenuTrigger>
        <DropdownMenuPortal>
          <DropdownMenuContent>
            <DropdownMenuItem>Portaled</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenu>
    )
    expect(screen.getByRole('menuitem', { name: 'Portaled' })).toBeInTheDocument()
  })
})
