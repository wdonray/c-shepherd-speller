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
 * Curated map of common spelling patterns to sound type.
 *
 * Built from standard K-3 phonics scope-and-sequence lists. The map wins over
 * the letter-based heuristic below: it captures the consonant spellings that
 * contain vowel letters (qu, dge, soft c/g) which a naive letter check
 * misreads as vowels.
 *
 * Keys are lowercased with underscores stripped (so "a_e" is stored as "ae").
 */
const PATTERN_SOUND_TYPE: Record<string, SoundType> = {
  // Single letters
  a: 'vowel',
  b: 'consonant',
  c: 'consonant',
  d: 'consonant',
  e: 'vowel',
  f: 'consonant',
  g: 'consonant',
  h: 'consonant',
  i: 'vowel',
  j: 'consonant',
  k: 'consonant',
  l: 'consonant',
  m: 'consonant',
  n: 'consonant',
  o: 'vowel',
  p: 'consonant',
  q: 'consonant',
  r: 'consonant',
  s: 'consonant',
  t: 'consonant',
  u: 'vowel',
  v: 'consonant',
  w: 'consonant',
  x: 'consonant',
  y: 'vowel', // lone y as a vowel (funny, sky)
  z: 'consonant',
  // Consonant digraphs / trigraphs
  sh: 'consonant',
  ch: 'consonant',
  th: 'consonant',
  wh: 'consonant',
  ph: 'consonant',
  ck: 'consonant',
  tch: 'consonant',
  ng: 'consonant',
  nk: 'consonant',
  dge: 'consonant',
  qu: 'consonant',
  // Soft c / soft g
  ce: 'consonant',
  ci: 'consonant',
  cy: 'consonant',
  ge: 'consonant',
  gi: 'consonant',
  gy: 'consonant',
  // Vowel teams
  ai: 'vowel',
  ay: 'vowel',
  ee: 'vowel',
  ea: 'vowel',
  igh: 'vowel',
  ie: 'vowel',
  oa: 'vowel',
  oe: 'vowel',
  oo: 'vowel',
  ew: 'vowel',
  ue: 'vowel',
  ui: 'vowel',
  ow: 'vowel',
  oy: 'vowel',
  oi: 'vowel',
  ou: 'vowel',
  ey: 'vowel',
  ei: 'vowel',
  eigh: 'vowel',
  // Vowel-consonant-e (underscores stripped: "a_e" -> "ae")
  ae: 'vowel',
  // Bossy R
  ar: 'bossyR',
  er: 'bossyR',
  ir: 'bossyR',
  or: 'bossyR',
  ur: 'bossyR',
  air: 'bossyR',
  ear: 'bossyR',
  are: 'bossyR',
  ore: 'bossyR',
  ere: 'bossyR',
  ire: 'bossyR',
}

/**
 * Classify a spelling pattern by sound type from the pattern text.
 *
 * The curated map above is checked first; anything unlisted (custom teacher
 * patterns) falls back to a simple letter-based heuristic (lowercased,
 * underscores stripped):
 * - bossyR: contains a vowel letter AND 'r' (a lone "r" is a consonant).
 * - vowel: contains a vowel letter (a/e/i/o/u); a lone "y" counts as a vowel.
 * - consonant: everything else.
 */
export function getSoundType(pattern: string): SoundType {
  const p = pattern.toLowerCase().replace(/_/g, '')
  const mapped = PATTERN_SOUND_TYPE[p]
  if (mapped !== undefined) return mapped
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
