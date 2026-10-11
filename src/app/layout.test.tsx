import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { usePathname, useSearchParams, type ReadonlyURLSearchParams } from 'next/navigation'
import RootLayout from './layout'

vi.mock('./globals.css', () => ({}))
vi.mock('next/font/local', () => ({
  default: () => ({ variable: 'font-lexend' }),
}))
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('next-themes', () => ({
  useTheme: vi.fn(),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('next/navigation', () => ({ usePathname: vi.fn(), useSearchParams: vi.fn() }))
vi.mock('@/lib/spelling-api', () => ({
  getUserByEmail: vi.fn(),
  getSpelling: vi.fn(),
}))

describe('RootLayout', () => {
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({
      data: { user: { id: 'u1', email: 't@e.c' } },
      status: 'authenticated',
      update: async () => null,
    } as never)
    vi.mocked(useTheme).mockReturnValue({ theme: 'light', setTheme: vi.fn() } as never)
    vi.mocked(usePathname).mockReturnValue('/lists')
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams() as unknown as ReadonlyURLSearchParams)
  })

  it('renders header, main with the child, and footer on app routes', () => {
    render(
      <RootLayout>
        <p>child content</p>
      </RootLayout>
    )

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toHaveTextContent('PatternSpell')
    const main = screen.getByRole('main')
    expect(main).toBeInTheDocument()
    expect(main).toHaveTextContent('child content')
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByText('child content')).toBeInTheDocument()
  })

  it('keeps the header on the /display list picker', () => {
    vi.mocked(usePathname).mockReturnValue('/display')
    render(
      <RootLayout>
        <p>picker child</p>
      </RootLayout>
    )

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('picker child')
  })

  it('renders chrome-free in present mode (/display with a list selected)', () => {
    vi.mocked(usePathname).mockReturnValue('/display')
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams('list=l1') as unknown as ReadonlyURLSearchParams)
    render(
      <RootLayout>
        <p>display child</p>
      </RootLayout>
    )

    expect(screen.queryByRole('banner')).not.toBeInTheDocument()
    expect(screen.queryByRole('contentinfo')).not.toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveTextContent('display child')
  })
})
