'use client'

import { useEffect, useRef, useState } from 'react'
import { Label } from './ui/label'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

/** Sentence starters the teacher can tap to begin a rule in the kids' words. */
const SENTENCE_STARTERS = ['I notice that ', 'When a word has ', 'The pattern ']

const RULE_MAX_LENGTH = 300

export interface RulesSectionPattern {
  id: string
  pattern: string
  /** Unscoped rule stored on the pattern itself. */
  rule?: string
}

/**
 * The one management home for spelling rules (issue #263), on the list
 * editor page. One field per pattern, prefilled with the effective rule:
 * the classroom's rule when the list has a class, otherwise the unscoped
 * rule on the pattern. Rules are display-only on the present chart and no
 * longer live in the sort game at all.
 */
export default function ListRulesSection({
  patterns,
  classId,
  className,
  classRules,
  onSaveRule,
}: {
  patterns: RulesSectionPattern[]
  /** The list's classroom id, or null/undefined for "No class". */
  classId: string | null | undefined
  /** The classroom's display name, or null when there is no class. */
  className: string | null
  /** The classroom's rules by pattern text, or null when there is no class. */
  classRules: Record<string, string> | null
  /**
   * Persist one rule. The parent saves to the classroom (when classId is
   * set) or to the pattern itself. Rejects on failure so the row can show
   * the error and keep the draft.
   */
  onSaveRule: (patternId: string, patternText: string, rule: string) => Promise<void>
}) {
  return (
    <section aria-label="Spelling rules" className="space-y-4">
      <div className="space-y-2">
        <h2 className="text-[22px] font-bold">Rules ({patterns.length})</h2>
        <p className="text-sm text-muted-foreground">
          {classId && className ? (
            <>
              What <span className="font-bold text-ink">{className}</span> figured out, in their words. Shared across{' '}
              {className}&rsquo;s lists and shown on the present chart.
            </>
          ) : (
            <>
              What the class figured out, in their words. Shown on the present chart. Assign a classroom above to share
              rules across lists.
            </>
          )}
        </p>
      </div>
      {patterns.length === 0 ? (
        <p className="text-sm text-muted-foreground">Add a spelling pattern above to write its rule.</p>
      ) : (
        <ul className="space-y-4">
          {patterns.map((p) => (
            <RuleRow
              key={p.id}
              patternId={p.id}
              patternText={p.pattern}
              // The effective rule: the classroom's rule wins when set.
              initialRule={classRules?.[p.pattern] ?? p.rule ?? ''}
              shared={!!classId && classRules?.[p.pattern] !== undefined}
              className={className}
              onSave={(rule) => onSaveRule(p.id, p.pattern, rule)}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

function RuleRow({
  patternId,
  patternText,
  initialRule,
  shared,
  className,
  onSave,
}: {
  patternId: string
  patternText: string
  initialRule: string
  shared: boolean
  className: string | null
  onSave: (rule: string) => Promise<void>
}) {
  const [draft, setDraft] = useState(initialRule)
  const [savedRule, setSavedRule] = useState(initialRule)
  const [focused, setFocused] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fieldRef = useRef<HTMLTextAreaElement>(null)

  // Refresh the draft when the saved rule changes underneath (e.g. the
  // classroom was switched), but never while the teacher is typing and
  // never on a failed save (the draft must survive to be retried).
  const lastInitialRef = useRef(initialRule)
  useEffect(() => {
    if (lastInitialRef.current !== initialRule) {
      lastInitialRef.current = initialRule
      if (!focused) {
        setDraft(initialRule)
        setSavedRule(initialRule)
      }
    }
  }, [initialRule, focused])

  const dirty = draft.trim() !== savedRule.trim()

  const insertStarter = (starter: string) => {
    setDraft((prev) => {
      const next = prev.trim() === '' ? starter : `${prev.replace(/\s+$/, '')} ${starter}`
      return next.slice(0, RULE_MAX_LENGTH)
    })
    fieldRef.current?.focus()
  }

  const handleBlur = async () => {
    setFocused(false)
    if (!dirty || saving) return
    setSaving(true)
    setError(null)
    try {
      await onSave(draft.trim())
      setSavedRule(draft.trim())
    } catch {
      setError('Could not save the rule. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="rounded-2xl border-2 border-line bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-lg border-2 border-line bg-background px-3 py-1 text-lg font-extrabold text-ink">
          {patternText || 'untitled'}
        </span>
        {shared && className && (
          <span className="text-xs font-bold text-muted-foreground">Shared with {className}</span>
        )}
      </div>
      <div className="mt-3 space-y-1.5">
        <Label htmlFor={`rule-${patternId}`}>Rule, in the kids&rsquo; words</Label>
        <textarea
          ref={fieldRef}
          id={`rule-${patternId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={handleBlur}
          maxLength={RULE_MAX_LENGTH}
          rows={2}
          placeholder="e.g. ai never ends a word."
          className={cn(
            'w-full rounded-xl border-2 border-line bg-background px-3 py-2 text-[15px] text-ink',
            'outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-sky-deep'
          )}
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
    </li>
  )
}
