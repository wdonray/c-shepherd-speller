import { describe, expect, it } from 'vitest'
import { getPatternUnderlineRanges } from './pattern-underline'

describe('getPatternUnderlineRanges', () => {
  describe('contiguous patterns', () => {
    it('underlines a digraph in the middle of a word', () => {
      expect(getPatternUnderlineRanges('see', 'ee')).toEqual([{ start: 1, end: 3 }])
    })

    it('underlines a digraph at the start of a word', () => {
      expect(getPatternUnderlineRanges('rain', 'ai')).toEqual([{ start: 1, end: 3 }])
    })

    it('underlines a trigraph', () => {
      expect(getPatternUnderlineRanges('badge', 'dge')).toEqual([{ start: 2, end: 5 }])
    })

    it('underlines the first occurrence when the pattern appears twice', () => {
      expect(getPatternUnderlineRanges('eee', 'ee')).toEqual([{ start: 0, end: 2 }])
    })

    it('underlines a single-letter pattern', () => {
      expect(getPatternUnderlineRanges('cake', 'a')).toEqual([{ start: 1, end: 2 }])
    })

    it('matches case-insensitively', () => {
      expect(getPatternUnderlineRanges('SEE', 'ee')).toEqual([{ start: 1, end: 3 }])
      expect(getPatternUnderlineRanges('see', 'EE')).toEqual([{ start: 1, end: 3 }])
    })
  })

  describe('split patterns', () => {
    it('underlines the first occurrence of the first letter and the final occurrence of the last letter', () => {
      expect(getPatternUnderlineRanges('cake', 'a_e')).toEqual([
        { start: 1, end: 2 },
        { start: 3, end: 4 },
      ])
    })

    it('uses the final occurrence of the last letter, not the first', () => {
      // "beef": the last "e" is at index 2, not index 1.
      expect(getPatternUnderlineRanges('beef', 'e_e')).toEqual([
        { start: 1, end: 2 },
        { start: 2, end: 3 },
      ])
    })

    it('uses the first occurrence of the first letter when it appears multiple times', () => {
      // "banana": the first "a" is at index 1.
      expect(getPatternUnderlineRanges('banana', 'a_a')).toEqual([
        { start: 1, end: 2 },
        { start: 5, end: 6 },
      ])
    })

    it('matches case-insensitively', () => {
      expect(getPatternUnderlineRanges('CAKE', 'a_e')).toEqual([
        { start: 1, end: 2 },
        { start: 3, end: 4 },
      ])
      expect(getPatternUnderlineRanges('cake', 'A_E')).toEqual([
        { start: 1, end: 2 },
        { start: 3, end: 4 },
      ])
    })
  })

  describe('no match (defensive)', () => {
    it('returns an empty array for a contiguous pattern not in the word', () => {
      expect(getPatternUnderlineRanges('cat', 'ee')).toEqual([])
    })

    it('returns an empty array when the first letter of a split pattern is missing', () => {
      expect(getPatternUnderlineRanges('see', 'a_e')).toEqual([])
    })

    it('returns an empty array when the last letter of a split pattern is missing', () => {
      expect(getPatternUnderlineRanges('cat', 'a_e')).toEqual([])
    })

    it('returns an empty array when the split pattern letters are out of order', () => {
      // 'each' contains 'a' after 'e'; reversed ranges would garble the render.
      expect(getPatternUnderlineRanges('each', 'a_e')).toEqual([])
    })

    it('returns an empty array for an empty word', () => {
      expect(getPatternUnderlineRanges('', 'ee')).toEqual([])
      expect(getPatternUnderlineRanges('', 'a_e')).toEqual([])
    })

    it('returns an empty array for an empty pattern', () => {
      expect(getPatternUnderlineRanges('see', '')).toEqual([])
    })
  })
})
