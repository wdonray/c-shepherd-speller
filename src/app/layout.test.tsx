import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import { usePathname } from 'next/navigation'
import RootLayout from './layout'

vi.mock('./globals.css', () => ({}))
vi.mock('next/font/google', () => ({
  Lexend: () => ({ variable: 'font-lexend' }),
}))
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('next-themes', () => ({
  useTheme: vi.fn(),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('next/navigation', () => ({ usePathname: vi.fn() }))
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
    vi.mocked(usePathname).mockReturnValue('/')
  })

  it('renders header, main with the child, and footer', () => {
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

  it('renders chrome-free on the display route', () => {
    vi.mocked(usePathname).mockReturnValue('/display')
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
