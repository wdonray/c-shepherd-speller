import { useState } from 'react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

const RULE_MAX_LENGTH = 300

/**
 * Visible placeholder shown under a pattern header when no rule exists
 * (issue #370). It keeps the column layout the same size as a filled rule
 * card instead of collapsing to nothing, and the dashed border marks it as
 * an empty slot rather than a real rule.
 */
export function EmptyRulePlaceholder() {
  return (
    <div className="mt-3 rounded-xl border-2 border-dashed border-line bg-background p-3 text-left">
      <p className="text-sm font-bold text-muted-foreground">No rule yet</p>
    </div>
  )
}

/**
 * Displays a spelling rule under a pattern header, with inline editing and
 * deletion. The label distinguishes class rules ("Your class decided:") from
 * unscoped rules ("The rule:").
 *
 * Pass editable={false} to render display-only: used during the sort game,
 * where rules must not be edited mid-game.
 *
 * Pass onDelete to add a delete affordance with an inline confirm step.
 * Deletion is deliberate because rules are teacher-authored.
 */
export default function RuleCard({
  rule,
  label,
  editable = true,
  saving = false,
  saveError = null,
  onSave,
  onDelete,
}: {
  rule: string
  label: string
  editable?: boolean
  saving?: boolean
  saveError?: string | null
  onSave?: (rule: string) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(rule)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // The Edit button only renders when a save handler exists, so the editor
  // below always has onSave. Same for the delete confirm and onDelete.
  const canEdit = editable && onSave !== undefined

  const handleSave = () => {
    const save = onSave as (rule: string) => Promise<void>
    // The parent reports failures via saveError; close on success.
    save(draft.trim()).then(
      () => setEditing(false),
      () => {}
    )
  }

  const handleDelete = () => {
    const remove = onDelete as () => Promise<void>
    setDeleting(true)
    setDeleteError(null)
    remove()
      .then(
        () => setConfirmingDelete(false),
        () => setDeleteError('Could not delete the rule. Try again.')
      )
      .finally(() => setDeleting(false))
  }

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
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    )
  }

  if (confirmingDelete) {
    return (
      <div className="mt-3 rounded-xl border-2 border-line bg-background p-3 text-left">
        <p className="text-sm font-bold text-ink">Delete this rule?</p>
        <p className="mt-1 text-sm text-muted-foreground">This cannot be undone.</p>
        {deleteError && (
          <p role="alert" className="mt-1 text-xs font-bold text-coral-ink">
            {deleteError}
          </p>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button size="sm" variant="destructive" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting…' : 'Yes, delete'}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-3 rounded-xl border-2 border-line bg-background p-3 text-left">
      <p className="text-xs font-extrabold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-sm text-ink">{rule}</p>
      {(canEdit || onDelete) && (
        <div className="mt-1 flex gap-1">
          {canEdit && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setDraft(rule)
                setEditing(true)
              }}
            >
              Edit
            </Button>
          )}
          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-coral-ink"
              onClick={() => setConfirmingDelete(true)}
            >
              Delete
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
