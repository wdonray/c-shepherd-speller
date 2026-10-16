import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const { useSession } = vi.hoisted(() => ({ useSession: vi.fn() }))
vi.mock('next-auth/react', () => ({ useSession }))

const { syncNow } = vi.hoisted(() => ({ syncNow: vi.fn() }))
vi.mock('@/lib/voice-sync', () => ({ syncNow }))

import VoiceSyncRunner from './VoiceSyncRunner'

describe('VoiceSyncRunner', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    syncNow.mockResolvedValue(undefined)
  })

  it('starts a sync pass when the session is authenticated', async () => {
    useSession.mockReturnValue({ status: 'authenticated' })
    render(<VoiceSyncRunner />)
    await waitFor(() => expect(syncNow).toHaveBeenCalledTimes(1))
  })

  it('does not sync while loading or signed out', () => {
    useSession.mockReturnValue({ status: 'loading' })
    render(<VoiceSyncRunner />)
    expect(syncNow).not.toHaveBeenCalled()
    useSession.mockReturnValue({ status: 'unauthenticated' })
    render(<VoiceSyncRunner />)
    expect(syncNow).not.toHaveBeenCalled()
  })

  it('swallows sync failures so a background pass never crashes the app', async () => {
    useSession.mockReturnValue({ status: 'authenticated' })
    syncNow.mockRejectedValue(new Error('network down'))
    expect(() => render(<VoiceSyncRunner />)).not.toThrow()
    await waitFor(() => expect(syncNow).toHaveBeenCalledTimes(1))
  })

  it('renders nothing', () => {
    useSession.mockReturnValue({ status: 'authenticated' })
    const { container } = render(<VoiceSyncRunner />)
    expect(container).toBeEmptyDOMElement()
  })
})
