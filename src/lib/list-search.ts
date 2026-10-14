/**
 * Search across the teacher's spelling lists (issue #275).
 *
 * Matches against the list name, week, grade level, pattern spellings,
 * pattern sounds, and words. Matching is case-insensitive substring.
 */

import type { WordList } from '@/models/WordList'

/** A slice of text, flagged when it matches the query (for bolding). */
export interface TextSegment {
  text: string
  match: boolean
}

/**
 * Split `text` into matching/non-matching segments for the query.
 * Case-insensitive; returns a single non-matching segment when the query
 * is empty or not found.
 */
export function getMatchSegments(text: string, query: string): TextSegment[] {
  const q = query.trim().toLowerCase()
  if (!q) return [{ text, match: false }]
  const lower = text.toLowerCase()
  const segments: TextSegment[] = []
  let i = 0
  while (i < text.length) {
    const idx = lower.indexOf(q, i)
    if (idx === -1) {
      segments.push({ text: text.slice(i), match: false })
      break
    }
    if (idx > i) segments.push({ text: text.slice(i, idx), match: false })
    segments.push({ text: text.slice(idx, idx + q.length), match: true })
    i = idx + q.length
  }
  return segments
}

/** All searchable text for a list. */
function searchableText(list: WordList): string {
  const parts = [list.name, list.week ?? '', list.gradeLevel ? `Grade ${list.gradeLevel}` : '']
  for (const pattern of list.patterns) {
    parts.push(pattern.sound, pattern.pattern, ...pattern.words)
  }
  return parts.join(' ').toLowerCase()
}

/**
 * Filter lists to those matching the query. An empty query matches
 * everything (the caller hides the search UI in that case).
 */
export function searchLists(lists: WordList[], query: string): WordList[] {
  const q = query.trim().toLowerCase()
  if (!q) return lists
  return lists.filter((list) => searchableText(list).includes(q))
}
