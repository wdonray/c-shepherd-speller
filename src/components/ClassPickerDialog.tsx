import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

interface PickerClass {
  id: string
  name: string
}

/**
 * Optional class picker shown before entering the Sort activity. The teacher
 * picks a class so its rules are recalled and new rules are saved to it, or
 * continues without a class. Includes an inline form to create a class.
 */
export default function ClassPickerDialog({
  open,
  onSelect,
  onClose,
}: {
  open: boolean
  /** Called with the selected class id, or null to sort without a class. */
  onSelect: (classId: string | null) => void
  onClose: () => void
}) {
  const [classes, setClasses] = useState<PickerClass[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setClasses(null)
    setLoadError(null)
    let cancelled = false
    fetch('/api/classes')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((body) => {
        if (!cancelled) setClasses(body.classes ?? [])
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load classes. You can still sort without one.')
      })
    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) return null

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name || creating) return
    setCreating(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      // Select the new class straight away.
      onSelect(body.class.id)
    } catch {
      setCreateError('Could not create the class. Try again.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-card p-6 shadow-xl sm:p-8"
        role="dialog"
        aria-modal="true"
        aria-labelledby="class-picker-title"
      >
        <h2 id="class-picker-title" className="text-2xl font-extrabold text-ink">
          Who is sorting?
        </h2>
        <p className="mt-2 text-[15px] text-muted-foreground">
          Pick a class to recall their rules, or continue without one.
        </p>

        <div className="mt-4">
          {loadError ? (
            <p role="alert" className="text-sm font-bold text-coral-ink">
              {loadError}
            </p>
          ) : classes === null ? (
            <p className="text-sm text-muted-foreground">Loading classes…</p>
          ) : classes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No classes yet.</p>
          ) : (
            <ul className="space-y-2">
              {classes.map((cls) => (
                <li key={cls.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(cls.id)}
                    className={cn(
                      'w-full rounded-xl border-2 border-line bg-background px-4 py-3 text-left text-[16px] font-bold text-ink',
                      'transition-colors hover:border-sky-deep hover:bg-sky-soft'
                    )}
                  >
                    {cls.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-4 border-t-2 border-line pt-4">
          <label htmlFor="new-class-name" className="mb-1 block text-sm font-extrabold text-ink">
            New class
          </label>
          <div className="flex gap-2">
            <input
              id="new-class-name"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
              }}
              maxLength={100}
              placeholder="e.g. Period 2"
              className="min-w-0 flex-1 rounded-xl border-2 border-line bg-background px-3 py-2 text-[15px] text-ink outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-sky-deep"
            />
            <Button onClick={handleCreate} disabled={creating || newName.trim() === ''}>
              {creating ? 'Adding…' : 'Add'}
            </Button>
          </div>
          {createError && (
            <p role="alert" className="mt-2 text-sm font-bold text-coral-ink">
              {createError}
            </p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => onSelect(null)}>Continue without a class</Button>
        </div>
      </div>
    </div>
  )
}
