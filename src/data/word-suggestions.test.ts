import { describe, it, expect } from 'vitest'
import { WORD_SUGGESTIONS } from './word-suggestions'

describe('WORD_SUGGESTIONS data invariants', () => {
  const entries: Array<[string, string, string[]]> = []
  for (const [sound, patterns] of Object.entries(WORD_SUGGESTIONS)) {
    for (const [pattern, words] of Object.entries(patterns)) {
      entries.push([sound, pattern, words])
    }
  }

  it('has 300-600 words across at least 40 pattern+sound combos', () => {
    const totalWords = entries.reduce((n, [, , words]) => n + words.length, 0)
    expect(entries.length).toBeGreaterThanOrEqual(40)
    expect(totalWords).toBeGreaterThanOrEqual(300)
    expect(totalWords).toBeLessThanOrEqual(600)
  })

  it('uses lowercase trimmed keys', () => {
    for (const [sound, pattern] of entries) {
      expect(sound).toBe(sound.toLowerCase().trim())
      expect(pattern).toBe(pattern.toLowerCase().trim())
      expect(sound.length).toBeGreaterThan(0)
      expect(pattern.length).toBeGreaterThan(0)
    }
  })

  it('has valid words: lowercase, single token, 1-15 chars, unique within combo', () => {
    for (const [sound, pattern, words] of entries) {
      expect(words.length).toBeGreaterThan(0)
      const seen = new Set<string>()
      for (const word of words) {
        expect(word, `${sound}/${pattern}: "${word}" must be lowercase`).toBe(word.toLowerCase())
        expect(word, `${sound}/${pattern}: "${word}" must have no spaces`).not.toContain(' ')
        expect(word.length, `${sound}/${pattern}: "${word}" length`).toBeGreaterThanOrEqual(1)
        expect(word.length, `${sound}/${pattern}: "${word}" length`).toBeLessThanOrEqual(15)
        expect(seen.has(word), `${sound}/${pattern}: duplicate "${word}"`).toBe(false)
        seen.add(word)
      }
    }
  })

  it('spot-checks known pairs', () => {
    const spotChecks: Array<[string, string, string]> = [
      ['long a', 'a_e', 'cake'],
      ['long a', 'ai', 'rain'],
      ['long a', 'ay', 'day'],
      ['long e', 'ee', 'see'],
      ['long e', 'ea', 'read'],
      ['long i', 'i_e', 'bike'],
      ['long i', 'igh', 'light'],
      ['long o', 'oa', 'boat'],
      ['long o', 'ow', 'snow'],
      ['short a', 'a', 'cat'],
      ['short e', 'e', 'bed'],
      ['short i', 'i', 'pig'],
      ['short o', 'o', 'hot'],
      ['short u', 'u', 'cup'],
      ['sh', 'sh', 'ship'],
      ['ch', 'ch', 'chip'],
      ['th', 'th', 'this'],
      ['ar', 'ar', 'car'],
      ['or', 'or', 'for'],
      ['oo', 'oo', 'moon'],
      ['ck', 'ck', 'back'],
      ['ng', 'ng', 'sing'],
    ]
    for (const [sound, pattern, word] of spotChecks) {
      expect(WORD_SUGGESTIONS[sound]?.[pattern], `missing combo ${sound}/${pattern}`).toBeDefined()
      expect(WORD_SUGGESTIONS[sound][pattern]).toContain(word)
    }
  })
})
