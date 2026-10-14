import { getPatternUnderlineRanges } from './pattern-underline'

/**
 * Heuristic check: does a word's spelling look like it fits a spelling
 * pattern? Used when a teacher adds a word to a pattern, to warn (not block)
 * when the word appears not to contain the pattern.
 *
 * Matching follows the same notion the sort page uses to underline patterns
 * in word tiles (see pattern-underline.ts): contiguous patterns like "ee"
 * match as substrings, split patterns like "a_e" match when the first letter
 * appears before the last letter. Matching is case-insensitive.
 *
 * This is a heuristic, not proof: it cannot catch subtle cases like "have"
 * under "a_e", so callers must warn but still allow the save.
 */
export function wordMatchesPattern(word: string, pattern: string): boolean {
  // No pattern typed yet: nothing to validate against, so do not warn.
  if (pattern.trim() === '') {
    return true
  }
  return getPatternUnderlineRanges(word, pattern).length > 0
}
