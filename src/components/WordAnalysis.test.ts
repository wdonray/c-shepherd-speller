import { describe, it, expect } from 'vitest'
import { findPatternInWord, buildMappingNote, splitWordParts } from './WordAnalysis'

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

describe('buildMappingNote', () => {
  it('describes a multi-letter pattern working together', () => {
    expect(buildMappingNote('ai', 'long a', false)).toBe('The letters ai work together to make one sound.')
  })

  it('counts the letters of a split pattern like a_e as multi-letter', () => {
    expect(buildMappingNote('a_e', 'long a', false)).toBe('The letters a_e work together to make one sound.')
  })

  it('describes a single letter spelling the sound', () => {
    expect(buildMappingNote('a', 'short a', false)).toBe('The letter a spells short a here.')
  })

  it('uses the odd-duck note for irregular patterns', () => {
    expect(buildMappingNote('eigh', 'long a', true)).toBe(
      'This word does not follow the usual pattern. It is an odd duck.'
    )
  })
})

describe('splitWordParts', () => {
  it('splits a suffix', () => {
    expect(splitWordParts('playing')).toEqual({ base: 'play', affix: 'ing', kind: 'suffix' })
  })

  it('prefers the longest suffix match', () => {
    expect(splitWordParts('wishes')).toEqual({ base: 'wish', affix: 'es', kind: 'suffix' })
  })

  it('splits a prefix', () => {
    expect(splitWordParts('unhappy')).toEqual({ base: 'happy', affix: 'un', kind: 'prefix' })
  })

  it('checks suffixes before prefixes', () => {
    expect(splitWordParts('resting')).toEqual({ base: 'rest', affix: 'ing', kind: 'suffix' })
  })

  it('is case-insensitive but keeps the word casing in the base', () => {
    expect(splitWordParts('Playing')).toEqual({ base: 'Play', affix: 'ing', kind: 'suffix' })
  })

  it('returns null when no affix applies', () => {
    expect(splitWordParts('cat')).toBeNull()
  })

  it('returns null when the remaining base is too short after a suffix', () => {
    expect(splitWordParts('as')).toBeNull()
  })

  it('returns null when the remaining base is too short after a prefix', () => {
    expect(splitWordParts('un')).toBeNull()
  })
})
