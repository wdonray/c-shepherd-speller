'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import BackLink from '@/components/BackLink'
import { CheckCircle2Icon } from 'lucide-react'
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
import { getList, updateList, notifyListsChanged } from '@/lib/lists-api'
import { generatePatternId, type WordList, type SpellingPattern } from '@/models/WordList'
import PatternEditor from './PatternEditor'
import { reportError } from '@/lib/report-error'
import { getErrorMessage, toastError } from '@/lib/error-toast'

/** How long to wait after the last edit before auto-saving. */
const SAVE_DEBOUNCE_MS = 500
/** How long the "Saved" confirmation stays visible. */
const SAVED_MESSAGE_MS = 2000

type SaveStatus = 'idle' | 'saving' | 'saved'
type LoadState = 'loading' | 'ready' | 'not-found' | 'error'

function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null
  return (
    <p aria-live="polite" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
      {status === 'saving' && 'Saving...'}
      {status === 'saved' && (
        <>
          <CheckCircle2Icon className="size-4 text-leaf-ink" aria-hidden="true" />
          Saved
        </>
      )}
    </p>
  )
}

function ListEditorSkeleton() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 px-4 py-8" role="status" aria-label="Loading list editor">
      <div className="h-6 w-24 animate-pulse rounded-lg bg-line/60" aria-hidden="true" />
      <div className="space-y-2" aria-hidden="true">
        <div className="h-10 w-2/3 animate-pulse rounded-xl bg-line/60" />
        <div className="h-5 w-24 animate-pulse rounded-lg bg-line/40" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2" aria-hidden="true">
        <div className="h-16 animate-pulse rounded-xl bg-line/40" />
        <div className="h-16 animate-pulse rounded-xl bg-line/40" />
      </div>
      <div className="h-64 animate-pulse rounded-[20px] bg-line/40" aria-hidden="true" />
    </div>
  )
}

/** Full-page editor for a single word list. All edits auto-save. */
export default function ListEditorPage({ listId }: { listId: string }) {
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [list, setList] = useState<WordList | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [deletePatternTarget, setDeletePatternTarget] = useState<SpellingPattern | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Latest list waiting for a debounced save; flushed on unmount. */
  const pendingSaveRef = useRef<WordList | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getList(listId)
        if (!cancelled) {
          setList(data)
          setLoadState('ready')
        }
      } catch (err) {
        reportError(err, { location: 'ListEditorPage.load' })
        if (!cancelled) {
          setLoadState(err instanceof Error && /not found/i.test(err.message) ? 'not-found' : 'error')
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [listId])

  // Flush any pending debounced save when leaving the page, and clear timers
  // so a stray save never fires after unmount.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      const pending = pendingSaveRef.current
      pendingSaveRef.current = null
      if (pending && pending.name.trim()) {
        updateList(pending.id, {
          name: pending.name,
          gradeLevel: pending.gradeLevel,
          patterns: pending.patterns,
        }).catch((error: unknown) => {
          // The page is gone; the save state can't be shown, but the
          // failure is still reported.
          reportError(error, { location: 'ListEditorPage.flushPendingSave' })
        })
      }
    }
  }, [])

  async function doSave(next: WordList): Promise<void> {
    pendingSaveRef.current = null
    if (savedTimerRef.current) {
      clearTimeout(savedTimerRef.current)
      savedTimerRef.current = null
    }
    // The API requires a non-empty name; skip the save and let the teacher
    // keep typing instead of flashing an error.
    if (!next.name.trim()) {
      setSaveStatus('idle')
      return
    }
    setSaveStatus('saving')
    try {
      await updateList(next.id, {
        name: next.name,
        gradeLevel: next.gradeLevel,
        patterns: next.patterns,
      })
      notifyListsChanged()
      setSaveStatus('saved')
      savedTimerRef.current = setTimeout(() => {
        setSaveStatus('idle')
      }, SAVED_MESSAGE_MS)
    } catch (error) {
      reportError(error, { location: 'ListEditorPage.doSave' })
      setSaveStatus('idle')
      toastError(getErrorMessage(error))
    }
  }

  function scheduleAutosave(next: WordList): void {
    pendingSaveRef.current = next
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void doSave(next)
    }, SAVE_DEBOUNCE_MS)
  }

  /** Apply a local edit and schedule its auto-save. */
  function applyChange(next: WordList): void {
    setList(next)
    scheduleAutosave(next)
  }

  const reload = async () => {
    setLoadState('loading')
    try {
      const data = await getList(listId)
      setList(data)
      setLoadState('ready')
    } catch (err) {
      reportError(err, { location: 'ListEditorPage.reload' })
      setLoadState(err instanceof Error && /not found/i.test(err.message) ? 'not-found' : 'error')
    }
  }

  if (loadState === 'loading') {
    return <ListEditorSkeleton />
  }

  if (loadState === 'not-found') {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold">List not found</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">This word list does not exist or was deleted.</p>
        <Button asChild className="mt-6">
          <Link href="/lists">Back to my lists</Link>
        </Button>
      </div>
    )
  }

  if (loadState === 'error' || !list) {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold">Could not load this list</h1>
        <p className="mt-2 text-[15px] text-muted-foreground">Check your connection and try again.</p>
        <Button onClick={reload} className="mt-6">
          Try again
        </Button>
      </div>
    )
  }

  // From here on, list is the loaded WordList, so the editor helpers below
  // need no null guards.
  const updatePattern = (patternId: string, updated: SpellingPattern) => {
    applyChange({
      ...list,
      patterns: list.patterns.map((p) => (p.id === patternId ? updated : p)),
    })
  }

  const addPattern = () => {
    const newPattern: SpellingPattern = {
      id: generatePatternId(),
      sound: '',
      pattern: '',
      frequency: 'common',
      words: [],
    }
    applyChange({ ...list, patterns: [...list.patterns, newPattern] })
  }

  const confirmDeletePattern = (target: SpellingPattern) => {
    applyChange({
      ...list,
      patterns: list.patterns.filter((p) => p.id !== target.id),
    })
    setDeletePatternTarget(null)
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6">
      <div className="flex items-center justify-between gap-4">
        <BackLink href="/lists">My lists</BackLink>
        <SaveIndicator status={saveStatus} />
      </div>

      <div>
        <h1 className="text-[32px] leading-tight font-bold">{list.name || 'Untitled list'}</h1>
        {list.gradeLevel && <p className="mt-1 text-sm font-bold text-sky-ink">Grade {list.gradeLevel}</p>}
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="min-w-60 flex-1 space-y-1.5">
          <Label htmlFor="list-name">List name</Label>
          <Input
            id="list-name"
            value={list.name}
            onChange={(e) => applyChange({ ...list, name: e.target.value })}
            maxLength={100}
          />
        </div>
        <div className="w-44 space-y-1.5">
          <Label htmlFor="list-grade">Grade level</Label>
          <Input
            id="list-grade"
            value={list.gradeLevel ?? ''}
            onChange={(e) => applyChange({ ...list, gradeLevel: e.target.value || undefined })}
            placeholder="e.g. 1"
            maxLength={20}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-[22px] font-bold">Spelling patterns ({list.patterns.length})</h2>
          <p className="text-sm text-muted-foreground">
            One column per spelling. Column width follows frequency: common spellings get the widest column.
          </p>
        </div>
        <Button onClick={addPattern} className="shrink-0">
          + Add a pattern
        </Button>
      </div>

      {list.patterns.length === 0 ? (
        <div className="rounded-[20px] border-2 border-line bg-card px-6 py-14 text-center">
          <h3 className="text-[22px] font-bold">No patterns yet</h3>
          <p className="mx-auto mt-2 max-w-md text-[15px] text-muted-foreground">
            Add your first pattern: the target sound, one spelling, and how common it is.
          </p>
          <Button onClick={addPattern} className="mt-6">
            Add a pattern
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {list.patterns.map((pattern) => (
            <PatternEditor
              key={pattern.id}
              pattern={pattern}
              onChange={(updated) => updatePattern(pattern.id, updated)}
              onRemove={() => setDeletePatternTarget(pattern)}
            />
          ))}
        </div>
      )}

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
    </div>
  )
}
