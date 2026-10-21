import { describe, expect, it } from 'vitest'
import {
  PREBUILT_GRADES,
  PREBUILT_SET_DESCRIPTION,
  PREBUILT_SET_GRADES,
  PREBUILT_SET_IDS,
  PREBUILT_SET_LABEL,
  UFLI_DISCLAIMER,
  getPrebuiltWeek,
  getPrebuiltWeeks,
  gradeForSet,
  prebuiltGradeLabel,
  prebuiltWeekToWordList,
  type PrebuiltSetId,
} from './prebuilt-lists'

describe('prebuilt-lists', () => {
  it('exposes the two sets in display order with labels and descriptions', () => {
    expect([...PREBUILT_SET_IDS]).toEqual(['standard', 'ufli'])
    expect(PREBUILT_SET_LABEL.standard).toBe('Standard sequence')
    expect(PREBUILT_SET_LABEL.ufli).toBe('UFLI sequence')
    expect(PREBUILT_SET_DESCRIPTION.standard).toContain('162 weeks')
    expect(PREBUILT_SET_DESCRIPTION.ufli).toContain('90 weeks')
  })

  it('exposes six grades for the standard set and four for the UFLI set', () => {
    expect([...PREBUILT_GRADES]).toEqual(['k', '1', '2', '3', '4', '5'])
    expect([...PREBUILT_SET_GRADES.standard]).toEqual(['k', '1', '2', '3', '4', '5'])
    expect([...PREBUILT_SET_GRADES.ufli]).toEqual(['k', '1', '2', '3'])
  })

  it('carries the UFLI non-endorsement disclaimer wording', () => {
    expect(UFLI_DISCLAIMER).toContain("created to align with UFLI's published scope and sequence")
    expect(UFLI_DISCLAIMER).toContain('Not created by, affiliated with, or endorsed by')
    expect(UFLI_DISCLAIMER).not.toContain('UFLI-aligned')
  })

  it('labels kindergarten and numbered grades', () => {
    expect(prebuiltGradeLabel('k')).toBe('Kindergarten')
    expect(prebuiltGradeLabel('3')).toBe('Grade 3')
  })

  it('returns weeks in order for each set and grade, stamped with the set', () => {
    const counts: Record<PrebuiltSetId, number> = { standard: 0, ufli: 0 }
    for (const setId of PREBUILT_SET_IDS) {
      for (const grade of PREBUILT_SET_GRADES[setId]) {
        const weeks = getPrebuiltWeeks(setId, grade)
        expect(weeks.length).toBeGreaterThan(0)
        counts[setId] += weeks.length
        const numbers = weeks.map((w) => w.week)
        expect([...numbers].sort((a, b) => a - b)).toEqual(numbers)
        for (const week of weeks) {
          expect(week.set).toBe(setId)
          expect(week.source).toBe('prebuilt')
          expect(week.grade).toBe(grade)
          for (const pattern of week.patterns) {
            expect(pattern.words.length).toBeGreaterThan(0)
          }
        }
      }
    }
    expect(counts.standard).toBe(162)
    expect(counts.ufli).toBe(90)
  })

  it('gives every UFLI week a lesson range and a UFLI-titled name', () => {
    for (const grade of PREBUILT_SET_GRADES.ufli) {
      for (const week of getPrebuiltWeeks('ufli', grade)) {
        expect(week.lessons).toMatch(/^Lessons? /)
        expect(week.title.startsWith('UFLI ')).toBe(true)
      }
    }
    const standardWeek = getPrebuiltWeeks('standard', '1')[0]
    expect(standardWeek.lessons).toBeUndefined()
    expect(standardWeek.title.startsWith('UFLI ')).toBe(false)
  })

  it('returns an empty array for an unknown set, grade, or set-grade mismatch', () => {
    expect(getPrebuiltWeeks('nope' as PrebuiltSetId, '1')).toEqual([])
    expect(getPrebuiltWeeks('standard', '9')).toEqual([])
    expect(getPrebuiltWeeks('standard', '')).toEqual([])
    expect(getPrebuiltWeeks('ufli', '4')).toEqual([])
    expect(getPrebuiltWeeks('ufli', '5')).toEqual([])
  })

  it('finds a week by id across grades and sets', () => {
    const standard = getPrebuiltWeek('prebuilt-g2-w06')
    expect(standard?.title).toBe('Grade 2 - Week 6')
    expect(standard?.grade).toBe('2')
    expect(standard?.set).toBe('standard')
    const ufli = getPrebuiltWeek('ufli-g1-w03')
    expect(ufli?.title).toBe('UFLI Grade 1 - Week 3')
    expect(ufli?.grade).toBe('1')
    expect(ufli?.set).toBe('ufli')
    expect(ufli?.lessons).toBe('Lessons 46-47')
  })

  it('returns undefined for an unknown id', () => {
    expect(getPrebuiltWeek('prebuilt-g9-w99')).toBeUndefined()
    expect(getPrebuiltWeek('ufli-g9-w99')).toBeUndefined()
    expect(getPrebuiltWeek('')).toBeUndefined()
  })

  it('keeps the grade when the set covers it, else falls back to the first grade', () => {
    expect(gradeForSet('standard', '2')).toBe('2')
    expect(gradeForSet('ufli', '2')).toBe('2')
    expect(gradeForSet('ufli', '5')).toBe('k')
    expect(gradeForSet('ufli', '')).toBe('k')
  })

  it('adapts a week to the WordList shape for preview', () => {
    const week = getPrebuiltWeek('prebuilt-g1-w01')
    expect(week).toBeDefined()
    const list = prebuiltWeekToWordList(week!)
    expect(list.id).toBe(week!.id)
    expect(list.name).toBe(week!.title)
    expect(list.gradeLevel).toBe('Grade 1')
    expect(list.patterns).toHaveLength(week!.patterns.length)
    expect(list.patterns[0].words).toEqual(week!.patterns[0].words)
    expect(list.patterns[0].id).toContain(week!.id)
  })

  it('adapts a kindergarten week with the right grade label', () => {
    const week = getPrebuiltWeek('prebuilt-gk-w01')
    expect(week).toBeDefined()
    expect(prebuiltWeekToWordList(week!).gradeLevel).toBe('Kindergarten')
  })

  it('adapts a UFLI week to the WordList shape for preview', () => {
    const week = getPrebuiltWeek('ufli-g2-w07')
    expect(week).toBeDefined()
    const list = prebuiltWeekToWordList(week!)
    expect(list.name).toBe('UFLI Grade 2 - Week 7')
    expect(list.gradeLevel).toBe('Grade 2')
  })
})
