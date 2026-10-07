import { describe, it, expect } from 'vitest'
import { sanitizeFilename, buildExportFilename } from './export-filename'

describe('sanitizeFilename', () => {
  it('lowercases and converts spaces to hyphens', () => {
    expect(sanitizeFilename('Week 5 Spelling')).toBe('week-5-spelling')
  })

  it('strips characters outside [a-z0-9-_]', () => {
    expect(sanitizeFilename('List: "Spring!" (2026)')).toBe('list-spring-2026')
  })

  it('collapses repeated hyphens and underscores', () => {
    expect(sanitizeFilename('a -- b__c')).toBe('a-b-c')
  })

  it('trims leading and trailing hyphens', () => {
    expect(sanitizeFilename('  --hello--  ')).toBe('hello')
  })

  it('keeps underscores and numbers', () => {
    expect(sanitizeFilename('unit_3 review')).toBe('unit_3-review')
  })

  it('returns an empty string for input with no valid characters', () => {
    expect(sanitizeFilename('!!!')).toBe('')
  })
})

describe('buildExportFilename', () => {
  it('builds a dated patternspell filename', () => {
    const date = new Date('2026-10-06T12:00:00.000Z')
    expect(buildExportFilename(date)).toBe('patternspell-lists-2026-10-06.json')
  })

  it('never contains the old product name', () => {
    const name = buildExportFilename()
    expect(name).not.toContain('shepherd')
    expect(name).not.toContain('shepard')
    expect(name).toMatch(/^patternspell-lists-\d{4}-\d{2}-\d{2}\.json$/)
  })
})
