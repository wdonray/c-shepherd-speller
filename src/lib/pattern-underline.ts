/**
 * Pattern underline ranges for the Sort page.
 *
 * When a word is dropped in the correct column, the spelling pattern
 * letters inside the word tile are underlined. This module computes the
 * character ranges to underline for a given word and pattern.
 *
 * Patterns are either contiguous (digraphs/trigraphs like "ee", "dge") or
 * split patterns where "_" marks letters that are not adjacent in the word
 * (like "a_e" in "cake").
 */

/** A character range with an exclusive end, like String.slice. */
export interface UnderlineRange {
  start: number
  end: number
}

/**
 * Compute the character ranges of `word` to underline for `pattern`.
 *
 * Matching is case-insensitive. Contiguous patterns underline the first
 * contiguous substring occurrence. Split patterns (containing "_") underline
 * the first occurrence of the first letter and the final occurrence of the
 * last letter as two separate ranges. Returns an empty array when nothing
 * matches or the inputs are empty.
 */
export function getPatternUnderlineRanges(word: string, pattern: string): UnderlineRange[] {
  const stripped = pattern.replace(/_/g, '').toLowerCase()
  const lowered = word.toLowerCase()

  if (stripped.length === 0 || lowered.length === 0) {
    return []
  }

  if (pattern.includes('_')) {
    const first = stripped[0]
    const last = stripped[stripped.length - 1]
    const firstIndex = lowered.indexOf(first)
    const lastIndex = lowered.lastIndexOf(last)
    if (firstIndex === -1 || lastIndex === -1) {
      return []
    }
    return [
      { start: firstIndex, end: firstIndex + 1 },
      { start: lastIndex, end: lastIndex + 1 },
    ]
  }

  const index = lowered.indexOf(stripped)
  if (index === -1) {
    return []
  }
  return [{ start: index, end: index + stripped.length }]
}
