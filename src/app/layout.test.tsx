import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { useTheme } from 'next-themes'
import RootLayout from './layout'

vi.mock('./globals.css', () => ({}))
vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: 'font-sans' }),
  Geist_Mono: () => ({ variable: 'font-mono' }),
}))
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(),
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock('next-themes', () => ({
  useTheme: vi.fn(),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
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
  })

  it('renders header, main with the child, and footer', () => {
    render(
      <RootLayout>
        <p>child content</p>
      </RootLayout>
    )

    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toHaveTextContent('Shepherd Speller')
    const main = screen.getByRole('main')
    expect(main).toBeInTheDocument()
    expect(main).toHaveTextContent('child content')
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getByText('child content')).toBeInTheDocument()
  })
})
