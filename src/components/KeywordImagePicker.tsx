'use client'

import { useId, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { KEYWORD_IMAGE_MAX_DIMENSION, processKeywordImage, PROFILE_IMAGE_MIME_TYPES } from '@/lib/profile-image'
import { ChevronRightIcon, ImagePlusIcon, Trash2Icon, UploadIcon } from 'lucide-react'

/** Curated K-3 keyword emojis: animals, food, things, weather and nature, play, home, and clothes. */
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
      { emoji: '🐔', name: 'Chicken' },
      { emoji: '🦆', name: 'Duck' },
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
      { emoji: '🍇', name: 'Grapes' },
      { emoji: '🍓', name: 'Strawberry' },
      { emoji: '🍑', name: 'Peach' },
      { emoji: '🥛', name: 'Milk' },
      { emoji: '🍳', name: 'Egg' },
      { emoji: '🧀', name: 'Cheese' },
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
      { emoji: '🚲', name: 'Bike' },
      { emoji: '🪁', name: 'Kite' },
      { emoji: '🛹', name: 'Skateboard' },
      { emoji: '🧸', name: 'Teddy bear' },
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
      { emoji: '🌧️', name: 'Rain' },
      { emoji: '⛄', name: 'Snowman' },
      { emoji: '🌊', name: 'Wave' },
      { emoji: '🌻', name: 'Sunflower' },
      { emoji: '🌵', name: 'Cactus' },
      { emoji: '🍁', name: 'Leaf' },
    ],
  },
  {
    label: 'Play',
    choices: [
      { emoji: '⚾', name: 'Baseball' },
      { emoji: '🏈', name: 'Football' },
      { emoji: '🎾', name: 'Tennis' },
      { emoji: '🥁', name: 'Drum' },
      { emoji: '🎸', name: 'Guitar' },
      { emoji: '🎨', name: 'Paint' },
    ],
  },
  {
    label: 'Home',
    choices: [
      { emoji: '🛏️', name: 'Bed' },
      { emoji: '🪑', name: 'Chair' },
      { emoji: '🚪', name: 'Door' },
      { emoji: '🔔', name: 'Bell' },
      { emoji: '🛋️', name: 'Couch' },
      { emoji: '🛁', name: 'Bath' },
    ],
  },
  {
    label: 'Clothes',
    choices: [
      { emoji: '👕', name: 'Shirt' },
      { emoji: '👖', name: 'Pants' },
      { emoji: '👟', name: 'Shoes' },
      { emoji: '🧢', name: 'Cap' },
      { emoji: '🧥', name: 'Coat' },
      { emoji: '🕶️', name: 'Sunglasses' },
    ],
  },
]

interface KeywordImagePickerProps {
  /** Spelling pattern the image anchors; used in accessible labels. */
  patternName: string
  /** Uploaded photo (JPEG data URL). Mutually exclusive with emoji. */
  image: string | undefined
  /** Keyword anchor emoji. Mutually exclusive with photo. */
  emoji: string | undefined
  onImageSelect: (image: string | undefined) => void
  onEmojiSelect: (emoji: string | undefined) => void
}

/**
 * Picker for a pattern's keyword anchor image. The button shows the uploaded
 * photo (or the emoji at large size, or a dashed "Add" placeholder); clicking
 * opens a centered modal dialog with a photo upload option, a curated grid of
 * K-3-friendly emojis, a freeform custom-emoji input, and remove options. The
 * dialog constrains to the viewport with internal scrolling, so the picker
 * works on every screen size. The currently selected emoji is highlighted;
 * clicking it again removes it. A photo and an emoji are mutually exclusive:
 * picking one clears the other. Selections are lifted to the parent so they
 * flow through the editor's existing onChange auto-save.
 */
export default function KeywordImagePicker({
  patternName,
  image,
  emoji,
  onImageSelect,
  onEmojiSelect,
}: KeywordImagePickerProps) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  // Associates the visible summary (Photo / "🐝 Bee" / Not set) with the
  // trigger button so screen readers announce the current selection.
  const summaryId = useId()

  const triggerLabel = patternName.trim()
    ? `Keyword image for pattern ${patternName}`
    : 'Keyword image for this pattern'

  // Summary beside the label keeps the current choice visible without
  // reopening the picker. Curated emojis show their name; custom emojis and
  // photos have no name to show.
  const keywordName = KEYWORD_EMOJI_GROUPS.flatMap((group) => group.choices).find(
    (choice) => choice.emoji === emoji
  )?.name
  const triggerSummary = image ? 'Photo' : emoji ? (keywordName ? `${emoji} ${keywordName}` : emoji) : 'Not set'

  const chooseEmoji = (next: string) => {
    if (next === emoji) {
      // Clicking the already-selected emoji removes it.
      onEmojiSelect(undefined)
    } else {
      // A photo and an emoji can never both be set: picking an emoji clears any photo.
      if (image) onImageSelect(undefined)
      onEmojiSelect(next)
    }
    setOpen(false)
  }

  const applyCustom = () => {
    const next = custom.trim()
    if (!next) return
    setCustom('')
    chooseEmoji(next)
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    setUploadError(null)
    try {
      const dataUrl = await processKeywordImage(file)
      // A photo and an emoji can never both be set: uploading a photo clears any emoji.
      if (emoji) onEmojiSelect(undefined)
      onImageSelect(dataUrl)
      setOpen(false)
    } catch (error) {
      // Surface the real reason (wrong format, too big, unreadable) so the
      // teacher knows what to do instead of a generic failure message.
      setUploadError(error instanceof Error ? error.message : 'Could not use that photo. Please try another.')
    } finally {
      setUploading(false)
    }
  }

  const removeImage = () => {
    onImageSelect(undefined)
    setOpen(false)
  }

  const removeEmoji = () => {
    onEmojiSelect(undefined)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={triggerLabel}
          aria-describedby={summaryId}
          className="flex min-h-[56px] w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          <span
            aria-hidden="true"
            className={cn(
              'flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2',
              image || emoji ? 'border-line bg-card' : 'border-dashed border-line text-muted-foreground'
            )}
          >
            {image ? (
              <img src={image} alt="" className="size-full object-cover" />
            ) : emoji ? (
              <span className="text-3xl leading-none">{emoji}</span>
            ) : (
              <ImagePlusIcon className="size-5" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-bold text-ink">Keyword image</span>
            <span id={summaryId} className="block truncate text-[13px] text-muted-foreground">
              {triggerSummary}
            </span>
          </span>
          <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogTitle className="pr-10 text-[17px] font-bold text-ink">Keyword image</DialogTitle>
        <div className="mb-3">
          <input
            id="keyword-photo-upload"
            type="file"
            accept={PROFILE_IMAGE_MIME_TYPES.join(',')}
            onChange={handleFileSelect}
            disabled={uploading}
            className="sr-only"
          />
          <label
            htmlFor="keyword-photo-upload"
            className={cn(
              'flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-[15px] font-bold outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/60',
              'bg-primary text-primary-foreground hover:bg-primary/90',
              uploading && 'pointer-events-none opacity-50'
            )}
          >
            <UploadIcon className="size-4" aria-hidden="true" />
            {uploading ? 'Uploading photo...' : image ? 'Replace photo' : 'Upload photo'}
          </label>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Tip: a square photo at least {KEYWORD_IMAGE_MAX_DIMENSION} × {KEYWORD_IMAGE_MAX_DIMENSION} pixels looks
            clearest in your chart.
          </p>
          {uploadError && (
            <p role="alert" className="mt-2 text-[13px] font-bold text-destructive">
              {uploadError}
            </p>
          )}
        </div>
        {KEYWORD_EMOJI_GROUPS.map((group) => (
          <div key={group.label} role="group" aria-label={group.label} className="mb-3">
            <p className="mb-1 text-[11px] font-bold tracking-wide text-muted-foreground uppercase">{group.label}</p>
            <div className="grid grid-cols-5 gap-1">
              {group.choices.map((choice) => {
                const selected = choice.emoji === emoji
                return (
                  <button
                    key={choice.emoji}
                    type="button"
                    onClick={() => chooseEmoji(choice.emoji)}
                    aria-label={choice.name}
                    aria-pressed={selected}
                    title={choice.name}
                    className={cn(
                      'flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-lg border-2 text-2xl outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/60',
                      selected
                        ? 'border-sky-deep bg-sky-soft'
                        : 'border-transparent hover:bg-line/50 focus-visible:bg-line/50'
                    )}
                  >
                    <span aria-hidden="true">{choice.emoji}</span>
                  </button>
                )
              })}
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
        {image && (
          <button
            type="button"
            onClick={removeImage}
            className="mt-3 flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-[15px] font-bold text-destructive outline-none transition hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:ring-[3px] focus-visible:ring-ring/60"
          >
            <Trash2Icon className="size-5" aria-hidden="true" />
            Remove photo
          </button>
        )}
        {emoji && (
          <button
            type="button"
            onClick={removeEmoji}
            className="mt-3 flex min-h-[44px] w-full cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-2 text-[15px] font-bold text-destructive outline-none transition hover:bg-destructive/10 focus-visible:bg-destructive/10 focus-visible:ring-[3px] focus-visible:ring-ring/60"
          >
            <Trash2Icon className="size-5" aria-hidden="true" />
            Remove emoji
          </button>
        )}
      </DialogContent>
    </Dialog>
  )
}
