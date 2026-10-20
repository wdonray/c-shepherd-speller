'use client'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import ListSortMenu from './ListSortMenu'
import type { ListSort } from '@/lib/list-organize'

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
}

describe('ListSortMenu', () => {
  const onSortChange = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows the current sort label on desktop', () => {
    mockMatchMedia(false)
    render(<ListSortMenu sort="name" onSortChange={onSortChange} />)
    expect(screen.getByRole('button', { name: 'Sort: Name A-Z' })).toBeInTheDocument()
  })

  it('changes the sort from the dropdown on desktop', async () => {
    mockMatchMedia(false)
    render(<ListSortMenu sort="recent" onSortChange={onSortChange} />)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Sort: Recently modified' }), { pointerType: 'mouse' })
    const option = await screen.findByRole('menuitemradio', { name: 'Name A-Z' })
    fireEvent.click(option)
    expect(onSortChange).toHaveBeenCalledWith('name')
  })

  it('marks the active sort in the dropdown', async () => {
    mockMatchMedia(false)
    render(<ListSortMenu sort="created" onSortChange={onSortChange} />)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Sort: Recently created' }), { pointerType: 'mouse' })
    const option = await screen.findByRole('menuitemradio', { name: 'Recently created' })
    expect(option).toHaveAttribute('aria-checked', 'true')
  })

  it('opens a bottom sheet on mobile', async () => {
    mockMatchMedia(true)
    render(<ListSortMenu sort="recent" onSortChange={onSortChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sort: Recently modified' }))
    expect(await screen.findByRole('dialog', { name: 'Sort lists' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Custom order' })).toBeInTheDocument()
  })

  it('changes the sort from the bottom sheet on mobile', async () => {
    mockMatchMedia(true)
    render(<ListSortMenu sort="recent" onSortChange={onSortChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sort: Recently modified' }))
    const option = await screen.findByRole('button', { name: 'Custom order' })
    fireEvent.click(option)
    expect(onSortChange).toHaveBeenCalledWith('custom')
  })

  it('marks the active sort in the bottom sheet', async () => {
    mockMatchMedia(true)
    render(<ListSortMenu sort="name" onSortChange={onSortChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Sort: Name A-Z' }))
    const option = await screen.findByRole('button', { name: 'Name A-Z' })
    expect(option).toHaveAttribute('aria-pressed', 'true')
  })

  it('falls back to Recently modified for an unknown sort', () => {
    mockMatchMedia(false)
    render(<ListSortMenu sort={'bogus' as ListSort} onSortChange={onSortChange} />)
    expect(screen.getByRole('button', { name: 'Sort: Recently modified' })).toBeInTheDocument()
  })

  it('renders an icon-only trigger with an active state when the sort is non-default', () => {
    mockMatchMedia(true)
    render(<ListSortMenu sort="name" onSortChange={onSortChange} iconOnly />)
    const trigger = screen.getByRole('button', { name: 'Sort lists' })
    expect(trigger).toHaveAttribute('aria-pressed', 'true')
    expect(trigger.className).toContain('bg-ink')
  })

  it('renders an inactive icon-only trigger for the default sort', () => {
    mockMatchMedia(true)
    render(<ListSortMenu sort="recent" onSortChange={onSortChange} iconOnly />)
    const trigger = screen.getByRole('button', { name: 'Sort lists' })
    expect(trigger).toHaveAttribute('aria-pressed', 'false')
    expect(trigger.className).not.toContain('bg-ink')
  })

  it('opens the bottom sheet from the icon-only trigger on mobile', async () => {
    mockMatchMedia(true)
    render(<ListSortMenu sort="recent" onSortChange={onSortChange} iconOnly />)
    fireEvent.click(screen.getByRole('button', { name: 'Sort lists' }))
    expect(await screen.findByRole('dialog', { name: 'Sort lists' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Name A-Z' }))
    expect(onSortChange).toHaveBeenCalledWith('name')
  })

  it('opens the dropdown from the icon-only trigger on desktop', async () => {
    mockMatchMedia(false)
    render(<ListSortMenu sort="recent" onSortChange={onSortChange} iconOnly />)
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Sort lists' }), { pointerType: 'mouse' })
    const option = await screen.findByRole('menuitemradio', { name: 'Name A-Z' })
    fireEvent.click(option)
    expect(onSortChange).toHaveBeenCalledWith('name')
  })
})
