/**
 * Pattern-based word list model for PatternSpell.
 *
 * A WordList organizes spelling instruction around a target sound, with words
 * grouped by the spelling pattern that represents that sound. This mirrors the
 * CKLA pattern-chart structure teachers already know: target sound first,
 * then spelling patterns as columns (sized by frequency), odd ducks = irregulars.
 *
 * Research basis: explicit pattern-based instruction (Graham & Santangelo 2014),
 * morphology transfer (Colenbrander et al. 2025), orthographic mapping (Ehri).
 */

import { z } from 'zod'

/** How common a spelling pattern is for its sound (the "power bar"). */
export const PatternFrequencySchema = z.enum(['common', 'less-common', 'rare'])
export type PatternFrequency = z.infer<typeof PatternFrequencySchema>

/** One spelling pattern within a list (one column of the pattern chart). */
export const SpellingPatternSchema = z.object({
  id: z.string().min(1),
  /** Target sound, e.g. "/ā/" or "long a" */
  sound: z.string().min(1).max(50),
  /** The spelling pattern, e.g. "a_e", "ai", "ay" */
  pattern: z.string().min(1).max(20),
  /** Frequency indicator (power bar) */
  frequency: PatternFrequencySchema,
  /** Words using this pattern, e.g. ["cake", "bake", "late"] */
  words: z.array(z.string().min(1).max(50)).max(200),
  /** True for the irregular "odd ducks" section */
  isOddDuck: z.boolean().optional(),
  /** True when the teacher has locked this pattern; hidden until taught */
  isLocked: z.boolean().optional(),
  /** Teacher-picked keyword anchor emoji, e.g. bee for "ee" */
  keywordEmoji: z.string().min(1).max(20).optional(),
  /** Teacher-picked example sentences, keyed by word */
  sentences: z.record(z.string().min(1).max(50), z.string().min(1).max(300)).optional(),
})
export type SpellingPattern = z.infer<typeof SpellingPatternSchema>

/** A teacher's pattern-based spelling list. */
export const WordListSchema = z.object({
  id: z.string().min(1),
  /** Owner's database user ID (from c-shepherd-users) */
  userId: z.string().min(1),
  /** Display name, e.g. "Week 5: Long A" */
  name: z.string().min(1).max(100),
  gradeLevel: z.string().max(20).optional(),
  patterns: z.array(SpellingPatternSchema).max(20),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type WordList = z.infer<typeof WordListSchema>

/** Payload for creating a list (server fills in id, userId, timestamps). */
export const CreateWordListSchema = z.object({
  name: z.string().min(1).max(100),
  gradeLevel: z.string().max(20).optional(),
  patterns: z
    .array(SpellingPatternSchema.omit({ id: true }))
    .max(20)
    .default([]),
})
export type CreateWordListInput = z.infer<typeof CreateWordListSchema>

/** Payload for updating a list. All fields optional except none required. */
export const UpdateWordListSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  gradeLevel: z.string().max(20).optional(),
  patterns: z.array(SpellingPatternSchema).max(20).optional(),
})
export type UpdateWordListInput = z.infer<typeof UpdateWordListSchema>

/** Payload for creating a pattern within a list (server fills in id). */
export const CreatePatternSchema = SpellingPatternSchema.omit({ id: true })
export type CreatePatternInput = z.infer<typeof CreatePatternSchema>

export const LISTS_TABLE_NAME = process.env.LISTS_TABLE_NAME || 'shepherd-speller-lists'

/** DynamoDB key for a list item: one item per list. */
export function getListKeys(userId: string, listId: string) {
  return {
    PK: `USER#${userId}`,
    SK: `LIST#${listId}`,
  }
}

/** Generate a unique list ID. */
export function generateListId(): string {
  return `list_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/** Generate a unique pattern ID. */
export function generatePatternId(): string {
  return `pat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

/** Build a new WordList from user input, filling in server-generated fields. */
export function createWordListItem(userId: string, input: CreateWordListInput): WordList {
  const now = new Date().toISOString()
  return {
    id: generateListId(),
    userId,
    name: input.name,
    gradeLevel: input.gradeLevel,
    patterns: input.patterns.map((p) => ({ ...p, id: generatePatternId() })),
    createdAt: now,
    updatedAt: now,
  }
}

/** Apply an update to a list, refreshing updatedAt. */
export function updateWordListItem(list: WordList, input: UpdateWordListInput): WordList {
  return {
    ...list,
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.gradeLevel !== undefined ? { gradeLevel: input.gradeLevel } : {}),
    ...(input.patterns !== undefined ? { patterns: input.patterns } : {}),
    updatedAt: new Date().toISOString(),
  }
}
