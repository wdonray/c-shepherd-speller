import { useEffect, useRef, useState } from 'react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

/** Sentence starters the teacher can tap to begin a rule in the kid's words. */
const SENTENCE_STARTERS = ['I notice that ', 'When a word has ', 'The pattern ']

const RULE_MAX_LENGTH = 300

export interface RulePattern {
  id: string
  pattern: string
}

/**
 * Post-win rule capture: "What rule did the class discover?" One field per
 * spelling pattern, prefilled with any existing rule (recall). Sentence
 * starter chips insert into the focused field. Save persists via onSave;
 * Skip closes without saving.
 */
export default function RuleCaptureDialog({
  open,
  patterns,
  existingRules,
  className,
  saving,
  saveError,
  onSave,
  onSkip,
}: {
  open: boolean
  patterns: RulePattern[]
  /** Pattern text to the current rule text, for prefill. */
  existingRules: Record<string, string>
  /** Active class name, or null when sorting without a class. */
  className: string | null
  saving: boolean
  saveError: string | null
  onSave: (rules: Record<string, string>) => void
  onSkip: () => void
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [focusedPattern, setFocusedPattern] = useState<string | null>(null)
  const fieldRefs = useRef<Record<string, HTMLTextAreaElement | null>>({})

  // Reset the draft each time the dialog opens, prefilled from existing rules.
  useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {}
      for (const p of patterns) {
        initial[p.pattern] = existingRules[p.pattern] ?? ''
      }
      setDrafts(initial)
      setFocusedPattern(null)
    }
  }, [open, patterns, existingRules])

  if (!open) return null

  const insertStarter = (starter: string) => {
    const target = focusedPattern ?? patterns[0]?.pattern
    if (!target) return
    setDrafts((prev) => {
      // drafts always carries every pattern key (initialized on open).
      const current: string = prev[target]
      // Fill an empty field; otherwise append with a space.
      const next = current.trim() === '' ? starter : `${current.replace(/\s+$/, '')} ${starter}`
      return { ...prev, [target]: next.slice(0, RULE_MAX_LENGTH) }
    })
    // Keep focus in the field so the teacher can keep typing.
    fieldRefs.current[target]?.focus()
  }

  const handleSave = () => {
    const rules: Record<string, string> = {}
    for (const p of patterns) {
      // drafts always carries every pattern key (initialized on open).
      const text: string = drafts[p.pattern].trim()
      // Only send fields that changed from the existing rule.
      if (text !== (existingRules[p.pattern] ?? '')) {
        rules[p.pattern] = text
      }
    }
    onSave(rules)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-xl sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rule-capture-title"
      >
        <h2 id="rule-capture-title" className="text-2xl font-extrabold text-ink">
          {className ? `What rule did ${className} discover?` : 'What rule did you discover?'}
        </h2>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Write it the way the class said it. One rule per pattern.
        </p>

        <div className="mt-4 flex flex-wrap gap-2" aria-label="Sentence starters">
          {SENTENCE_STARTERS.map((starter) => (
            <button
              key={starter}
              type="button"
              onClick={() => insertStarter(starter)}
              className="rounded-full border-2 border-line bg-background px-3 py-1.5 text-sm font-bold text-ink transition-colors hover:border-sky-deep hover:bg-sky-soft"
            >
              {starter.trim()}…
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-4">
          {patterns.map((p) => (
            <div key={p.id}>
              <label htmlFor={`rule-${p.id}`} className="mb-1 block text-sm font-extrabold text-ink">
                Pattern <span className="font-mono">{p.pattern}</span>
              </label>
              <textarea
                id={`rule-${p.id}`}
                ref={(el) => {
                  fieldRefs.current[p.pattern] = el
                }}
                value={drafts[p.pattern] ?? ''}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [p.pattern]: e.target.value }))}
                onFocus={() => setFocusedPattern(p.pattern)}
                maxLength={RULE_MAX_LENGTH}
                rows={2}
                placeholder="The class said…"
                className={cn(
                  'w-full rounded-xl border-2 border-line bg-background px-3 py-2 text-[15px] text-ink',
                  'outline-none transition-colors placeholder:text-muted-foreground/60',
                  'focus:border-sky-deep'
                )}
              />
            </div>
          ))}
        </div>

        {saveError && (
          <p role="alert" className="mt-4 text-sm font-bold text-coral-ink">
            {saveError}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onSkip} disabled={saving}>
            Skip
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save rules'}
          </Button>
        </div>
      </div>
    </div>
  )
}
