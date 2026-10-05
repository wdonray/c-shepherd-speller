import { describe, it, expect } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('a', 'b')).toBe('a b')
  })

  it('resolves tailwind conflicts with tailwind-merge', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('handles conditional and falsy inputs', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('handles object inputs', () => {
    expect(cn({ active: true, hidden: false })).toBe('active')
  })

  it('returns an empty string for no inputs', () => {
    expect(cn()).toBe('')
  })
})
