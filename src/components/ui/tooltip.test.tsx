import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'

const renderOpenTooltip = (contentClassName?: string) => {
  render(
    <TooltipProvider>
      <Tooltip open>
        <TooltipTrigger>Hover me</TooltipTrigger>
        <TooltipContent className={contentClassName}>Mark as odd duck</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
  return screen.getByText('Mark as odd duck')
}

// Bg-ink flips with the theme (dark brown in light mode, cream in dark mode),
// so the tooltip text must use the inverse theme token, never hardcoded white.
const assertReadableOnInk = (content: HTMLElement) => {
  expect(content).toHaveClass('bg-ink')
  expect(content).toHaveClass('text-background')
  expect(content.className).not.toMatch(/(?:^|\s)text-white(?:\s|$)/)
}

describe('TooltipContent', () => {
  it('uses theme-aware colors so it stays readable in light and dark mode', () => {
    assertReadableOnInk(renderOpenTooltip())
  })

  it('keeps the theme-aware colors inside a dark theme container', () => {
    const tooltip = (
      <TooltipProvider>
        <Tooltip open>
          <TooltipTrigger>Hover me</TooltipTrigger>
          <TooltipContent>Mark as odd duck</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
    render(<div className="dark">{tooltip}</div>)
    assertReadableOnInk(screen.getByText('Mark as odd duck'))
  })

  it('merges a custom className', () => {
    const content = renderOpenTooltip('custom-tip')
    expect(content).toHaveClass('custom-tip')
    expect(content).toHaveClass('text-background')
  })
})
