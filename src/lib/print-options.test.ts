import { describe, it, expect } from 'vitest'
import { DEFAULT_PRINT_PRESET, PRINT_PRESETS, PRINT_PRESET_STORAGE_KEY, parsePrintPreset } from './print-options'

describe('print-options', () => {
  it('parses each known preset id', () => {
    for (const preset of PRINT_PRESETS) {
      expect(parsePrintPreset(preset.id)).toBe(preset.id)
    }
  })

  it('falls back to the default for unknown, empty, and non-string values', () => {
    expect(parsePrintPreset('fancy')).toBe(DEFAULT_PRINT_PRESET)
    expect(parsePrintPreset('')).toBe(DEFAULT_PRINT_PRESET)
    expect(parsePrintPreset(null)).toBe(DEFAULT_PRINT_PRESET)
    expect(parsePrintPreset(undefined)).toBe(DEFAULT_PRINT_PRESET)
    expect(parsePrintPreset(42)).toBe(DEFAULT_PRINT_PRESET)
    expect(parsePrintPreset({})).toBe(DEFAULT_PRINT_PRESET)
  })

  it('exposes the default preset and the storage key', () => {
    expect(DEFAULT_PRINT_PRESET).toBe('standard')
    expect(PRINT_PRESET_STORAGE_KEY).toBe('patternspell.print-preset')
  })

  it('describes every preset in display order with usable copy', () => {
    expect(PRINT_PRESETS.map((preset) => preset.id)).toEqual(['standard', 'large-print', 'dyslexia-friendly'])
    for (const preset of PRINT_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0)
      expect(preset.description.length).toBeGreaterThan(0)
    }
  })
})
