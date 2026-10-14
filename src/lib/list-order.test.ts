import { describe, it, expect } from 'vitest'
import { reorderById } from './list-order'

const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

describe('reorderById', () => {
  it('moves an item forward to the target position', () => {
    expect(reorderById(items, 'a', 'c').map((i) => i.id)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves an item backward to the target position', () => {
    expect(reorderById(items, 'd', 'b').map((i) => i.id)).toEqual(['a', 'd', 'b', 'c'])
  })

  it('moves an item to the first position', () => {
    expect(reorderById(items, 'c', 'a').map((i) => i.id)).toEqual(['c', 'a', 'b', 'd'])
  })

  it('moves an item to the last position', () => {
    expect(reorderById(items, 'a', 'd').map((i) => i.id)).toEqual(['b', 'c', 'd', 'a'])
  })

  it('returns the original array when both ids match', () => {
    expect(reorderById(items, 'b', 'b')).toBe(items)
  })

  it('returns the original array when the active id is missing', () => {
    expect(reorderById(items, 'x', 'b')).toBe(items)
  })

  it('returns the original array when the target id is missing', () => {
    expect(reorderById(items, 'a', 'x')).toBe(items)
  })

  it('does not mutate the input array', () => {
    const input = [{ id: 'a' }, { id: 'b' }]
    reorderById(input, 'a', 'b')
    expect(input.map((i) => i.id)).toEqual(['a', 'b'])
  })
})
