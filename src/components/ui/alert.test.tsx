import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Alert, AlertDescription, AlertTitle } from './alert'

describe('Alert', () => {
  it('renders with role=alert and default variant classes', () => {
    render(<Alert>Heads up</Alert>)
    const alert = screen.getByRole('alert')
    expect(alert).toBeInTheDocument()
    expect(alert).toHaveAttribute('data-slot', 'alert')
    expect(alert).toHaveClass('bg-card')
    expect(alert).toHaveClass('text-card-foreground')
  })

  it('applies the destructive variant classes', () => {
    render(<Alert variant="destructive">Danger</Alert>)
    const alert = screen.getByRole('alert')
    expect(alert).toHaveClass('text-destructive')
    expect(alert).not.toHaveClass('bg-card', 'text-card-foreground')
  })

  it('merges a custom className', () => {
    render(<Alert className="custom-class">Merged</Alert>)
    expect(screen.getByRole('alert')).toHaveClass('custom-class')
  })

  it('forwards additional props', () => {
    render(<Alert data-testid="alert-id">Props</Alert>)
    expect(screen.getByTestId('alert-id')).toBeInTheDocument()
  })
})

describe('AlertTitle', () => {
  it('renders with the alert-title slot and children', () => {
    render(
      <Alert>
        <AlertTitle>Title here</AlertTitle>
      </Alert>
    )
    const title = screen.getByText('Title here')
    expect(title).toHaveAttribute('data-slot', 'alert-title')
    expect(title).toHaveClass('font-medium')
  })

  it('merges a custom className', () => {
    render(<AlertTitle className="extra">T</AlertTitle>)
    expect(screen.getByText('T')).toHaveClass('extra')
  })
})

describe('AlertDescription', () => {
  it('renders with the alert-description slot and children', () => {
    render(
      <Alert>
        <AlertDescription>Description here</AlertDescription>
      </Alert>
    )
    const description = screen.getByText('Description here')
    expect(description).toHaveAttribute('data-slot', 'alert-description')
    expect(description).toHaveClass('text-muted-foreground')
  })

  it('merges a custom className', () => {
    render(<AlertDescription className="extra">D</AlertDescription>)
    expect(screen.getByText('D')).toHaveClass('extra')
  })
})
