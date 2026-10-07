import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockNextAuthSessionProvider = vi.hoisted(() =>
  vi.fn(({ children }: { children: React.ReactNode }) => <>{children}</>)
)

vi.mock('next-auth/react', () => ({
  SessionProvider: mockNextAuthSessionProvider,
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

  it('disables refetch on window focus so tab switches do not re-fetch the session', () => {
    render(
      <SessionProvider>
        <p>Session content</p>
      </SessionProvider>
    )
    const props = mockNextAuthSessionProvider.mock.calls[0][0] as {
      refetchOnWindowFocus?: boolean
    }
    expect(props.refetchOnWindowFocus).toBe(false)
  })
})
