/**
 * Prebuilt spelling-pattern curriculum lists (issue #463, Phase A; #506 adds
 * the UFLI sequence set).
 *
 * Two sets of original, hand-verified word lists, organized by spelling
 * pattern in scope-and-sequence order:
 * - "standard": 162 weeks across grades K-5, one standard phonics progression.
 * - "ufli": 90 weeks across grades K-3, created to align with UFLI's published
 *   scope and sequence (original word lists authored for this task; only the
 *   lesson order is followed, which UFLI's copyright page expressly invites).
 *   Never transcribe UFLI's own word lists here.
 *
 * The lists are bundled as JSON; this module validates them at load and
 * exposes set / grade / week lookups plus a WordList adapter for the
 * read-only chart preview.
 */
import { z } from 'zod'
import { PatternFrequencySchema, type SpellingPattern, type WordList } from '@/models/WordList'
import gradeK from '@/data/prebuilt-lists/grade-k.json'
import grade1 from '@/data/prebuilt-lists/grade-1.json'
import grade2 from '@/data/prebuilt-lists/grade-2.json'
import grade3 from '@/data/prebuilt-lists/grade-3.json'
import grade4 from '@/data/prebuilt-lists/grade-4.json'
import grade5 from '@/data/prebuilt-lists/grade-5.json'
import ufliGradeK from '@/data/prebuilt-lists/ufli-grade-k.json'
import ufliGrade1 from '@/data/prebuilt-lists/ufli-grade-1.json'
import ufliGrade2 from '@/data/prebuilt-lists/ufli-grade-2.json'
import ufliGrade3 from '@/data/prebuilt-lists/ufli-grade-3.json'

/** One prebuilt week: a set of spelling patterns with example words. */
export const PrebuiltWeekSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  grade: z.string().min(1),
  week: z.number().int().positive(),
  source: z.literal('prebuilt'),
  /** UFLI lesson range this week corresponds to (UFLI set only), e.g. "Lessons 42-46". */
  lessons: z.string().min(1).optional(),
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
type PrebuiltWeekData = z.infer<typeof PrebuiltWeekSchema>

/** Ready-made list sets, in display order. */
export const PREBUILT_SET_IDS = ['standard', 'ufli'] as const
export type PrebuiltSetId = (typeof PREBUILT_SET_IDS)[number]

/** Display label for each set's selector option. */
export const PREBUILT_SET_LABEL: Record<PrebuiltSetId, string> = {
  standard: 'Standard sequence',
  ufli: 'UFLI sequence',
}

/** Short description shown under the library heading for each set. */
export const PREBUILT_SET_DESCRIPTION: Record<PrebuiltSetId, string> = {
  standard:
    '162 weeks of ready-made spelling lists for grades K through 5, in a standard phonics sequence. Search by pattern or pick a grade, preview a week, then make it your own.',
  ufli: "90 weeks of ready-made spelling lists for grades K through 3, created to align with UFLI's scope and sequence. Search by pattern or pick a grade, preview a week, then make it your own.",
}

/**
 * Non-endorsement disclaimer for the UFLI set (issue #506). UFLI's copyright
 * page asks that aligned original materials state they were not created by
 * nor endorsed by UFLI, and to say "created to align with UFLI's scope and
 * sequence" rather than "UFLI-aligned".
 */
export const UFLI_DISCLAIMER =
  "These lists are original PatternSpell content, created to align with UFLI's published scope and sequence. Not created by, affiliated with, or endorsed by the University of Florida Literacy Institute."

/** Grades with prebuilt lists, in display order. */
export const PREBUILT_GRADES = ['k', '1', '2', '3', '4', '5'] as const
export type PrebuiltGrade = (typeof PREBUILT_GRADES)[number]

/** Grades each set covers. UFLI Foundations is a K-2 program; its advanced
 * low-frequency and affix lessons (111-128) are offered here as Grade 3. */
export const PREBUILT_SET_GRADES: Record<PrebuiltSetId, readonly PrebuiltGrade[]> = {
  standard: PREBUILT_GRADES,
  ufli: ['k', '1', '2', '3'],
}

/** A prebuilt week stamped with the set it belongs to (stamped at load; the
 * JSON files carry no set field). */
export type PrebuiltWeek = PrebuiltWeekData & { set: PrebuiltSetId }

const SET_GRADE_FILES: Record<PrebuiltSetId, Partial<Record<PrebuiltGrade, unknown>>> = {
  standard: { k: gradeK, '1': grade1, '2': grade2, '3': grade3, '4': grade4, '5': grade5 },
  ufli: { k: ufliGradeK, '1': ufliGrade1, '2': ufliGrade2, '3': ufliGrade3 },
}

/** Human-readable grade label: "Kindergarten", "Grade 1", ... */
export function prebuiltGradeLabel(grade: string): string {
  return grade === 'k' ? 'Kindergarten' : `Grade ${grade}`
}

/**
 * Grade files are object-rooted (`{ "weeks": [...] }`), matching the
 * fallback-sentences.json precedent: vite emits named exports for object
 * keys, which is what the v8 coverage provider needs to attribute the
 * import (array-rooted JSON reports 0% even when fully exercised).
 */
const PrebuiltGradeFileSchema = z.object({ weeks: z.array(PrebuiltWeekSchema) })

function loadGrade(setId: PrebuiltSetId, grade: string): PrebuiltWeek[] {
  const file: unknown = SET_GRADE_FILES[setId][grade as PrebuiltGrade]
  if (!file) return []
  return PrebuiltGradeFileSchema.parse(file).weeks.map((week) => ({ ...week, set: setId }))
}

/** All prebuilt weeks for a set and grade, in week order. */
export function getPrebuiltWeeks(setId: PrebuiltSetId, grade: string): PrebuiltWeek[] {
  if (!PREBUILT_SET_IDS.includes(setId)) return []
  return loadGrade(setId, grade)
}

/** One prebuilt week by its id (e.g. "prebuilt-g2-w06", "ufli-g1-w03"), searching all sets. */
export function getPrebuiltWeek(id: string): PrebuiltWeek | undefined {
  for (const setId of PREBUILT_SET_IDS) {
    for (const grade of PREBUILT_SET_GRADES[setId]) {
      const found = loadGrade(setId, grade).find((week) => week.id === id)
      if (found) return found
    }
  }
  return undefined
}

/**
 * Grade to show when switching to a set: keep the current grade when the set
 * covers it, otherwise fall back to the set's first grade.
 */
export function gradeForSet(setId: PrebuiltSetId, grade: string): PrebuiltGrade {
  const grades = PREBUILT_SET_GRADES[setId]
  return (grades as readonly string[]).includes(grade) ? (grade as PrebuiltGrade) : grades[0]
}

/**
 * Adapt a prebuilt week to the WordList shape for the read-only chart
 * preview. The preview never persists, so owner and timestamp fields are
 * fixed placeholders.
 */
export function prebuiltWeekToWordList(week: PrebuiltWeekData): WordList {
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
