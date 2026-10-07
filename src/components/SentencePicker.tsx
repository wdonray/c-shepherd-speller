'use client'

import { useEffect, useRef, useState } from 'react'
import { MessageCircleIcon, XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { fetchExampleSentences } from '@/lib/example-sentences'
import { cn } from '@/lib/utils'

interface SentencePickerProps {
  word: string
  patternId: string
  currentSentence?: string
  onSelect: (sentence: string | undefined) => void
}

/**
 * Per-word example sentence picker. Fetches real sentences from the Free
 * Dictionary API (with local fallback), lets the teacher pick one.
 */
export default function SentencePicker({ word, patternId, currentSentence, onSelect }: SentencePickerProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sentences, setSentences] = useState<string[]>([])
  const [selected, setSelected] = useState<string | undefined>(currentSentence)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const buttonId = `sentence-btn-${patternId}-${word}`

  useEffect(() => {
    if (!open) return
    setLoading(true)
    setSentences([])
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
        // Defer focus until after the dialog unmounts.
        requestAnimationFrame(() => triggerRef.current?.focus())
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open])

  const handleConfirm = () => {
    onSelect(selected)
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const handleClear = () => {
    onSelect(undefined)
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  return (
    <span className="relative inline-flex">
      <button
        ref={triggerRef}
        id={buttonId}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={currentSentence ? `Change example sentence for ${word}` : `Pick an example sentence for ${word}`}
        aria-expanded={open}
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
      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-label={`Example sentences for ${word}`}
          className="absolute top-full left-0 z-20 mt-2 w-80 rounded-2xl border-2 border-line bg-card p-4 shadow-lg"
        >
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-[15px] font-bold">Example sentences for &ldquo;{word}&rdquo;</h4>
            <button
              type="button"
              onClick={() => {
                setOpen(false)
                triggerRef.current?.focus()
              }}
              aria-label="Close sentence picker"
              className="cursor-pointer rounded-full p-2 text-muted-foreground outline-none hover:bg-line/50 focus-visible:ring-[3px] focus-visible:ring-ring/60"
            >
              <XIcon className="size-4" aria-hidden="true" />
            </button>
          </div>
          <div aria-live="polite">
            {loading ? (
              <p className="flex items-center gap-2 py-4 text-[14px] text-muted-foreground">
                <span
                  className="size-4 animate-spin rounded-full border-2 border-line border-t-sky"
                  aria-hidden="true"
                />
                Finding sentences&hellip;
              </p>
            ) : sentences.length === 0 ? (
              <p className="py-4 text-[14px] text-muted-foreground">No example sentences found for this word yet.</p>
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
          {!loading && sentences.length > 0 && (
            <div className="mt-4 flex gap-2">
              <Button size="sm" data-confirm onClick={handleConfirm} disabled={!selected}>
                Use this sentence
              </Button>
              {currentSentence && (
                <Button size="sm" variant="ghost" onClick={handleClear}>
                  Clear
                </Button>
              )}
            </div>
          )}
          <p className="mt-3 text-[12px] text-muted-foreground">
            Sentences: Free Dictionary API (dictionaryapi.dev), CC-BY-SA
          </p>
        </div>
      )}
    </span>
  )
}
