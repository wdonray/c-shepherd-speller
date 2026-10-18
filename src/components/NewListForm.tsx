'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createList, notifyListsChanged } from '@/lib/lists-api'
import { logActivity } from '@/lib/activity'
import { trackEvent } from '@/lib/track-event'
import { reportError } from '@/lib/report-error'
import { getErrorMessage } from '@/lib/error-toast'
import BackBreadcrumb from './BackBreadcrumb'

/**
 * Dedicated new-list form, rendered as the full /lists/new page.
 * On success the teacher lands directly in the new list's editor.
 */
export default function NewListForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [gradeLevel, setGradeLevel] = useState('')
  const [week, setWeek] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // The teacher's default classroom, inherited by the new list (issue #263).
  // Null/absent means "No class". Loaded once; a slow load never blocks create.
  const [defaultClassId, setDefaultClassId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/classes/default')
      .then((res) => (res.ok ? res.json() : { defaultClassId: null }))
      .then((body) => {
        if (!cancelled && typeof body.defaultClassId === 'string') setDefaultClassId(body.defaultClassId)
      })
      .catch(() => {
        // A missing default must not block list creation.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const canSubmit = name.trim().length > 0 && !creating

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setCreating(true)
    setError(null)
    try {
      const list = await createList({
        name: name.trim(),
        gradeLevel: gradeLevel.trim() || undefined,
        week: week.trim() || undefined,
        ...(defaultClassId ? { classId: defaultClassId } : {}),
        patterns: [],
      })
      logActivity('created', list.name, list.id)
      trackEvent('list-created')
      notifyListsChanged()
      router.push(`/lists/${encodeURIComponent(list.id)}`)
    } catch (err) {
      reportError(err, { location: 'NewListForm.handleSubmit' })
      setError(getErrorMessage(err))
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <BackBreadcrumb href="/lists" label="My spelling lists" />
      <div className="mt-2 space-y-1">
        <h1 className="text-3xl font-bold">New word list</h1>
        <p className="text-[15px] text-muted-foreground">Name it for the sound and week you are teaching.</p>
      </div>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="new-list-name">List name</Label>
          <Input
            id="new-list-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Week 7: Long O"
            maxLength={100}
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-list-grade">Grade level (optional)</Label>
          <Input
            id="new-list-grade"
            value={gradeLevel}
            onChange={(e) => setGradeLevel(e.target.value)}
            placeholder="e.g. 1"
            maxLength={20}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="new-list-week">Week (optional)</Label>
          <Input
            id="new-list-week"
            value={week}
            onChange={(e) => setWeek(e.target.value)}
            placeholder="e.g. 5"
            maxLength={20}
          />
        </div>
        {error && (
          <p role="alert" className="text-[15px] font-medium text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="ghost" onClick={() => router.push('/lists')} disabled={creating}>
            Cancel
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {creating ? 'Creating...' : 'Create list'}
          </Button>
        </div>
      </form>
    </div>
  )
}
