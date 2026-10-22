/**
 * Pre-print options for the worksheet print job (issue #512).
 *
 * Teachers pick a print style preset before printing. The choice persists per
 * teacher in localStorage so she sets it once; the answer-key toggle stays per
 * print job. Presets are validated on read: a stale or foreign stored value
 * falls back to the default instead of breaking the UI.
 */

export type PrintPreset = 'standard' | 'large-print' | 'dyslexia-friendly'

export interface PrintPresetInfo {
  id: PrintPreset
  label: string
  description: string
}

/**
 * The presets offered on the print preview screen, in display order.
 * Copy is classroom language for the teacher choosing the option.
 */
export const PRINT_PRESETS: readonly PrintPresetInfo[] = [
  { id: 'standard', label: 'Standard', description: 'Regular type and spacing.' },
  { id: 'large-print', label: 'Large print', description: 'Bigger type for younger readers.' },
  {
    id: 'dyslexia-friendly',
    label: 'Dyslexia-friendly',
    description: 'Extra spacing between letters, words, and lines.',
  },
]

export const DEFAULT_PRINT_PRESET: PrintPreset = 'standard'

export const PRINT_PRESET_STORAGE_KEY = 'patternspell.print-preset'

/** Parse a stored preset value, falling back to the default for anything unknown. */
export function parsePrintPreset(value: unknown): PrintPreset {
  return PRINT_PRESETS.some((preset) => preset.id === value) ? (value as PrintPreset) : DEFAULT_PRINT_PRESET
}
