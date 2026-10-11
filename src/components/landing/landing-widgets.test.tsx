import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { SignedInRedirect } from './SignedInRedirect'
import { SampleChart } from './SampleChart'

vi.mock('next-auth/react', () => ({ useSession: vi.fn() }))
const { mockReplace } = vi.hoisted(() => ({ mockReplace: vi.fn() }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
}))

const useSessionMock = vi.mocked(useSession)

describe('SignedInRedirect', () => {
  it('redirects authenticated users to /home', () => {
    useSessionMock.mockReturnValue({ data: {}, status: 'authenticated', update: async () => null } as never)
    render(<SignedInRedirect />)
    expect(mockReplace).toHaveBeenCalledWith('/home')
  })

  it('renders nothing and redirects nobody when unauthenticated', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated', update: async () => null } as never)
    const { container } = render(<SignedInRedirect />)
    expect(container).toBeEmptyDOMElement()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it('does not redirect while the session is loading', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'loading', update: async () => null } as never)
    render(<SignedInRedirect />)
    expect(mockReplace).not.toHaveBeenCalled()
  })
})

describe('SampleChart', () => {
  it('renders the sample list as a non-interactive chart with a caption', () => {
    render(<SampleChart />)
    expect(screen.getByLabelText('Sample pattern chart')).toBeVisible()
    expect(screen.getByText('Week 5: Long A')).toBeVisible()
    expect(screen.getByText(/a sample chart/i)).toBeVisible()
  })
})
