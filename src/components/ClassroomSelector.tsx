'use client'

import { useEffect, useState } from 'react'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { Button } from './ui/button'

export interface SelectorClass {
  id: string
  name: string
}

const NEW_CLASS_VALUE = '__new__'

/**
 * Classroom picker for the list level (issue #263). The teacher assigns a
 * classroom to the list once, at planning time; it flows down silently to
 * present and sort. Includes inline class creation so the old sort-entry
 * picker is not needed.
 */
export default function ClassroomSelector({
  value,
  onChange,
  id = 'list-classroom',
}: {
  /** The list's class id, or null/undefined for "No class". */
  value: string | null | undefined
  /** Called with the new class id, or null for "No class". */
  onChange: (classId: string | null) => void
  id?: string
}) {
  const [classes, setClasses] = useState<SelectorClass[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
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
        if (!cancelled) setLoadError('Could not load classrooms.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const handleSelect = (next: string) => {
    setCreateError(null)
    if (next === NEW_CLASS_VALUE) {
      setCreating(true)
      return
    }
    setCreating(false)
    onChange(next === '' ? null : next)
  }

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name || saving) return
    setSaving(true)
    setCreateError(null)
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = await res.json()
      const created: SelectorClass = body.class
      setClasses((prev) => [...(prev ?? []), created])
      setNewName('')
      setCreating(false)
      onChange(created.id)
    } catch {
      setCreateError('Could not create the classroom. Try again.')
    } finally {
      setSaving(false)
    }
  }

  // The select shows the stored value when it matches a loaded class;
  // otherwise it falls back to "No class" (e.g. the class was deleted).
  const selectValue = creating ? NEW_CLASS_VALUE : classes?.some((c) => c.id === value) ? (value as string) : ''

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Classroom</Label>
      {loadError ? (
        <p role="alert" className="text-sm font-bold text-coral-ink">
          {loadError}
        </p>
      ) : (
        <select
          id={id}
          value={selectValue}
          onChange={(e) => handleSelect(e.target.value)}
          disabled={classes === null}
          className="h-11 w-full rounded-xl border-2 border-line bg-background px-3 text-[15px] font-bold text-ink outline-none transition-colors focus:border-sky-deep disabled:opacity-60"
        >
          <option value="">No class</option>
          {(classes ?? []).map((cls) => (
            <option key={cls.id} value={cls.id}>
              {cls.name}
            </option>
          ))}
          <option value={NEW_CLASS_VALUE}>+ New classroom…</option>
        </select>
      )}
      {creating && (
        <div className="space-y-1.5 rounded-xl border-2 border-line bg-card p-3">
          <Label htmlFor={`${id}-new-name`}>New classroom name</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id={`${id}-new-name`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
              }}
              maxLength={100}
              placeholder="e.g. Period 2"
            />
            <Button onClick={handleCreate} disabled={saving || newName.trim() === ''}>
              {saving ? 'Adding…' : 'Add'}
            </Button>
          </div>
          {createError && (
            <p role="alert" className="text-sm font-bold text-coral-ink">
              {createError}
            </p>
          )}
          <Button variant="ghost" size="sm" onClick={() => setCreating(false)} disabled={saving}>
            Cancel
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Rules are saved for this classroom and recalled on the present chart.
      </p>
    </div>
  )
}
