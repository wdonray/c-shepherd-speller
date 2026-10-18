/**
 * Prebuilt spelling-pattern curriculum lists (issue #463, Phase A).
 *
 * 162 weeks of original, hand-verified word lists across grades K-5,
 * organized by spelling pattern in scope-and-sequence order. The lists are
 * bundled as JSON; this module validates them at load and exposes grade /
 * week lookups plus a WordList adapter for the read-only chart preview.
 */
import { z } from 'zod'
import { PatternFrequencySchema, type SpellingPattern, type WordList } from '@/models/WordList'
import gradeK from '@/data/prebuilt-lists/grade-k.json'
import grade1 from '@/data/prebuilt-lists/grade-1.json'
import grade2 from '@/data/prebuilt-lists/grade-2.json'
import grade3 from '@/data/prebuilt-lists/grade-3.json'
import grade4 from '@/data/prebuilt-lists/grade-4.json'
import grade5 from '@/data/prebuilt-lists/grade-5.json'

/** One prebuilt week: a set of spelling patterns with example words. */
export const PrebuiltWeekSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  grade: z.string().min(1),
  week: z.number().int().positive(),
  source: z.literal('prebuilt'),
  patterns: z
    .array(
      z.object({
        sound: z.string().min(1),
        pattern: z.string().min(1),
        frequency: PatternFrequencySchema,
        words: z.array(z.string().min(1)).min(1),
      })
    )
    .min(1),
})
export type PrebuiltWeek = z.infer<typeof PrebuiltWeekSchema>

/** Grades with prebuilt lists, in display order. */
export const PREBUILT_GRADES = ['k', '1', '2', '3', '4', '5'] as const
export type PrebuiltGrade = (typeof PREBUILT_GRADES)[number]

const GRADE_FILES: Record<PrebuiltGrade, unknown> = {
  k: gradeK,
  '1': grade1,
  '2': grade2,
  '3': grade3,
  '4': grade4,
  '5': grade5,
}

/** Human-readable grade label: "Kindergarten", "Grade 1", ... */
export function prebuiltGradeLabel(grade: string): string {
  return grade === 'k' ? 'Kindergarten' : `Grade ${grade}`
}

function loadGrade(grade: PrebuiltGrade): PrebuiltWeek[] {
  return z.array(PrebuiltWeekSchema).parse(GRADE_FILES[grade])
}

/** All prebuilt weeks for a grade, in week order. */
export function getPrebuiltWeeks(grade: string): PrebuiltWeek[] {
  if (!(PREBUILT_GRADES as readonly string[]).includes(grade)) return []
  return loadGrade(grade as PrebuiltGrade)
}

/** One prebuilt week by its id (e.g. "prebuilt-g2-w06"), or undefined. */
export function getPrebuiltWeek(id: string): PrebuiltWeek | undefined {
  for (const grade of PREBUILT_GRADES) {
    const found = loadGrade(grade).find((week) => week.id === id)
    if (found) return found
  }
  return undefined
}

/**
 * Adapt a prebuilt week to the WordList shape for the read-only chart
 * preview. The preview never persists, so owner and timestamp fields are
 * fixed placeholders.
 */
export function prebuiltWeekToWordList(week: PrebuiltWeek): WordList {
  const patterns: SpellingPattern[] = week.patterns.map((p, index) => ({
    id: `${week.id}-p${index}`,
    sound: p.sound,
    pattern: p.pattern,
    frequency: p.frequency,
    words: p.words,
  }))
  return {
    id: week.id,
    userId: 'prebuilt',
    name: week.title,
    gradeLevel: prebuiltGradeLabel(week.grade),
    week: String(week.week),
    patterns,
    createdAt: 'prebuilt',
    updatedAt: 'prebuilt',
  }
}
