import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import BackBreadcrumb from './BackBreadcrumb'

vi.mock('next/link', () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))

describe('BackBreadcrumb', () => {
  it('renders a link to the parent with the parent label as its name', () => {
    render(<BackBreadcrumb href="/lists" label="My spelling lists" />)
    const link = screen.getByRole('link', { name: 'My spelling lists' })
    expect(link).toHaveAttribute('href', '/lists')
  })

  it('applies custom className alongside the base styles', () => {
    render(<BackBreadcrumb href="/home" label="Home" className="custom-class" />)
    const link = screen.getByRole('link', { name: 'Home' })
    expect(link).toHaveClass('custom-class')
    expect(link).toHaveClass('inline-flex')
  })
})
