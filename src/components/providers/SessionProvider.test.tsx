import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next-auth/react', () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import SessionProvider from './SessionProvider'

describe('SessionProvider', () => {
  it('renders its children', () => {
    render(
      <SessionProvider>
        <p>Session content</p>
      </SessionProvider>
    )
    expect(screen.getByText('Session content')).toBeInTheDocument()
  })
})
