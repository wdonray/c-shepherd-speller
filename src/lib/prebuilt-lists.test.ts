import { describe, expect, it } from 'vitest'
import {
  PREBUILT_GRADES,
  getPrebuiltWeek,
  getPrebuiltWeeks,
  prebuiltGradeLabel,
  prebuiltWeekToWordList,
} from './prebuilt-lists'

describe('prebuilt-lists', () => {
  it('exposes six grades in display order', () => {
    expect([...PREBUILT_GRADES]).toEqual(['k', '1', '2', '3', '4', '5'])
  })

  it('labels kindergarten and numbered grades', () => {
    expect(prebuiltGradeLabel('k')).toBe('Kindergarten')
    expect(prebuiltGradeLabel('3')).toBe('Grade 3')
  })

  it('returns weeks in order for each grade', () => {
    for (const grade of PREBUILT_GRADES) {
      const weeks = getPrebuiltWeeks(grade)
      expect(weeks.length).toBeGreaterThan(0)
      const numbers = weeks.map((w) => w.week)
      expect([...numbers].sort((a, b) => a - b)).toEqual(numbers)
      for (const week of weeks) {
        expect(week.source).toBe('prebuilt')
        expect(week.grade).toBe(grade)
        for (const pattern of week.patterns) {
          expect(pattern.words.length).toBeGreaterThan(0)
        }
      }
    }
  })

  it('returns an empty array for an unknown grade', () => {
    expect(getPrebuiltWeeks('9')).toEqual([])
    expect(getPrebuiltWeeks('')).toEqual([])
  })

  it('finds a week by id across grades', () => {
    const week = getPrebuiltWeek('prebuilt-g2-w06')
    expect(week?.title).toBe('Grade 2 - Week 6')
    expect(week?.grade).toBe('2')
  })

  it('returns undefined for an unknown id', () => {
    expect(getPrebuiltWeek('prebuilt-g9-w99')).toBeUndefined()
    expect(getPrebuiltWeek('')).toBeUndefined()
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
})
