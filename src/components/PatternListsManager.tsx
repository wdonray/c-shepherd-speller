'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { PlusIcon, ChevronLeftIcon, XIcon } from 'lucide-react'
import { getLists, createList, updateList, deleteList, notifyListsChanged } from '@/lib/lists-api'
import { logActivity } from '@/lib/activity'
import { trackEvent } from '@/lib/track-event'
import { generatePatternId, type WordList, type SpellingPattern } from '@/models/WordList'
import { cn } from '@/lib/utils'
import WordListCard from './WordListCard'
import PatternEditor from './PatternEditor'
import { OddDuck } from './OddDuck'

function ErrorToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div
      role="alert"
      className="fixed bottom-6 left-1/2 z-[100] flex w-[calc(100%-3rem)] max-w-xl -translate-x-1/2 items-center gap-3 rounded-2xl border-2 border-coral bg-coral-soft px-5 py-4"
    >
      <p className="flex-1 text-[15px] font-semibold text-coral-ink">{message}</p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="cursor-pointer rounded-full p-1 text-coral-ink outline-none hover:bg-card hover:text-destructive focus-visible:bg-card focus-visible:text-destructive focus-visible:ring-[3px] focus-visible:ring-ring/60"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  )
}

/** Main manager for pattern-based word lists: overview, editor, create and delete flows. */
export default function PatternListsManager() {
  const [lists, setLists] = useState<WordList[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [editingList, setEditingList] = useState<WordList | null>(null)
  const [savedList, setSavedList] = useState<WordList | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [newGrade, setNewGrade] = useState('')
  const [creating, setCreating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteListTarget, setDeleteListTarget] = useState<WordList | null>(null)
  const [deletingList, setDeletingList] = useState(false)
  const [deletePatternTarget, setDeletePatternTarget] = useState<SpellingPattern | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(timer)
  }, [toast])

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
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLists()
  }, [loadLists])

  const openEditor = (list: WordList) => {
    setEditingList(list)
    setSavedList(list)
  }

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
      openEditor(list)
    } catch {
      setIsCreating(false)
      showToast('Could not create the list. Check your connection and try again.')
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
    } catch {
      showToast('Could not delete the list. Check your connection and try again.')
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

  // Editing a single list. editingList is narrowed to WordList from here on,
  // so the editor helpers below need no null guards.
  if (editingList) {
    const dirty = JSON.stringify(editingList) !== JSON.stringify(savedList)

    const addPattern = () => {
      const newPattern: SpellingPattern = {
        id: generatePatternId(),
        sound: '',
        pattern: '',
        frequency: 'common',
        words: [],
      }
      setEditingList({ ...editingList, patterns: [...editingList.patterns, newPattern] })
    }

    const updatePattern = (patternId: string, updated: SpellingPattern) => {
      setEditingList({
        ...editingList,
        patterns: editingList.patterns.map((p) => (p.id === patternId ? updated : p)),
      })
    }

    const revertEdits = () => {
      setEditingList(savedList)
    }

    const handleSave = async () => {
      // The Save button is disabled unless there are unsaved changes and no
      // save is in flight.
      setSaving(true)
      try {
        const updated = await updateList(editingList.id, {
          name: editingList.name,
          gradeLevel: editingList.gradeLevel,
          patterns: editingList.patterns,
        })
        setLists((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
        notifyListsChanged()
        setEditingList(updated)
        setSavedList(updated)
      } catch {
        showToast('Could not save. Check your connection and try again.')
      } finally {
        setSaving(false)
      }
    }

    const confirmDeletePattern = (target: SpellingPattern) => {
      setEditingList({
        ...editingList,
        patterns: editingList.patterns.filter((p) => p.id !== target.id),
      })
      setDeletePatternTarget(null)
    }

    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setEditingList(null)}
          className="cursor-pointer text-[15px] font-semibold text-sky-ink outline-none hover:underline focus-visible:underline focus-visible:ring-[3px] focus-visible:ring-ring/60"
        >
          <ChevronLeftIcon className="mr-1 inline size-4" aria-hidden="true" />
          My lists
        </button>

        <div>
          <h2 className="text-[32px] leading-tight font-bold">{editingList.name || 'Untitled list'}</h2>
          {editingList.gradeLevel && (
            <p className="mt-1 text-sm font-bold text-sky-ink">Grade {editingList.gradeLevel}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="min-w-60 flex-1 space-y-1.5">
            <Label htmlFor="list-name">List name</Label>
            <Input
              id="list-name"
              value={editingList.name}
              onChange={(e) => setEditingList({ ...editingList, name: e.target.value })}
              maxLength={100}
            />
          </div>
          <div className="w-44 space-y-1.5">
            <Label htmlFor="list-grade">Grade level</Label>
            <Input
              id="list-grade"
              value={editingList.gradeLevel ?? ''}
              onChange={(e) => setEditingList({ ...editingList, gradeLevel: e.target.value || undefined })}
              placeholder="e.g. 1"
              maxLength={20}
            />
          </div>
        </div>

        <div className="space-y-2">
          <h3 className="text-[22px] font-bold">Spelling patterns ({editingList.patterns.length})</h3>
          <p className="text-sm text-muted-foreground">
            One column per spelling. Column width follows frequency: common spellings get the widest column.
          </p>
        </div>

        {editingList.patterns.length === 0 ? (
          <div className="rounded-[20px] border-2 border-line bg-card px-6 py-14 text-center">
            <h4 className="text-[22px] font-bold">No patterns yet</h4>
            <p className="mx-auto mt-2 max-w-md text-[15px] text-muted-foreground">
              Add your first pattern: the target sound, one spelling, and how common it is.
            </p>
            <Button onClick={addPattern} className="mt-6">
              Add a pattern
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {editingList.patterns.map((pattern) => (
              <PatternEditor
                key={pattern.id}
                pattern={pattern}
                onChange={(updated) => updatePattern(pattern.id, updated)}
                onRemove={() => setDeletePatternTarget(pattern)}
              />
            ))}
          </div>
        )}

        {editingList.patterns.length > 0 && (
          <button
            type="button"
            onClick={addPattern}
            className="w-full cursor-pointer rounded-2xl border-2 border-leaf bg-leaf-soft py-4 text-[17px] font-bold text-leaf-ink outline-none transition hover:brightness-95 focus-visible:brightness-95 focus-visible:ring-[3px] focus-visible:ring-ring/60"
          >
            + Add a pattern
          </button>
        )}

        <div className="sticky bottom-0 -mx-4 -mb-4 flex flex-wrap items-center gap-3 rounded-t-[20px] border-2 border-b-0 border-line bg-card p-4">
          <p className={cn('flex-1 text-[15px] font-semibold', !dirty && 'text-muted-foreground')}>
            {dirty ? 'Unsaved changes' : 'No unsaved changes'}
          </p>
          <Button variant="secondary" onClick={revertEdits} disabled={!dirty || saving}>
            Cancel
          </Button>
          <Button onClick={() => handleSave()} disabled={!dirty || saving || !editingList.name.trim()}>
            {saving ? 'Saving...' : 'Save list'}
          </Button>
        </div>

        <Dialog open={deletePatternTarget !== null} onOpenChange={() => setDeletePatternTarget(null)}>
          {deletePatternTarget && (
            <DialogContent className="border-2 border-coral">
              <div className="flex items-center gap-4">
                <span className="rounded-xl border-2 border-leaf bg-leaf-soft px-4 py-2 text-lg font-bold text-leaf-ink">
                  {deletePatternTarget.pattern || 'untitled'}
                </span>
                <DialogHeader className="text-left">
                  <DialogTitle>Delete this pattern?</DialogTitle>
                </DialogHeader>
              </div>
              <DialogDescription>
                {`Delete "${deletePatternTarget.pattern || 'untitled'}" with its ${deletePatternTarget.words.length} ${deletePatternTarget.words.length === 1 ? 'word' : 'words'}? This cannot be undone. The rest of the list is untouched.`}
              </DialogDescription>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDeletePatternTarget(null)}>
                  Keep it
                </Button>
                <Button variant="destructive" onClick={() => confirmDeletePattern(deletePatternTarget)}>
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          )}
        </Dialog>

        {toast && <ErrorToast message={toast} onDismiss={() => setToast(null)} />}
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
                  onOpen={openEditor}
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

      {toast && <ErrorToast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  )
}
