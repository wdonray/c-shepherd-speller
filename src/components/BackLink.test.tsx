import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import BackLink from './BackLink'

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

describe('BackLink', () => {
  it('renders a link with the given href and children', () => {
    render(<BackLink href="/lists">My lists</BackLink>)
    const link = screen.getByRole('link', { name: /my lists/i })
    expect(link).toHaveAttribute('href', '/lists')
  })

  it('applies custom className alongside the base styles', () => {
    render(
      <BackLink href="/" className="custom-class">
        Back
      </BackLink>
    )
    const link = screen.getByRole('link', { name: /back/i })
    expect(link).toHaveClass('custom-class')
    expect(link).toHaveClass('inline-flex')
  })
})
