import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ThemeProvider } from './ThemeProvider'

describe('ThemeProvider', () => {
  it('renders its children', () => {
    render(
      <ThemeProvider>
        <p>Themed content</p>
      </ThemeProvider>
    )
    expect(screen.getByText('Themed content')).toBeInTheDocument()
  })

  it('forwards provider props', () => {
    render(
      <ThemeProvider defaultTheme="dark" enableSystem={false}>
        <p>Dark content</p>
      </ThemeProvider>
    )
    expect(screen.getByText('Dark content')).toBeInTheDocument()
  })
})
