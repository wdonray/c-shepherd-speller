import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { usePathname, useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation'
import { SiteChrome } from './SiteChrome'

vi.mock('next/navigation', () => ({ usePathname: vi.fn(), useSearchParams: vi.fn() }))
vi.mock('./Header', () => ({ Header: () => <div data-testid="site-header" /> }))
vi.mock('./Footer', () => ({ Footer: () => <div data-testid="site-footer" /> }))

const usePathnameMock = vi.mocked(usePathname)
const useSearchParamsMock = vi.mocked(useSearchParams)

function searchParams(query = ''): ReadonlyURLSearchParams {
  return new URLSearchParams(query) as unknown as ReadonlyURLSearchParams
}

describe('SiteChrome', () => {
  beforeEach(() => {
    usePathnameMock.mockReset()
    useSearchParamsMock.mockReset()
    useSearchParamsMock.mockReturnValue(searchParams())
  })

  it('renders the header, footer, and full-width main on regular pages', () => {
    usePathnameMock.mockReturnValue('/home')
    render(
      <SiteChrome>
        <p>page content</p>
      </SiteChrome>
    )

    expect(screen.getByTestId('site-header')).toBeInTheDocument()
    expect(screen.getByTestId('site-footer')).toBeInTheDocument()
    const main = screen.getByRole('main')
    expect(main).toHaveTextContent('page content')
    expect(main.className).toContain('min-h-dvh')
  })

  it('reserves the 74px header space so the header popping in never shifts layout', () => {
    usePathnameMock.mockReturnValue('/home')
    const { container } = render(
      <SiteChrome>
        <p>page content</p>
      </SiteChrome>
    )

    const slot = screen.getByTestId('site-header').parentElement
    expect(slot?.className).toContain('min-h-[74px]')
    expect(container.firstChild).toBe(slot)
  })

  it('renders a chrome-free main on the landing page (it has its own header)', () => {
    usePathnameMock.mockReturnValue('/')
    render(
      <SiteChrome>
        <p>landing content</p>
      </SiteChrome>
    )

    expect(screen.queryByTestId('site-header')).not.toBeInTheDocument()
    expect(screen.queryByTestId('site-footer')).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('landing content')
  })

  it('keeps the header on the /display list picker: present mode starts at list selection', () => {
    usePathnameMock.mockReturnValue('/display')
    render(
      <SiteChrome>
        <p>picker content</p>
      </SiteChrome>
    )

    expect(screen.getByTestId('site-header')).toBeInTheDocument()
    expect(screen.getByTestId('site-footer')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('picker content')
  })

  it('renders a chrome-free full-bleed main in present mode (/display with a list selected)', () => {
    usePathnameMock.mockReturnValue('/display')
    useSearchParamsMock.mockReturnValue(searchParams('list=l1'))
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

  it('renders a chrome-free full-bleed main on print routes', () => {
    usePathnameMock.mockReturnValue('/lists/l1/print')
    render(
      <SiteChrome>
        <p>print content</p>
      </SiteChrome>
    )

    expect(screen.queryByTestId('site-header')).not.toBeInTheDocument()
    expect(screen.queryByTestId('site-footer')).not.toBeInTheDocument()
    const main = screen.getByRole('main')
    expect(main).toHaveTextContent('print content')
  })
})
