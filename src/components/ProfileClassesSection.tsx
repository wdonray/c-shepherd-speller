'use client'

import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Card, CardContent, CardDescription, CardHeader } from './ui/card'
import { resolveDefaultClassId } from '@/models/Class'
import { reportError } from '@/lib/report-error'
import { getErrorMessage, toastError } from '@/lib/error-toast'

interface ProfileClass {
  id: string
  name: string
}

/**
 * Classroom management on the profile page (issue #263). Lists the
 * teacher's classrooms, lets them set the default new lists inherit, and
 * creates new ones. A teacher with exactly one classroom gets it as the
 * default automatically.
 */
export default function ProfileClassesSection({ userId }: { userId: string }) {
  const [classes, setClasses] = useState<ProfileClass[] | null>(null)
  const [explicitDefault, setExplicitDefault] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [defaultError, setDefaultError] = useState<string | null>(null)

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
      setClasses((prev) => [...(prev ?? []), body.class])
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
              return (
                <li
                  key={cls.id}
                  className="flex items-center justify-between gap-3 rounded-xl border-2 border-line bg-background px-4 py-2.5"
                >
                  <span className="text-[15px] font-bold text-ink">
                    {cls.name}
                    {isDefault && (
                      <span className="ml-2 rounded-full bg-sky-soft px-2 py-0.5 text-xs font-extrabold text-sky-ink">
                        Default
                      </span>
                    )}
                  </span>
                  {!isDefault && (
                    <Button variant="ghost" size="sm" onClick={() => handleSetDefault(cls.id)}>
                      Set as default
                    </Button>
                  )}
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
        {explicitDefault !== null && (classes?.length ?? 0) > 1 && (
          <Button variant="ghost" size="sm" onClick={() => handleSetDefault(null)}>
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
    </Card>
  )
}
