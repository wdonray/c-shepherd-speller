import { describe, it, expect } from 'vitest'
import { wordMatchesPattern } from './word-pattern-match'

describe('wordMatchesPattern', () => {
  it('matches a contiguous pattern as a substring', () => {
    expect(wordMatchesPattern('meet', 'ee')).toBe(true)
    expect(wordMatchesPattern('sheep', 'ee')).toBe(true)
  })

  it('rejects a word missing a contiguous pattern', () => {
    expect(wordMatchesPattern('bed', 'ee')).toBe(false)
    expect(wordMatchesPattern('cat', 'ai')).toBe(false)
  })

  it('matches a split pattern when the first letter comes before the last', () => {
    expect(wordMatchesPattern('cake', 'a_e')).toBe(true)
    expect(wordMatchesPattern('bike', 'i_e')).toBe(true)
  })

  it('rejects a word missing one half of a split pattern', () => {
    expect(wordMatchesPattern('cat', 'a_e')).toBe(false)
    expect(wordMatchesPattern('bed', 'a_e')).toBe(false)
  })

  it('is case-insensitive', () => {
    expect(wordMatchesPattern('Cake', 'A_E')).toBe(true)
    expect(wordMatchesPattern('MEET', 'ee')).toBe(true)
  })

  it('does not warn when no pattern is typed yet', () => {
    expect(wordMatchesPattern('xylophone', '')).toBe(true)
    expect(wordMatchesPattern('xylophone', '   ')).toBe(true)
  })

  it('cannot catch subtle cases, so it errs toward matching', () => {
    // "have" is not a true a_e (magic e) word, but the heuristic sees
    // a before e and matches. Callers must warn rather than block.
    expect(wordMatchesPattern('have', 'a_e')).toBe(true)
  })
})
