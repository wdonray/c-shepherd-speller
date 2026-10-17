/**
 * Our own dictionary of example sentences for common spelling words.
 * Used when the Free Dictionary API has no example or is unreachable.
 * The sentences live in the JSON file so the bank can grow without
 * touching code; every entry is short and age-appropriate.
 */
import fallbackDictionary from './fallback-sentences.json'

export const FALLBACK_SENTENCES: Record<string, string[]> = fallbackDictionary as Record<string, string[]>
