'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PlusIcon } from 'lucide-react'
import { getLists, createList, deleteList, notifyListsChanged } from '@/lib/lists-api'
import { logActivity } from '@/lib/activity'
import { trackEvent } from '@/lib/track-event'
import { type WordList } from '@/models/WordList'
import { reportError } from '@/lib/report-error'
import { getErrorMessage, toastError } from '@/lib/error-toast'
import WordListCard from './WordListCard'
import { OddDuck } from './OddDuck'

/**
 * List-of-lists overview for the spelling manager drawer. Editing a single
 * list happens on its own page (/lists/[id]); this component navigates there.
 */
export default function PatternListsManager({ onNavigate }: { onNavigate?: () => void } = {}) {
  const router = useRouter()
  const [lists, setLists] = useState<WordList[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGrade, setNewGrade] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteListTarget, setDeleteListTarget] = useState<WordList | null>(null)
  const [deletingList, setDeletingList] = useState(false)

  // Clear the create form whenever its dialog closes.
  useEffect(() => {
    if (!isCreating) {
      setNewName('')
      setNewGrade('')
    }
  }, [isCreating])

  const loadLists = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      const data = await getLists()
      setLists(data)
    } catch (error) {
      reportError(error, { location: 'PatternListsManager.loadLists' })
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLists()
  }, [loadLists])

  const openList = useCallback(
    (list: WordList) => {
      // The drawer closes first so the full-page editor opens clean.
      onNavigate?.()
      router.push(`/lists/${encodeURIComponent(list.id)}`)
    },
    [onNavigate, router]
  )

  const handleCreate = async () => {
    // The Create button is disabled while the name is empty or a create is
    // in flight, so this only runs for a valid submission.
    setCreating(true)
    try {
      const list = await createList({
        name: newName.trim(),
        gradeLevel: newGrade.trim() || undefined,
        patterns: [],
      })
      setLists((prev) => [list, ...prev])
      logActivity('created', list.name)
      trackEvent('list-created')
      notifyListsChanged()
      setIsCreating(false)
      openList(list)
    } catch (error) {
      reportError(error, { location: 'PatternListsManager.handleCreate' })
      setIsCreating(false)
      toastError(getErrorMessage(error))
    } finally {
      setCreating(false)
    }
  }

  const confirmDeleteList = async (target: WordList) => {
    // The Delete button is disabled while a delete is in flight.
    setDeletingList(true)
    try {
      await deleteList(target.id)
      setLists((prev) => prev.filter((l) => l.id !== target.id))
      notifyListsChanged()
    } catch (error) {
      reportError(error, { location: 'PatternListsManager.confirmDeleteList' })
      toastError(getErrorMessage(error))
    } finally {
      setDeletingList(false)
      setDeleteListTarget(null)
    }
  }

  const deleteListWordCount = deleteListTarget ? deleteListTarget.patterns.reduce((n, p) => n + p.words.length, 0) : 0

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading word lists" aria-busy="true">
        {/* Header: matches loaded (h3 + New list button) */}
        <div className="flex items-center justify-between gap-3" aria-hidden="true">
          <div className="h-7 w-48 animate-pulse rounded-lg bg-line/60" />
          <div className="h-10 w-28 animate-pulse rounded-2xl bg-line/60" />
        </div>
        {/* List cards: match WordListCard structure */}
        <div className="grid gap-4" aria-hidden="true">
          {[0, 1].map((i) => (
            <div key={i} className="overflow-hidden rounded-[20px] border-2 border-line bg-card">
              <div className="h-2 w-full animate-pulse bg-line/60" />
              <div className="flex flex-col gap-3 p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="h-7 w-40 animate-pulse rounded-lg bg-line/60" />
                  <div className="h-6 w-20 animate-pulse rounded-full bg-line/40" />
                </div>
                <div className="h-5 w-64 animate-pulse rounded-lg bg-line/40" />
                <div className="space-y-2">
                  <div className="h-5 w-full animate-pulse rounded-lg bg-line/40" />
                  <div className="h-5 w-5/6 animate-pulse rounded-lg bg-line/40" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // List overview
  return (
    <div className="space-y-4">
      {loadError ? (
        <div className="rounded-[20px] border-2 border-line bg-card p-10 text-center">
          <p className="text-xl font-bold">Could not load your lists</p>
          <p className="mt-2 text-[15px] text-muted-foreground">Check your connection and try again.</p>
          <Button onClick={loadLists} className="mt-6">
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-xl font-bold">My word lists ({lists.length})</h3>
            {lists.length > 0 && (
              <Button onClick={() => setIsCreating(true)}>
                <PlusIcon className="size-4" />
                New list
              </Button>
            )}
          </div>

          {lists.length === 0 ? (
            <div className="rounded-[20px] border-2 border-line bg-card p-10 text-center">
              <p className="text-xl font-bold">No word lists yet</p>
              <p className="mt-2 text-[15px] text-muted-foreground">
                Create your first list to organize words by spelling pattern.
              </p>
              <Button onClick={() => setIsCreating(true)} className="mt-6">
                <PlusIcon className="size-4" />
                New list
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {lists.map((list) => (
                <WordListCard
                  key={list.id}
                  list={list}
                  onOpen={openList}
                  onDelete={setDeleteListTarget}
                  primaryLabel="Edit list"
                />
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New word list</DialogTitle>
            <DialogDescription>Name it for the sound and week you are teaching.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-list-name">List name</Label>
              <Input
                id="new-list-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Week 7: Long O"
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new-list-grade">Grade level (optional)</Label>
              <Input
                id="new-list-grade"
                value={newGrade}
                onChange={(e) => setNewGrade(e.target.value)}
                placeholder="e.g. 1"
                maxLength={20}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreating(false)} disabled={creating}>
              Cancel
            </Button>
            <Button onClick={() => handleCreate()} disabled={!newName.trim() || creating}>
              {creating ? 'Creating...' : 'Create list'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteListTarget !== null} onOpenChange={() => setDeleteListTarget(null)}>
        {deleteListTarget && (
          <DialogContent className="border-2 border-coral">
            <div className="flex items-start gap-4">
              <OddDuck className="size-14 shrink-0 text-plum" label="Odd duck illustration" />
              <DialogHeader className="text-left">
                <DialogTitle>Delete this list?</DialogTitle>
                <DialogDescription>
                  {`Delete "${deleteListTarget.name}" with its ${deleteListTarget.patterns.length} ${deleteListTarget.patterns.length === 1 ? 'pattern' : 'patterns'} and ${deleteListWordCount} ${deleteListWordCount === 1 ? 'word' : 'words'}? This cannot be undone.`}
                </DialogDescription>
              </DialogHeader>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteListTarget(null)} disabled={deletingList}>
                Keep it
              </Button>
              <Button variant="destructive" onClick={() => confirmDeleteList(deleteListTarget)} disabled={deletingList}>
                {deletingList ? 'Deleting...' : 'Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
