'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronRightIcon, ScrollTextIcon } from 'lucide-react'
import { Label } from './ui/label'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'

/** Sentence starters the teacher can tap to begin a rule in the kids' words. */
const SENTENCE_STARTERS = ['I notice that ', 'When a word has ', 'The pattern ']

const RULE_MAX_LENGTH = 300

/**
 * Per-pattern rule editor (issue #313). A single collapsed row on the
 * pattern card (an "Add rule" affordance or a one-line preview of the
 * effective rule) opens a modal editor. Closing the modal saves: there is
 * no discard path, matching the autosave-on-blur model the standalone
 * Rules section had.
 */
export default function PatternRuleEditor({
  patternId,
  patternText,
  initialRule,
  shared,
  className,
  onSave,
}: {
  patternId: string
  patternText: string
  /** The effective rule: the classroom's rule when shared, otherwise the pattern's unscoped rule. */
  initialRule: string
  /** True when the rule comes from the classroom (shared across its lists). */
  shared: boolean
  /** The classroom's display name, or null when there is no class. */
  className: string | null
  /**
   * Persist the trimmed rule. Rejects on failure so the modal stays open
   * with the draft intact and shows the error.
   */
  onSave: (rule: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(initialRule)
  const [savedRule, setSavedRule] = useState(initialRule)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
  /**
   * A close requested while a save was still running and the draft was
   * clean (Clear-then-Done). Honored once the in-flight save settles
   * successfully; cleared without closing when the save fails, so the
   * error stays visible with the restored draft.
   */
  const closeAfterSaveRef = useRef(false)
  /**
   * The rule value a Clear-triggered save is persisting, or null when no
   * Clear save is in flight. Distinguishes "Done right after Clear" (the
   * draft was emptied by Clear itself, nothing to protect) from "Done
   * while a typed draft is saving" (the modal must stay open so a failed
   * save can show its error with the draft intact).
   */
  const clearingRef = useRef<string | null>(null)

  // Refresh the draft when the saved rule changes underneath (e.g. the
  // classroom was switched or the pattern renamed), but never while the
  // modal is open and never on a failed save (the draft must survive to be
  // retried). Changes that arrive while the modal is open are picked up
  // when it closes: the ref is only advanced while closed, so the next run
  // after close sees the difference and refreshes.
  const lastInitialRef = useRef(initialRule)
  useEffect(() => {
    if (open) return
    if (lastInitialRef.current !== initialRule) {
      lastInitialRef.current = initialRule
      setDraft(initialRule)
      setSavedRule(initialRule)
    }
  }, [initialRule, open])

  // Autofocus the textarea on open: writing is the whole point of opening
  // the modal, so focus goes straight to the field (which raises the iOS
  // keyboard). Deferred a tick so Radix finishes mounting the dialog
  // content; guarded for jsdom, where the ref may not be attached.
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => fieldRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [open])

  const dirty = draft.trim() !== savedRule.trim()

  const insertStarter = (starter: string) => {
    setDraft((prev) => {
      const next = prev.trim() === '' ? starter : `${prev.replace(/\s+$/, '')} ${starter}`
      return next.slice(0, RULE_MAX_LENGTH)
    })
    fieldRef.current?.focus()
  }

  /**
   * Persist one rule. Returns true on success. On failure the modal stays
   * open with the error line and the draft intact, exactly as the old
   * standalone row kept the draft.
   *
   * Honors a close queued while this save was running (issue #363): a Done
   * pressed right after Clear must not be swallowed just because the save
   * was still in flight.
   */
  const persist = async (rule: string): Promise<boolean> => {
    setSaving(true)
    setError(null)
    try {
      await onSave(rule)
      setSavedRule(rule)
      if (closeAfterSaveRef.current) {
        closeAfterSaveRef.current = false
        setOpen(false)
      }
      return true
    } catch {
      closeAfterSaveRef.current = false
      setError('Could not save the rule. Try again.')
      return false
    } finally {
      setSaving(false)
    }
  }

  /**
   * Every close path runs through here: Done, the corner X, backdrop
   * click, and Escape. Saves when the draft is dirty, then closes on
   * success. A close requested while a save is still running is ignored,
   * except when a Clear save is in flight and the draft still holds the
   * cleared value (Clear-then-Done): there is nothing to protect, so the
   * close is queued and honored once the save settles instead of being
   * swallowed (issue #363). A close during a typed draft's save still
   * keeps the modal open so a failed save can show its error with the
   * draft intact.
   */
  const closeAndSave = async () => {
    if (saving) {
      if (clearingRef.current !== null && draft.trim() === clearingRef.current) {
        closeAfterSaveRef.current = true
      }
      return
    }
    if (!dirty) {
      setOpen(false)
      return
    }
    if (await persist(draft.trim())) {
      setOpen(false)
    }
  }

  /** Empties the draft and saves the empty rule immediately. */
  const handleClear = async () => {
    if (saving) return
    const previous = draft
    setDraft('')
    clearingRef.current = ''
    try {
      if (!(await persist(''))) {
        // Save failed: restore the draft so the teacher can retry.
        setDraft(previous)
      }
    } finally {
      clearingRef.current = null
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          // Opening resets the draft to the current saved rule, so the
          // teacher always writes from the latest known value.
          setDraft(savedRule)
          setError(null)
          setOpen(true)
        }}
        aria-label={savedRule ? `Edit rule for ${patternText}` : `Add rule for ${patternText}`}
        className="flex min-h-[56px] w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-left outline-none transition hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/60"
      >
        <ScrollTextIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-ink">Spelling rule</span>
          <span className="block truncate text-[13px] text-muted-foreground">{savedRule || 'Add a rule'}</span>
        </span>
        <ChevronRightIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
      {shared && className && <p className="mt-1 text-xs font-bold text-muted-foreground">Shared with {className}</p>}

      <Dialog
        open={open}
        onOpenChange={() => {
          // Opens always go through the button above; Radix only reports
          // the close paths (Done is handled separately), so every change
          // here is a close.
          void closeAndSave()
        }}
      >
        <DialogContent
          className="max-h-[85vh] overflow-y-auto"
          onOpenAutoFocus={(e) => {
            // Focus is managed by the effect above (the textarea).
            e.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-ink">
              Rule for{' '}
              <span className="rounded-lg border-2 border-line bg-background px-3 py-1 text-lg font-extrabold">
                {patternText || 'untitled'}
              </span>
            </DialogTitle>
            <DialogDescription>
              {className ? (
                <>
                  What {className} figured out, in their words. Shared across {className}&rsquo;s lists and shown on the
                  present chart.
                </>
              ) : (
                <>What the class figured out, in their words. Shown on the present chart.</>
              )}
            </DialogDescription>
            {shared && className && <p className="text-xs font-bold text-muted-foreground">Shared with {className}</p>}
          </DialogHeader>

          <div className="space-y-1.5">
            <Label htmlFor={`rule-${patternId}`}>Rule, in the kids&rsquo; words</Label>
            <textarea
              ref={fieldRef}
              id={`rule-${patternId}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={RULE_MAX_LENGTH}
              rows={3}
              placeholder="e.g. ai never ends a word."
              className="w-full rounded-xl border-2 border-line bg-background px-3 py-2 text-[15px] text-ink outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-sky-deep"
            />
            <div className="flex flex-wrap gap-1.5" aria-label="Sentence starters">
              {SENTENCE_STARTERS.map((starter) => (
                <Button
                  key={starter}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => insertStarter(starter)}
                >
                  {starter.trim()}…
                </Button>
              ))}
            </div>
            {error ? (
              <p role="alert" className="text-sm font-bold text-coral-ink">
                {error}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {saving ? 'Saving…' : dirty ? 'Unsaved changes' : savedRule ? 'Saved' : 'No rule yet'}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => void handleClear()}>
              Clear
            </Button>
            <Button type="button" onClick={() => void closeAndSave()}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
