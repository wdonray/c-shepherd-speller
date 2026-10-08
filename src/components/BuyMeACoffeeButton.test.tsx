import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { BuyMeACoffeeButton } from './BuyMeACoffeeButton'

describe('BuyMeACoffeeButton', () => {
  it('renders a link labeled "Buy me a coffee"', () => {
    render(<BuyMeACoffeeButton />)
    expect(screen.getByRole('link', { name: 'Buy me a coffee' })).toBeInTheDocument()
  })

  it('opens the donation page in a new tab safely', () => {
    render(<BuyMeACoffeeButton />)
    const link = screen.getByRole('link', { name: 'Buy me a coffee' })
    expect(link).toHaveAttribute('href', 'https://buymeacoffee.com/donrayxwils')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
  })

  it('renders a coffee icon', () => {
    const { container } = render(<BuyMeACoffeeButton />)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
