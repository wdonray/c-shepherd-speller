import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DisplayPage, { metadata } from './page'

vi.mock('@/components/DisplayMode', () => ({
  default: () => <div data-testid="display-mode" />,
}))

describe('DisplayPage', () => {
  it('has display-mode metadata', () => {
    expect(metadata.title).toBe('Display Mode | Shepherd Speller')
    expect(metadata.description).toContain('big screen')
  })

  it('renders the display mode', () => {
    render(<DisplayPage />)
    expect(screen.getByTestId('display-mode')).toBeInTheDocument()
  })
})
