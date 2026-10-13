import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import WhyChartPopover from './WhyChartPopover'

function openPopover() {
  render(<WhyChartPopover />)
  const button = screen.getByRole('button', { name: 'Why this chart?' })
  expect(button).toHaveAttribute('aria-expanded', 'false')
  fireEvent.click(button)
  return button
}

describe('WhyChartPopover', () => {
  it('hides the explainer until the info button is clicked', () => {
    render(<WhyChartPopover />)
    expect(screen.queryByText(/This is the format teachers choose/)).not.toBeInTheDocument()
  })

  it('opens the explainer and marks the button expanded', () => {
    const button = openPopover()
    expect(button).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('dialog', { name: 'Why this chart?' })).toBeInTheDocument()
    expect(screen.getByText(/One column per pattern, all words visible at once/)).toBeInTheDocument()
    expect(screen.getByText(/readable from the back of the room/)).toBeInTheDocument()
  })

  it('toggles closed when the info button is clicked again', () => {
    const button = openPopover()
    fireEvent.click(button)
    expect(screen.queryByRole('dialog', { name: 'Why this chart?' })).not.toBeInTheDocument()
    expect(button).toHaveAttribute('aria-expanded', 'false')
  })

  it('closes with the Close button', () => {
    openPopover()
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Why this chart?' })).not.toBeInTheDocument()
  })

  it('closes on Escape', () => {
    openPopover()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Why this chart?' })).not.toBeInTheDocument()
  })

  it('ignores non-Escape keys', () => {
    openPopover()
    fireEvent.keyDown(document, { key: 'Enter' })
    expect(screen.getByRole('dialog', { name: 'Why this chart?' })).toBeInTheDocument()
  })

  it('closes when clicking outside the popover', () => {
    openPopover()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByRole('dialog', { name: 'Why this chart?' })).not.toBeInTheDocument()
  })

  it('stays open when clicking inside the popover', () => {
    openPopover()
    fireEvent.pointerDown(screen.getByRole('dialog', { name: 'Why this chart?' }))
    expect(screen.getByRole('dialog', { name: 'Why this chart?' })).toBeInTheDocument()
  })
})
