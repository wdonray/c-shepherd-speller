import { describe, it, expect } from 'vitest'
import { FeedbackSchema, FeedbackTypeSchema, FEEDBACK_TYPE_LABELS } from './Feedback'

describe('FeedbackTypeSchema', () => {
  it('accepts issue and feature', () => {
    expect(FeedbackTypeSchema.safeParse('issue').success).toBe(true)
    expect(FeedbackTypeSchema.safeParse('feature').success).toBe(true)
  })

  it('rejects anything else', () => {
    expect(FeedbackTypeSchema.safeParse('praise').success).toBe(false)
  })
})

describe('FeedbackSchema', () => {
  const valid = {
    type: 'issue',
    subject: 'Print button is broken',
    details: 'Clicking print on the list page does nothing at all.',
  }

  it('accepts a valid payload and trims whitespace', () => {
    const parsed = FeedbackSchema.safeParse({ ...valid, subject: '  Padded subject  ' })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.subject).toBe('Padded subject')
  })

  it('rejects a missing type', () => {
    expect(FeedbackSchema.safeParse({ ...valid, type: undefined }).success).toBe(false)
  })

  it('rejects a too-short subject', () => {
    const parsed = FeedbackSchema.safeParse({ ...valid, subject: 'ab' })
    expect(parsed.success).toBe(false)
  })

  it('rejects an overlong subject', () => {
    const parsed = FeedbackSchema.safeParse({ ...valid, subject: 'x'.repeat(121) })
    expect(parsed.success).toBe(false)
  })

  it('rejects too-short details', () => {
    const parsed = FeedbackSchema.safeParse({ ...valid, details: 'too short' })
    expect(parsed.success).toBe(false)
  })

  it('rejects overlong details', () => {
    const parsed = FeedbackSchema.safeParse({ ...valid, details: 'x'.repeat(5001) })
    expect(parsed.success).toBe(false)
  })
})

describe('FEEDBACK_TYPE_LABELS', () => {
  it('labels both types', () => {
    expect(FEEDBACK_TYPE_LABELS.issue).toBe('Report an issue')
    expect(FEEDBACK_TYPE_LABELS.feature).toBe('Request a feature')
  })
})
