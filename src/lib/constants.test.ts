import { describe, it, expect } from 'vitest'
import { UserDataType } from './constants'

describe('UserDataType', () => {
  it('has the expected values', () => {
    expect(UserDataType.WORDS).toBe('words')
    expect(UserDataType.SOUNDS).toBe('sounds')
    expect(UserDataType.SPELLING).toBe('spelling')
  })
})
