'use client'

import { cn } from '@/lib/utils'
import { LIST_COLORS, type ListColor } from '@/models/WordList'

/** Swatch dot classes and accessible labels for each curated list color. */
const SWATCHES: Record<ListColor, { dot: string; label: string }> = {
  leaf: { dot: 'bg-leaf', label: 'Green' },
  sky: { dot: 'bg-sky', label: 'Blue' },
  plum: { dot: 'bg-plum', label: 'Purple' },
  sun: { dot: 'bg-sun', label: 'Yellow' },
  coral: { dot: 'bg-coral', label: 'Red' },
}

interface ListColorPickerProps {
  /** Currently selected color. */
  value: ListColor
  onChange: (color: ListColor) => void
}

/**
 * Swatch picker for a spelling list's accent color. Curated to the app's
 * theme tokens so every choice works in light and dark mode.
 */
export default function ListColorPicker({ value, onChange }: ListColorPickerProps) {
  return (
    <div role="radiogroup" aria-label="List color" className="flex items-center gap-2">
      {LIST_COLORS.map((color) => {
        const selected = color === value
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={SWATCHES[color].label}
            title={SWATCHES[color].label}
            onClick={() => onChange(color)}
            className={cn(
              'h-10 w-10 rounded-full border-2 transition-transform',
              SWATCHES[color].dot,
              selected
                ? 'scale-110 border-ink ring-2 ring-ink ring-offset-2 ring-offset-card'
                : 'border-line hover:scale-105'
            )}
          />
        )
      })}
    </div>
  )
}
