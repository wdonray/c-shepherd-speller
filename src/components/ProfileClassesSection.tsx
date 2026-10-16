'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardDescription, CardHeader } from './ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog'
import { resolveDefaultClassId, describeClassroomAttachments, type ClassDeletionInfo } from '@/models/Class'
import { reportError } from '@/lib/report-error'

interface ProfileClass {
  id: string
  name: string
  deletion?: ClassDeletionInfo
}

/** Fail-closed deletion info for a class the server did not annotate. */
const UNKNOWN_DELETION: ClassDeletionInfo = {
  ruleCount: 0,
  assignedListCount: 0,
  studentCount: 0,
  canDelete: false,
}

/** A freshly created classroom is empty, so it can be deleted. */
const EMPTY_DELETION: ClassDeletionInfo = {
  ruleCount: 0,
  assignedListCount: 0,
  studentCount: 0,
  canDelete: true,
}

/**
 * Refresh one row's deletion info after the server reports a block
 * (issue #309). Pure and exported for tests.
 */
export function applyDeletionInfo(
  prev: ProfileClass[] | null,
  classId: string,
  deletion: ClassDeletionInfo
): ProfileClass[] | null {
  if (prev === null) return prev
  return prev.map((cls) => (cls.id === classId ? { ...cls, deletion } : cls))
}

/**
 * Remove a classroom from the list after a successful delete (issue #309).
 * Pure and exported for tests.
 */
export function removeClassroom(prev: ProfileClass[] | null, classId: string): ProfileClass[] | null {
  if (prev === null) return prev
  return prev.filter((cls) => cls.id !== classId)
}

/**
 * Explain why a classroom cannot be deleted, e.g.
 * "Cannot delete: 2 saved rules, assigned to 1 word list."
 */
export function deletionBlockReason(deletion: ClassDeletionInfo): string {
  const attachments = describeClassroomAttachments(deletion)
  return attachments ? `Cannot delete: ${attachments}.` : 'Cannot delete this classroom right now.'
}

/**
 * Classroom management on the profile page (issue #263). Lists the
 * teacher's classrooms, lets them set the default new lists inherit,
 * creates new ones, and deletes empty ones (issue #309).
 *
 * Deletion follows Donray's decision (2026-10-15): a classroom with saved
 * rules, assigned lists, or students cannot be deleted. The Delete button
 * is disabled while anything is attached and the row explains what is
 * attached. Only an empty, unassigned classroom can be deleted, after a
 * confirmation dialog.
 */
export default function ProfileClassesSection({ userId }: { userId: string }) {
  const [classes, setClasses] = useState<ProfileClass[] | null>(null)
  const [explicitDefault, setExplicitDefault] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [defaultError, setDefaultError] = useState<string | null>(null)
  /** A default-class save is in flight; selections are locked until it lands. */
  const [savingDefault, setSavingDefault] = useState(false)
  /** The classroom awaiting delete confirmation. */
  const [deleteTarget, setDeleteTarget] = useState<ProfileClass | null>(null)
  /** The classroom ID of the delete in flight; buttons lock until it lands. */
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([
      fetch('/api/classes').then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      }),
      fetch(`/api/users/${encodeURIComponent(userId)}`).then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      }),
    ])
      .then(([classesBody, userBody]) => {
        if (cancelled) return
        setClasses(classesBody.classes ?? [])
        setExplicitDefault(userBody.user?.defaultClassId ?? null)
      })
      .catch(() => {
        if (!cancelled) setLoadError('Could not load classrooms.')
      })
    return () => {
      cancelled = true
    }
  }, [userId])

  const effectiveDefault = resolveDefaultClassId({ defaultClassId: explicitDefault }, classes ?? [])
  const autoDefault = effectiveDefault !== null && explicitDefault !== effectiveDefault

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
      setClasses((prev) => [...(prev ?? []), { ...body.class, deletion: body.class.deletion ?? EMPTY_DELETION }])
      setNewName('')
    } catch (error) {
      setCreateError('Could not create the classroom. Try again.')
      reportError(error, { location: 'ProfileClassesSection.handleCreate' })
    } finally {
      setSaving(false)
    }
  }

  const handleSetDefault = async (classId: string | null) => {
    setDefaultError(null)
    const prev = explicitDefault
    setExplicitDefault(classId)
    setSavingDefault(true)
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultClassId: classId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    } catch (error) {
      setExplicitDefault(prev)
      setDefaultError('Could not save the default classroom. Try again.')
      reportError(error, { location: 'ProfileClassesSection.handleSetDefault' })
    } finally {
      setSavingDefault(false)
    }
  }

  const handleConfirmDelete = async (target: ProfileClass) => {
    // The Delete button is disabled while a delete is in flight.
    setDeletingId(target.id)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/classes/${encodeURIComponent(target.id)}`, { method: 'DELETE' })
      if (res.status === 409) {
        // Blocked: something was attached after the page loaded (for example
        // a rule saved in another tab). Refresh the row's deletion info and
        // explain what is attached.
        const body = (await res.json()) as { deletion?: ClassDeletionInfo }
        const deletion = body.deletion ?? UNKNOWN_DELETION
        setClasses((prev) => applyDeletionInfo(prev, target.id, deletion))
        const attachments = describeClassroomAttachments(deletion)
        setDeleteError(
          attachments
            ? `Could not delete "${target.name}". It has ${attachments}.`
            : `Could not delete "${target.name}".`
        )
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const body = (await res.json()) as { defaultCleared?: boolean }
      setClasses((prev) => removeClassroom(prev, target.id))
      if (body.defaultCleared) setExplicitDefault(null)
    } catch (error) {
      setDeleteError(`Could not delete "${target.name}". Try again.`)
      reportError(error, { location: 'ProfileClassesSection.handleConfirmDelete' })
    } finally {
      setDeletingId(null)
      setDeleteTarget(null)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-bold text-ink">Classrooms</h3>
        <CardDescription>
          New word lists inherit your default classroom.{' '}
          {autoDefault && 'With one classroom, it is the default automatically.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loadError ? (
          <p role="alert" className="text-sm font-bold text-coral-ink">
            {loadError}
          </p>
        ) : classes === null ? (
          <p className="text-sm text-muted-foreground">Loading classrooms…</p>
        ) : classes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No classrooms yet. Create one below.</p>
        ) : (
          <ul className="space-y-2">
            {classes.map((cls) => {
              const isDefault = effectiveDefault === cls.id
              const deletion = cls.deletion ?? UNKNOWN_DELETION
              const blockReason = deletion.canDelete ? null : deletionBlockReason(deletion)
              return (
                <li
                  key={cls.id}
                  className="flex items-center justify-between gap-3 rounded-xl border-2 border-line bg-background px-4 py-2.5"
                >
                  <div className="min-w-0">
                    <span className="text-[15px] font-bold text-ink">
                      {cls.name}
                      {isDefault && (
                        <span className="ml-2 rounded-full bg-sky-soft px-2 py-0.5 text-xs font-extrabold text-sky-ink">
                          Default
                        </span>
                      )}
                    </span>
                    {blockReason && (
                      <p id={`delete-block-${cls.id}`} className="mt-0.5 text-xs text-muted-foreground">
                        {blockReason}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {!isDefault && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleSetDefault(cls.id)}
                        disabled={savingDefault}
                      >
                        Set as default
                      </Button>
                    )}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(cls)}
                      disabled={!deletion.canDelete || deletingId !== null}
                      aria-describedby={blockReason ? `delete-block-${cls.id}` : undefined}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {defaultError && (
          <p role="alert" className="text-sm font-bold text-coral-ink">
            {defaultError}
          </p>
        )}
        {deleteError && (
          <p role="alert" className="text-sm font-bold text-coral-ink">
            {deleteError}
          </p>
        )}
        {classes !== null && explicitDefault !== null && classes.length > 1 && (
          <Button variant="ghost" size="sm" onClick={() => handleSetDefault(null)} disabled={savingDefault}>
            Clear default
          </Button>
        )}
        <div className="space-y-1.5 border-t-2 border-line pt-4">
          <Label htmlFor="profile-new-class">New classroom</Label>
          <div className="flex gap-2">
            <Input
              id="profile-new-class"
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
        </div>
      </CardContent>

      <Dialog open={deleteTarget !== null} onOpenChange={() => setDeleteTarget(null)}>
        {deleteTarget && (
          <DialogContent className="border-2 border-coral">
            <div className="flex items-start gap-4">
              <AlertTriangle className="size-14 shrink-0 text-destructive" aria-hidden="true" />
              <DialogHeader className="text-left">
                <DialogTitle>Delete this classroom?</DialogTitle>
                <DialogDescription>
                  {`Delete "${deleteTarget.name}"? The classroom is empty. This cannot be undone.`}
                </DialogDescription>
              </DialogHeader>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deletingId !== null}>
                Keep it
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleConfirmDelete(deleteTarget)}
                disabled={deletingId !== null}
              >
                {deletingId !== null ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </Card>
  )
}
