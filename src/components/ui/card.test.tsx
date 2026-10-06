import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from './card'

describe('Card', () => {
  it('renders with the card slot and base classes', () => {
    render(<Card>Body</Card>)
    const card = screen.getByText('Body')
    expect(card).toHaveAttribute('data-slot', 'card')
    expect(card).toHaveClass('bg-card', 'rounded-[20px]', 'border-2', 'border-line')
  })

  it('merges a custom className and forwards props', () => {
    render(
      <Card className="custom" data-testid="card-id">
        Body
      </Card>
    )
    const card = screen.getByTestId('card-id')
    expect(card).toHaveClass('custom')
  })
})

describe('CardHeader', () => {
  it('renders with the card-header slot', () => {
    render(<CardHeader>Header</CardHeader>)
    const header = screen.getByText('Header')
    expect(header).toHaveAttribute('data-slot', 'card-header')
    expect(header).toHaveClass('px-6')
  })

  it('merges a custom className', () => {
    render(<CardHeader className="extra">Header</CardHeader>)
    expect(screen.getByText('Header')).toHaveClass('extra')
  })
})

describe('CardTitle', () => {
  it('renders with the card-title slot', () => {
    render(<CardTitle>My title</CardTitle>)
    const title = screen.getByText('My title')
    expect(title).toHaveAttribute('data-slot', 'card-title')
    expect(title).toHaveClass('font-bold')
  })

  it('merges a custom className', () => {
    render(<CardTitle className="extra">My title</CardTitle>)
    expect(screen.getByText('My title')).toHaveClass('extra')
  })
})

describe('CardDescription', () => {
  it('renders with the card-description slot', () => {
    render(<CardDescription>Some description</CardDescription>)
    const description = screen.getByText('Some description')
    expect(description).toHaveAttribute('data-slot', 'card-description')
    expect(description).toHaveClass('text-muted-foreground')
  })

  it('merges a custom className', () => {
    render(<CardDescription className="extra">Some description</CardDescription>)
    expect(screen.getByText('Some description')).toHaveClass('extra')
  })
})

describe('CardAction', () => {
  it('renders with the card-action slot', () => {
    render(<CardAction>Action</CardAction>)
    const action = screen.getByText('Action')
    expect(action).toHaveAttribute('data-slot', 'card-action')
    expect(action).toHaveClass('col-start-2')
  })

  it('merges a custom className', () => {
    render(<CardAction className="extra">Action</CardAction>)
    expect(screen.getByText('Action')).toHaveClass('extra')
  })
})

describe('CardContent', () => {
  it('renders with the card-content slot', () => {
    render(<CardContent>Content</CardContent>)
    const content = screen.getByText('Content')
    expect(content).toHaveAttribute('data-slot', 'card-content')
    expect(content).toHaveClass('px-6')
  })

  it('merges a custom className', () => {
    render(<CardContent className="extra">Content</CardContent>)
    expect(screen.getByText('Content')).toHaveClass('extra')
  })
})

describe('CardFooter', () => {
  it('renders with the card-footer slot', () => {
    render(<CardFooter>Footer</CardFooter>)
    const footer = screen.getByText('Footer')
    expect(footer).toHaveAttribute('data-slot', 'card-footer')
    expect(footer).toHaveClass('flex', 'items-center')
  })

  it('merges a custom className', () => {
    render(<CardFooter className="extra">Footer</CardFooter>)
    expect(screen.getByText('Footer')).toHaveClass('extra')
  })
})

describe('Card composition', () => {
  it('renders all parts together', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Full card</CardTitle>
          <CardDescription>Full description</CardDescription>
          <CardAction>Act</CardAction>
        </CardHeader>
        <CardContent>Inner content</CardContent>
        <CardFooter>Inner footer</CardFooter>
      </Card>
    )
    expect(screen.getByText('Full card')).toBeInTheDocument()
    expect(screen.getByText('Full description')).toBeInTheDocument()
    expect(screen.getByText('Act')).toBeInTheDocument()
    expect(screen.getByText('Inner content')).toBeInTheDocument()
    expect(screen.getByText('Inner footer')).toBeInTheDocument()
  })
})
