'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { processKeywordImage, PROFILE_IMAGE_MIME_TYPES } from '@/lib/profile-image'
import { ImagePlusIcon, Trash2Icon, UploadIcon } from 'lucide-react'

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

interface KeywordImagePickerProps {
  /** Spelling pattern the image anchors; used in accessible labels. */
  patternName: string
  /** Uploaded photo (JPEG data URL). Takes display precedence over emoji. */
  image: string | undefined
  /** Keyword anchor emoji; shown when no photo is set. */
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
 * works on every screen size. Selections are lifted to the parent so they
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

  const triggerLabel = patternName.trim()
    ? `Keyword image for pattern ${patternName}`
    : 'Keyword image for this pattern'

  const chooseEmoji = (next: string) => {
    onEmojiSelect(next)
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
          className={cn(
            'flex size-16 cursor-pointer items-center justify-center rounded-xl border-2 outline-none transition focus-visible:ring-[3px] focus-visible:ring-ring/60',
            image || emoji
              ? 'border-line bg-card hover:border-sky-deep'
              : 'border-dashed border-line bg-card text-muted-foreground hover:border-sky-deep hover:text-sky-ink'
          )}
        >
          {image ? (
            <img src={image} alt="" aria-hidden="true" className="size-12 rounded-lg object-cover" />
          ) : emoji ? (
            <span className="text-4xl leading-none" aria-hidden="true">
              {emoji}
            </span>
          ) : (
            <span className="flex flex-col items-center gap-0.5">
              <ImagePlusIcon className="size-5" aria-hidden="true" />
              <span className="text-[11px] font-bold">Add</span>
            </span>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogTitle className="sr-only">Choose keyword image</DialogTitle>
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
              {group.choices.map((choice) => (
                <button
                  key={choice.emoji}
                  type="button"
                  onClick={() => chooseEmoji(choice.emoji)}
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
