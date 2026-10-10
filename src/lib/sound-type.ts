/**
 * Sound-type classification for spelling patterns.
 *
 * Teachers color-code chart columns by sound type: vowel sounds green,
 * consonants red, bossy R blue. Frequency is shown by the power-bar length
 * only, never by color.
 *
 * The type is determined from the spelling pattern text itself (per the
 * teacher's direction), not from the list's free-text sound name.
 */

export type SoundType = 'vowel' | 'consonant' | 'bossyR'

/**
 * Classify a spelling pattern by sound type from the pattern text.
 *
 * Heuristic (lowercased, underscores stripped):
 * - bossyR: contains a vowel letter AND 'r' (ar, er, ir, or, ur, air, ear).
 *   A lone "r" is a consonant.
 * - vowel: contains a vowel letter (a/e/i/o/u). A lone "y" counts as a vowel
 *   (as in "funny" / "sky" for long e).
 * - consonant: everything else (sh, ch, th, ck, single consonants, lone "r").
 *
 * Known limitation: silent-e markers read as vowels (dge, ge). The rule is
 * deliberately simple and predictable rather than clever.
 */
export function getSoundType(pattern: string): SoundType {
  const p = pattern.toLowerCase().replace(/_/g, '')
  const hasVowel = /[aeiou]/.test(p)
  if (hasVowel && p.includes('r')) return 'bossyR'
  if (hasVowel || p === 'y') return 'vowel'
  return 'consonant'
}

/**
 * Column border color by sound type: vowels green, consonants red,
 * bossy R blue.
 */
export const SOUND_TYPE_BORDER: Record<SoundType, string> = {
  vowel: 'border-leaf',
  consonant: 'border-coral',
  bossyR: 'border-sky',
}
