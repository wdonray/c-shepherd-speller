'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircleIcon, PencilIcon, XIcon } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { fetchExampleSentences } from '@/lib/example-sentences'
import { cn } from '@/lib/utils'

interface SentencePickerProps {
  word: string
  patternId: string
  currentSentence?: string
  onSelect: (sentence: string | undefined) => void
  /**
   * Render a pencil edit button with tooltip instead of the default chat
   * bubble. Used in the word table where space is tight.
   */
  variant?: 'default' | 'pencil'
}

/**
 * Per-word example sentence picker. Fetches real sentences from the Free
 * Dictionary API (with local fallback), lets the teacher pick one.
 * Rendered as a modal dialog so it always appears above surrounding content.
 */
export default function SentencePicker({
  word,
  patternId,
  currentSentence,
  onSelect,
  variant = 'default',
}: SentencePickerProps) {
  const buttonId = `sentence-btn-${patternId}-${word}`
  const label = currentSentence ? `Edit example sentence for ${word}` : `Add example sentence for ${word}`

  const triggerButton =
    variant === 'pencil' ? (
      <button
        id={buttonId}
        type="button"
        aria-label={label}
        className="flex size-11 cursor-pointer items-center justify-center rounded-full p-2 text-sky-ink outline-none transition hover:bg-sky-soft focus-visible:bg-sky-soft focus-visible:ring-[3px] focus-visible:ring-ring/60"
      >
        <PencilIcon className="size-5" aria-hidden="true" />
      </button>
    ) : (
      <button
        id={buttonId}
        type="button"
        aria-label={currentSentence ? `Change example sentence for ${word}` : `Pick an example sentence for ${word}`}
        title={currentSentence ?? `Pick an example sentence for ${word}`}
        className={cn(
          'flex size-11 cursor-pointer items-center justify-center rounded-full p-2 font-bold outline-none transition',
          'text-muted-foreground hover:bg-card hover:text-sky-ink',
          'focus-visible:bg-card focus-visible:text-sky-ink focus-visible:ring-[3px] focus-visible:ring-ring/60',
          currentSentence && 'text-sky-ink'
        )}
      >
        <MessageCircleIcon className="size-5" aria-hidden="true" />
      </button>
    )

  const trigger =
    variant === 'pencil' ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            id={buttonId}
            type="button"
            aria-label={label}
            onClick={() => setOpen(true)}
            className="flex size-11 cursor-pointer items-center justify-center rounded-full p-2 text-sky-ink outline-none transition hover:bg-sky-soft focus-visible:bg-sky-soft focus-visible:ring-[3px] focus-visible:ring-ring/60"
          >
            <PencilIcon className="size-5" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent>{currentSentence ? 'Edit example sentence' : 'Add example sentence'}</TooltipContent>
      </Tooltip>
    ) : (
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
    )
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sentences, setSentences] = useState<string[]>([])
  const [selected, setSelected] = useState<string | undefined>(currentSentence)
  const [customSentence, setCustomSentence] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSentences([])
    setCustomSentence('')
    fetchExampleSentences(word).then((results) => {
      setSentences(results)
      setLoading(false)
      setSelected((prev) => prev ?? results[0])
    })
  }, [open, word])

  useEffect(() => {
    if (!open) return
    // Move focus into the dialog on open.
    const firstRadio = dialogRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')
    if (firstRadio) {
      firstRadio.focus()
    } else {
      dialogRef.current?.querySelector<HTMLButtonElement>('button[aria-label="Close sentence picker"]')?.focus()
    }
  }, [open, loading])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const handleConfirm = () => {
    onSelect(selected)
    setOpen(false)
  }

  const handleClear = () => {
    onSelect(undefined)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger}
      <DialogContent
        ref={dialogRef}
        showCloseButton={false}
        className="max-h-[85vh] overflow-y-auto"
        onOpenAutoFocus={(e) => {
          // Focus is managed by the effect above (first radio, else close button).
          e.preventDefault()
        }}
      >
        <DialogHeader>
          <div className="flex items-center justify-between gap-4">
            <DialogTitle className="text-lg font-bold text-ink">Example sentences for &ldquo;{word}&rdquo;</DialogTitle>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close sentence picker"
              className="cursor-pointer rounded-full p-2 text-muted-foreground outline-none hover:bg-line/50 focus-visible:ring-[3px] focus-visible:ring-ring/60"
            >
              <XIcon className="size-4" aria-hidden="true" />
            </button>
          </div>
        </DialogHeader>
        <div aria-live="polite">
          {loading ? (
            <p className="flex items-center gap-2 py-4 text-[14px] text-muted-foreground">
              <span className="size-4 animate-spin rounded-full border-2 border-line border-t-sky" aria-hidden="true" />
              Finding sentences&hellip;
            </p>
          ) : sentences.length === 0 ? (
            <p className="py-4 text-[14px] text-muted-foreground">
              No example sentences found for this word yet. Add your own below.
            </p>
          ) : (
            <div role="radiogroup" aria-label={`Choose a sentence for ${word}`} className="space-y-2">
              {sentences.map((sentence) => (
                <label
                  key={sentence}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3 text-[14px] transition',
                    selected === sentence ? 'border-sky bg-sky-soft' : 'border-line hover:border-sky-deep'
                  )}
                >
                  <input
                    type="radio"
                    name={`sentence-${patternId}-${word}`}
                    value={sentence}
                    checked={selected === sentence}
                    onChange={() => setSelected(sentence)}
                    className="mt-1 size-4 shrink-0 accent-sky"
                  />
                  <span>{sentence}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        {!loading && (
          <div className="mt-4 space-y-3">
            <div>
              <label
                htmlFor={`custom-sentence-${patternId}-${word}`}
                className="mb-1 block text-[13px] font-semibold text-ink"
              >
                Or write your own
              </label>
              <div className="flex gap-2">
                <input
                  id={`custom-sentence-${patternId}-${word}`}
                  type="text"
                  value={customSentence}
                  onChange={(e) => setCustomSentence(e.target.value)}
                  placeholder={`Write a sentence using "${word}"`}
                  className="h-10 flex-1 rounded-xl border-2 border-line bg-card px-3 text-[14px] text-ink outline-none placeholder:text-muted-foreground focus-visible:border-sky-deep"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setSelected(customSentence.trim())
                    setCustomSentence('')
                  }}
                  disabled={!customSentence.trim()}
                >
                  Add
                </Button>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" data-confirm onClick={handleConfirm} disabled={!selected}>
                Use this sentence
              </Button>
              {currentSentence && (
                <Button size="sm" variant="ghost" onClick={handleClear}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        )}
        <p className="mt-3 text-[12px] text-muted-foreground">
          Sentences: Free Dictionary API (dictionaryapi.dev), CC-BY-SA
        </p>
      </DialogContent>
    </Dialog>
  )
}
