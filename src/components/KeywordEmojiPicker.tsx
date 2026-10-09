'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ImagePlusIcon, Trash2Icon } from 'lucide-react'

/** Curated K-3 keyword emojis: animals, food, objects, weather and nature. */
export const KEYWORD_EMOJI_GROUPS: { label: string; choices: { emoji: string; name: string }[] }[] = [
  {
    label: 'Animals',
    choices: [
      { emoji: '🐝', name: 'Bee' },
      { emoji: '🐱', name: 'Cat' },
      { emoji: '🐶', name: 'Dog' },
      { emoji: '🐟', name: 'Fish' },
      { emoji: '🦁', name: 'Lion' },
      { emoji: '🦋', name: 'Butterfly' },
      { emoji: '🐸', name: 'Frog' },
      { emoji: '🐵', name: 'Monkey' },
      { emoji: '🐷', name: 'Pig' },
      { emoji: '🐴', name: 'Horse' },
    ],
  },
  {
    label: 'Food',
    choices: [
      { emoji: '🍎', name: 'Apple' },
      { emoji: '🍌', name: 'Banana' },
      { emoji: '🍕', name: 'Pizza' },
      { emoji: '🍩', name: 'Donut' },
      { emoji: '🍪', name: 'Cookie' },
      { emoji: '🍉', name: 'Watermelon' },
    ],
  },
  {
    label: 'Things',
    choices: [
      { emoji: '⚽', name: 'Ball' },
      { emoji: '🚗', name: 'Car' },
      { emoji: '⭐', name: 'Star' },
      { emoji: '🏠', name: 'House' },
      { emoji: '✏️', name: 'Pencil' },
      { emoji: '📚', name: 'Books' },
      { emoji: '🎈', name: 'Balloon' },
      { emoji: '🚂', name: 'Train' },
    ],
  },
  {
    label: 'Weather and nature',
    choices: [
      { emoji: '☀️', name: 'Sun' },
      { emoji: '🌈', name: 'Rainbow' },
      { emoji: '❄️', name: 'Snowflake' },
      { emoji: '🌙', name: 'Moon' },
      { emoji: '🌳', name: 'Tree' },
      { emoji: '🌸', name: 'Flower' },
    ],
  },
]

interface KeywordEmojiPickerProps {
  /** Spelling pattern the emoji anchors; used in accessible labels. */
  patternName: string
  value: string | undefined
  onSelect: (emoji: string | undefined) => void
}

/**
 * Picker for a pattern's keyword anchor image. The button shows the current
 * emoji at large size (or a dashed "Add" placeholder); clicking opens a
 * small popover with a curated grid of K-3-friendly emojis, a freeform
 * custom-emoji input, and a remove option. Selection is lifted to the parent
 * so it flows through the editor's existing onChange auto-save.
 */
export default function KeywordEmojiPicker({ patternName, value, onSelect }: KeywordEmojiPickerProps) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  const triggerLabel = patternName.trim()
    ? `Keyword image for pattern ${patternName}`
    : 'Keyword image for this pattern'

  const choose = (emoji: string) => {
    onSelect(emoji)
    setOpen(false)
  }

  const applyCustom = () => {
    const emoji = custom.trim()
    if (!emoji) return
    setCustom('')
    choose(emoji)
  }

  const remove = () => {
    onSelect(undefined)
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((isOpen) => !isOpen)}
        aria-label={triggerLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          'flex size-16 cursor-pointer items-center justify-center rounded-xl border-2 outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/60',
          value
            ? 'border-line bg-card hover:border-sky-deep'
            : 'border-dashed border-line bg-card text-muted-foreground hover:border-sky-deep hover:text-sky-ink'
        )}
      >
        {value ? (
          <span className="text-4xl leading-none" aria-hidden="true">
            {value}
          </span>
        ) : (
          <span className="flex flex-col items-center gap-0.5">
            <ImagePlusIcon className="size-5" aria-hidden="true" />
            <span className="text-[11px] font-bold">Add</span>
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            aria-hidden="true"
            data-testid="keyword-emoji-scrim"
            onPointerDown={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="dialog"
            aria-label="Choose keyword image"
            className="absolute left-0 top-full z-50 mt-2 w-72 rounded-2xl border-2 border-line bg-card p-4 shadow-lg"
          >
            {KEYWORD_EMOJI_GROUPS.map((group) => (
              <div key={group.label} role="group" aria-label={group.label} className="mb-3">
                <p className="mb-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                  {group.label}
                </p>
                <div className="grid grid-cols-5 gap-1">
                  {group.choices.map((choice) => (
                    <button
                      key={choice.emoji}
                      type="button"
                      onClick={() => choose(choice.emoji)}
                      aria-label={choice.name}
                      title={choice.name}
                      className="flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg text-2xl outline-none transition hover:bg-line/50 focus-visible:bg-line/50 focus-visible:ring-[3px] focus-visible:ring-ring/60"
                    >
                      <span aria-hidden="true">{choice.emoji}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div className="mt-3 border-t-2 border-line pt-3">
              <label htmlFor="keyword-emoji-custom" className="mb-1 block text-[13px] font-bold text-ink">
                Or type any emoji
              </label>
              <div className="flex gap-2">
                <Input
                  id="keyword-emoji-custom"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      applyCustom()
                    }
                  }}
                  placeholder="e.g. 🦄"
                  aria-label="Custom keyword emoji"
                  maxLength={20}
                  className="min-w-0 flex-1"
                />
                <Button type="button" onClick={applyCustom}>
                  Use emoji
                </Button>
              </div>
            </div>
            {value && (
              <button
                type="button"
                onClick={remove}
                className="mt-3 flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-[15px] font-bold text-destructive outline-none transition hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:ring-[3px] focus-visible:ring-ring/60"
              >
                <Trash2Icon className="size-5" aria-hidden="true" />
                Remove keyword image
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
