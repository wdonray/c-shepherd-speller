import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { usePathname } from 'next/navigation'
import { SiteChrome } from './SiteChrome'

vi.mock('next/navigation', () => ({ usePathname: vi.fn() }))
vi.mock('./Header', () => ({ Header: () => <div data-testid="site-header" /> }))
vi.mock('./Footer', () => ({ Footer: () => <div data-testid="site-footer" /> }))

const usePathnameMock = vi.mocked(usePathname)

describe('SiteChrome', () => {
  beforeEach(() => {
    usePathnameMock.mockReset()
  })

  it('renders the header, footer, and contained main on regular pages', () => {
    usePathnameMock.mockReturnValue('/')
    render(
      <SiteChrome>
        <p>page content</p>
      </SiteChrome>
    )

    expect(screen.getByTestId('site-header')).toBeInTheDocument()
    expect(screen.getByTestId('site-footer')).toBeInTheDocument()
    const main = screen.getByRole('main')
    expect(main).toHaveTextContent('page content')
    expect(main.className).toContain('container')
  })

  it('renders a chrome-free full-bleed main on /display', () => {
    usePathnameMock.mockReturnValue('/display')
    render(
      <SiteChrome>
        <p>display content</p>
      </SiteChrome>
    )

    expect(screen.queryByTestId('site-header')).not.toBeInTheDocument()
    expect(screen.queryByTestId('site-footer')).not.toBeInTheDocument()
    const main = screen.getByRole('main')
    expect(main).toHaveTextContent('display content')
    expect(main.className).not.toContain('container')
  })
})
