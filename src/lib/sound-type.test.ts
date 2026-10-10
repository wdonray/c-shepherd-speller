import { describe, it, expect } from 'vitest'
import { getSoundType, SOUND_TYPE_BORDER } from './sound-type'

describe('getSoundType', () => {
  describe('vowels', () => {
    it.each([
      'a',
      'e',
      'i',
      'o',
      'u',
      'ee',
      'ea',
      'ai',
      'ay',
      'oa',
      'oo',
      'igh',
      'ow',
      'oy',
      'a_e',
      'i_e',
      'o_e',
      'u_e',
      'ue',
    ])('classifies %s as a vowel', (pattern) => {
      expect(getSoundType(pattern)).toBe('vowel')
    })

    it('classifies a lone y as a vowel (funny, sky)', () => {
      expect(getSoundType('y')).toBe('vowel')
    })

    it('is case-insensitive', () => {
      expect(getSoundType('EE')).toBe('vowel')
      expect(getSoundType('A_E')).toBe('vowel')
    })
  })

  describe('bossy R', () => {
    it.each(['ar', 'er', 'ir', 'or', 'ur', 'air', 'ear', 'are', 'ore'])('classifies %s as bossy R', (pattern) => {
      expect(getSoundType(pattern)).toBe('bossyR')
    })

    it('is case-insensitive', () => {
      expect(getSoundType('AR')).toBe('bossyR')
    })
  })

  describe('consonants', () => {
    it.each(['b', 'c', 'd', 'f', 'g', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'q', 's', 't', 'v', 'w', 'x', 'z'])(
      'classifies single consonant %s as a consonant',
      (pattern) => {
        expect(getSoundType(pattern)).toBe('consonant')
      }
    )

    it.each(['sh', 'ch', 'th', 'wh', 'ph', 'ck', 'tch', 'ng', 'nk'])(
      'classifies digraph %s as a consonant',
      (pattern) => {
        expect(getSoundType(pattern)).toBe('consonant')
      }
    )

    it('classifies a lone r as a consonant, not bossy R', () => {
      expect(getSoundType('r')).toBe('consonant')
    })
  })

  describe('documented heuristic limits', () => {
    it('reads silent-e markers as vowels (dge)', () => {
      // Simple and predictable beats clever: any vowel letter counts.
      expect(getSoundType('dge')).toBe('vowel')
    })
  })
})

describe('SOUND_TYPE_BORDER', () => {
  it('maps vowels to green, consonants to red, bossy R to blue', () => {
    expect(SOUND_TYPE_BORDER.vowel).toBe('border-leaf')
    expect(SOUND_TYPE_BORDER.consonant).toBe('border-coral')
    expect(SOUND_TYPE_BORDER.bossyR).toBe('border-sky')
  })
})
