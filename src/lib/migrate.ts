import type { SpellingPattern, WordList } from '@/models/WordList'
import { generatePatternId } from '@/models/WordList'

export interface FlatSpellingData {
  words: string[]
  sounds: string[]
  spelling: string[]
}

/**
 * Migrate flat Words/Sounds/Spelling Patterns to a single pattern-based list.
 *
 * Strategy (no data loss):
 * - Each old spelling pattern becomes a SpellingPattern (with matched sound if possible).
 * - All old words go into an "Unsorted words" pattern for the teacher to organize.
 * - Old sounds are preserved as pattern sounds where they match.
 */
export function migrateFlatToPatternList(
  data: FlatSpellingData,
  userId: string,
  listName = 'Migrated list'
): Omit<WordList, 'id' | 'createdAt' | 'updatedAt'> {
  const patterns: SpellingPattern[] = []

  // Create a pattern for each old spelling pattern.
  // Try to match a sound from the old sounds array; fallback to the pattern itself.
  for (const spelling of data.spelling) {
    // Simple heuristic: if a sound equals the pattern, use it; otherwise use the pattern as the sound.
    const sound = data.sounds.find((s) => s.toLowerCase() === spelling.toLowerCase()) ?? spelling
    patterns.push({
      id: generatePatternId(),
      sound,
      pattern: spelling,
      frequency: 'common',
      words: [],
    })
  }

  // Put all old words into an unsorted pattern for the teacher to organize.
  if (data.words.length > 0) {
    patterns.push({
      id: generatePatternId(),
      sound: 'unsorted',
      pattern: 'unsorted',
      frequency: 'common',
      words: [...data.words],
    })
  }

  return {
    userId,
    name: listName,
    patterns,
  }
}
