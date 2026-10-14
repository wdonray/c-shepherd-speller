import { describe, it, expect } from 'vitest'
import {
  sortFavorites,
  hasFavorites,
  toggleFavorite,
  reorderFavorites,
  sortLists,
  initializeCustomOrder,
  reorderCustom,
} from './list-organize'
import type { WordList } from '@/models/WordList'

function makeList(id: string, overrides: Partial<WordList> = {}): WordList {
  return {
    id,
    userId: 'u1',
    name: `List ${id}`,
    patterns: [],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('sortFavorites', () => {
  it('returns only starred lists in favorite order', () => {
    const lists = [
      makeList('a', { isFavorite: true, favoriteOrder: 1 }),
      makeList('b'),
      makeList('c', { isFavorite: true, favoriteOrder: 0 }),
    ]
    expect(sortFavorites(lists).map((l) => l.id)).toEqual(['c', 'a'])
  })

  it('sorts unordered favorites last', () => {
    const lists = [makeList('a', { isFavorite: true }), makeList('b', { isFavorite: true, favoriteOrder: 0 })]
    expect(sortFavorites(lists).map((l) => l.id)).toEqual(['b', 'a'])
  })

  it('keeps multiple unordered favorites in stable order', () => {
    const lists = [makeList('a', { isFavorite: true }), makeList('b', { isFavorite: true })]
    expect(sortFavorites(lists).map((l) => l.id)).toEqual(['a', 'b'])
  })

  it('returns an empty array when nothing is starred', () => {
    expect(sortFavorites([makeList('a')])).toEqual([])
  })
})

describe('hasFavorites', () => {
  it('is true when at least one list is starred', () => {
    expect(hasFavorites([makeList('a'), makeList('b', { isFavorite: true })])).toBe(true)
  })

  it('is false when nothing is starred', () => {
    expect(hasFavorites([makeList('a')])).toBe(false)
  })
})

describe('toggleFavorite', () => {
  it('stars an unstarred list with the next favorite order', () => {
    const lists = [makeList('a', { isFavorite: true, favoriteOrder: 2 }), makeList('b')]
    const result = toggleFavorite(lists, 'b')
    expect(result).not.toBeNull()
    expect(result!.update).toEqual({ isFavorite: true, favoriteOrder: 3 })
    expect(result!.lists.find((l) => l.id === 'b')!.isFavorite).toBe(true)
    expect(result!.lists.find((l) => l.id === 'a')!.isFavorite).toBe(true)
  })

  it('stars the first favorite at order 0', () => {
    const result = toggleFavorite([makeList('a')], 'a')
    expect(result!.update).toEqual({ isFavorite: true, favoriteOrder: 0 })
  })

  it('unstars a starred list and keeps its order', () => {
    const lists = [makeList('a', { isFavorite: true, favoriteOrder: 4 })]
    const result = toggleFavorite(lists, 'a')
    expect(result!.update).toEqual({ isFavorite: false, favoriteOrder: 4 })
    expect(result!.lists.find((l) => l.id === 'a')!.isFavorite).toBe(false)
  })

  it('defaults the kept order to 0 when unstarring without an order', () => {
    const lists = [makeList('a', { isFavorite: true })]
    const result = toggleFavorite(lists, 'a')
    expect(result!.update).toEqual({ isFavorite: false, favoriteOrder: 0 })
  })

  it('returns null for an unknown list', () => {
    expect(toggleFavorite([makeList('a')], 'missing')).toBeNull()
  })
})

describe('reorderFavorites', () => {
  it('moves a favorite and reassigns orders 0..n-1', () => {
    const lists = [
      makeList('a', { isFavorite: true, favoriteOrder: 0 }),
      makeList('b', { isFavorite: true, favoriteOrder: 1 }),
      makeList('c', { isFavorite: true, favoriteOrder: 2 }),
      makeList('d'),
    ]
    const result = reorderFavorites(lists, 'a', 'c')
    expect(result.find((l) => l.id === 'a')!.favoriteOrder).toBe(2)
    expect(result.find((l) => l.id === 'b')!.favoriteOrder).toBe(0)
    expect(result.find((l) => l.id === 'c')!.favoriteOrder).toBe(1)
    // Non-favorites are untouched.
    expect(result.find((l) => l.id === 'd')!.favoriteOrder).toBeUndefined()
  })

  it('returns the original array when the drag changes nothing', () => {
    const lists = [makeList('a', { isFavorite: true, favoriteOrder: 0 })]
    expect(reorderFavorites(lists, 'a', 'a')).toBe(lists)
  })

  it('returns the original array for unknown ids', () => {
    const lists = [makeList('a', { isFavorite: true, favoriteOrder: 0 })]
    expect(reorderFavorites(lists, 'a', 'missing')).toBe(lists)
  })
})

describe('sortLists', () => {
  const a = makeList('a', {
    name: 'Zebra',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-10T00:00:00.000Z',
  })
  const b = makeList('b', {
    name: 'Apple',
    createdAt: '2026-10-03T00:00:00.000Z',
    updatedAt: '2026-10-12T00:00:00.000Z',
  })
  const c = makeList('c', {
    name: 'Mango',
    createdAt: '2026-10-02T00:00:00.000Z',
    updatedAt: '2026-10-11T00:00:00.000Z',
  })

  it('sorts by recently modified by default', () => {
    expect(sortLists([a, b, c], 'recent').map((l) => l.id)).toEqual(['b', 'c', 'a'])
  })

  it('sorts by name A-Z', () => {
    expect(sortLists([a, b, c], 'name').map((l) => l.id)).toEqual(['b', 'c', 'a'])
  })

  it('sorts by recently created', () => {
    expect(sortLists([a, b, c], 'created').map((l) => l.id)).toEqual(['b', 'c', 'a'])
  })

  it('sorts by custom order', () => {
    const lists = [makeList('a', { sortOrder: 2 }), makeList('b', { sortOrder: 0 }), makeList('c', { sortOrder: 1 })]
    expect(sortLists(lists, 'custom').map((l) => l.id)).toEqual(['b', 'c', 'a'])
  })

  it('sorts lists without a custom order last', () => {
    const lists = [makeList('a'), makeList('b', { sortOrder: 0 })]
    expect(sortLists(lists, 'custom').map((l) => l.id)).toEqual(['b', 'a'])
  })

  it('keeps multiple unordered lists in stable order', () => {
    const lists = [makeList('a'), makeList('b')]
    expect(sortLists(lists, 'custom').map((l) => l.id)).toEqual(['a', 'b'])
  })

  it('falls back to recently modified for an unknown sort', () => {
    expect(sortLists([a, b], 'bogus' as never).map((l) => l.id)).toEqual(['b', 'a'])
  })

  it('does not mutate the input array', () => {
    const lists = [a, b]
    sortLists(lists, 'name')
    expect(lists.map((l) => l.id)).toEqual(['a', 'b'])
  })
})

describe('initializeCustomOrder', () => {
  it('assigns sequential sort orders following the given order', () => {
    const result = initializeCustomOrder([makeList('a'), makeList('b')])
    expect(result.map((l) => l.sortOrder)).toEqual([0, 1])
  })
})

describe('reorderCustom', () => {
  it('moves a list and reassigns sort orders 0..n-1', () => {
    const lists = [makeList('a', { sortOrder: 0 }), makeList('b', { sortOrder: 1 }), makeList('c', { sortOrder: 2 })]
    const result = reorderCustom(lists, 'a', 'c')
    expect(result.find((l) => l.id === 'a')!.sortOrder).toBe(2)
    expect(result.find((l) => l.id === 'b')!.sortOrder).toBe(0)
    expect(result.find((l) => l.id === 'c')!.sortOrder).toBe(1)
  })

  it('returns the original array when the drag changes nothing', () => {
    const lists = [makeList('a', { sortOrder: 0 })]
    expect(reorderCustom(lists, 'a', 'a')).toBe(lists)
  })

  it('returns the original array for unknown ids', () => {
    const lists = [makeList('a', { sortOrder: 0 })]
    expect(reorderCustom(lists, 'a', 'missing')).toBe(lists)
  })
})
