import { describe, it, expect } from 'vitest'
import { findPatternInWord } from './WordAnalysis'

describe('findPatternInWord', () => {
  it('finds a simple pattern', () => {
    expect(findPatternInWord('rain', 'ai')).toEqual([1, 3])
  })

  it('is case-insensitive', () => {
    expect(findPatternInWord('Rain', 'AI')).toEqual([1, 3])
  })

  it('finds a split pattern like a_e', () => {
    expect(findPatternInWord('cake', 'a_e')).toEqual([1, 4])
  })

  it('returns null when the pattern is not in the word', () => {
    expect(findPatternInWord('cat', 'ai')).toBeNull()
  })

  it('returns null when the split pattern second part does not match', () => {
    expect(findPatternInWord('cart', 'a_e')).toBeNull()
  })

  it('returns null when the split pattern first part is missing', () => {
    expect(findPatternInWord('elk', 'a_e')).toBeNull()
  })

  it('returns null for a malformed split pattern', () => {
    expect(findPatternInWord('cake', 'a_e_i')).toBeNull()
  })
})
