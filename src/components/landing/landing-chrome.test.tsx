import { describe, it, expect } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { LandingHeader } from './LandingHeader'
import { LandingFooter } from './LandingFooter'

describe('LandingHeader', () => {
  it('links the brand to the landing page', () => {
    render(<LandingHeader />)
    expect(screen.getByRole('link', { name: /patternspell home/i })).toHaveAttribute('href', '/')
  })

  it('offers log in and get started actions in the desktop nav', () => {
    render(<LandingHeader />)
    const desktopNav = screen.getByRole('navigation', { name: /landing page/i })
    expect(within(desktopNav).getByRole('link', { name: /^log in$/i })).toHaveAttribute('href', '/auth/signin')
    expect(within(desktopNav).getByRole('link', { name: /get started free/i })).toHaveAttribute('href', '/auth/signin')
  })

  it('links to the page sections in the desktop nav', () => {
    render(<LandingHeader />)
    const desktopNav = screen.getByRole('navigation', { name: /landing page/i })
    expect(within(desktopNav).getByRole('link', { name: /how it works/i })).toHaveAttribute('href', '#how-it-works')
    expect(within(desktopNav).getByRole('link', { name: /who it is for/i })).toHaveAttribute('href', '#who-its-for')
  })

  it('shows a hamburger menu trigger for the mobile nav', () => {
    render(<LandingHeader />)
    expect(screen.getByRole('button', { name: /open menu/i })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('opens a bottom sheet with the mobile menu items', () => {
    render(<LandingHeader />)
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))

    const menu = within(screen.getByRole('dialog'))
    expect(menu.getByRole('link', { name: /how it works/i })).toHaveAttribute('href', '#how-it-works')
    expect(menu.getByRole('link', { name: /who it is for/i })).toHaveAttribute('href', '#who-its-for')
    expect(menu.getByRole('link', { name: /^log in$/i })).toHaveAttribute('href', '/auth/signin')
    expect(menu.getByRole('link', { name: /get started free/i })).toHaveAttribute('href', '/auth/signin')
  })

  it('closes the mobile menu with Escape', () => {
    render(<LandingHeader />)
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('LandingFooter', () => {
  it('links the legal pages', () => {
    render(<LandingFooter />)
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: /terms of service/i })).toHaveAttribute('href', '/terms')
  })
})
