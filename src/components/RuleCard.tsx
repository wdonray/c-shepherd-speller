import { useState } from 'react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

const RULE_MAX_LENGTH = 300

/**
 * Displays a spelling rule under a pattern header, with inline editing.
 * The label distinguishes class rules ("Your class decided:") from unscoped
 * rules ("The rule:").
 */
export default function RuleCard({
  rule,
  label,
  saving,
  saveError,
  onSave,
}: {
  rule: string
  label: string
  saving: boolean
  saveError: string | null
  onSave: (rule: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(rule)

  if (editing) {
    return (
      <div className="mt-3 rounded-xl border-2 border-line bg-background p-3">
        <label htmlFor={`rule-edit-${label}`} className="sr-only">
          Edit rule
        </label>
        <textarea
          id={`rule-edit-${label}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={RULE_MAX_LENGTH}
          rows={2}
          className={cn(
            'w-full rounded-lg border-2 border-line bg-card px-2 py-1.5 text-sm text-ink',
            'outline-none transition-colors focus:border-sky-deep'
          )}
        />
        {saveError && (
          <p role="alert" className="mt-1 text-xs font-bold text-coral-ink">
            {saveError}
          </p>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setEditing(false)
              setDraft(rule)
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button size="sm" onClick={() => onSave(draft.trim())} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-xl border-2 border-line bg-background p-3 text-left">
      <p className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-sm text-ink">{rule}</p>
      <Button
        size="sm"
        variant="ghost"
        className="mt-1 h-7 px-2 text-xs"
        onClick={() => {
          setDraft(rule)
          setEditing(true)
        }}
      >
        Edit
      </Button>
    </div>
  )
}
