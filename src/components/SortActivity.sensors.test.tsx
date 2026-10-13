import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import SortActivity from './SortActivity'
import type { WordList } from '@/models/WordList'

// Capture the sensors prop handed to DndContext. Dnd-kit's KeyboardSensor
// destructures `options` in handleKeyDown, so a sensor descriptor without an
// options object crashes at runtime with
// "TypeError: Cannot read properties of undefined (reading 'keyboardCodes')"
// (sentry issue #255).
const seen: { sensors?: { sensor: unknown; options?: unknown }[] }[] = []
vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>()
  return {
    ...actual,
    DndContext: ({
      children,
      sensors,
    }: {
      children: React.ReactNode
      sensors?: { sensor: unknown; options?: unknown }[]
    }) => {
      seen.push({ sensors })
      return <>{children}</>
    },
    DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  }
})

vi.mock('@/lib/sound-effects', () => ({
  playCorrectSound: vi.fn(),
  playIncorrectSound: vi.fn(),
  isSoundEnabled: () => true,
  setSoundEnabled: vi.fn(),
}))

const list: WordList = {
  id: 'l1',
  userId: 'u1',
  name: 'Week 5',
  patterns: [
    { id: 'p1', sound: 'long a', pattern: 'a_e', frequency: 'common', words: ['cake', 'bake'] },
    { id: 'p2', sound: 'long a', pattern: 'ai', frequency: 'common', words: ['rain'] },
    { id: 'p3', sound: 'long a', pattern: 'odd', frequency: 'rare', words: ['said'], isOddDuck: true },
  ],
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
}

describe('SortActivity sensors', () => {
  beforeEach(() => {
    seen.length = 0
  })

  it('gives every sensor descriptor an options object (sentry #255)', () => {
    render(<SortActivity list={list} onExit={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Drag the word cake' })).toBeInTheDocument()
    expect(seen.length).toBeGreaterThan(0)
    const sensors = seen[seen.length - 1].sensors ?? []
    expect(sensors.length).toBe(2)
    for (const entry of sensors) {
      expect(entry.options, 'sensor descriptor options').toBeDefined()
    }
  })
})
