'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
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
import { logActivity } from '@/lib/activity'
import {
  generatePatternId,
  isPatternComplete,
  resolveListColor,
  type ListColor,
  type WordList,
  type SpellingPattern,
} from '@/models/WordList'
import { useUnsavedChangesGuard, type LeaveTarget } from '@/lib/use-unsaved-changes-guard'
import PatternEditor from './PatternEditor'
import ListColorPicker from './ListColorPicker'
import ClassroomSelector from './ClassroomSelector'
import { reportError } from '@/lib/report-error'
import { getErrorMessage, toastError } from '@/lib/error-toast'

/** How long to wait after the last edit before auto-saving. */
const SAVE_DEBOUNCE_MS = 500
/** How long the "Saved" confirmation stays visible. */
const SAVED_MESSAGE_MS = 2000
/** How long the bottom "Add a pattern" button's shift animation runs. */
const BUTTON_SHIFT_MS = 300

/**
 * Patterns safe to persist: every complete pattern, plus any pre-existing
 * pattern (one the teacher may be mid-edit on). Newly added patterns that
 * are still missing required fields are held back until complete.
 */
function saveablePatterns(patterns: SpellingPattern[], unsavedIds: ReadonlySet<string>): SpellingPattern[] {
  return patterns.filter((p) => isPatternComplete(p) || !unsavedIds.has(p.id))
}

/**
 * True when every pattern in a save payload is complete and the payload can
 * go to the API. A pre-existing pattern the teacher is mid-edit on (a
 * required field cleared while retyping) is not valid yet, so the save must
 * wait instead of sending a payload the API will reject.
 */
function isPayloadSaveable(patterns: SpellingPattern[]): boolean {
  return patterns.every((p) => isPatternComplete(p))
}

type SaveStatus = 'idle' | 'saving' | 'saved'
type LoadState = 'loading' | 'ready' | 'not-found' | 'error'

function SaveIndicator({ status, isDirty }: { status: SaveStatus; isDirty: boolean }) {
  if (status === 'saving') {
    return (
      <p aria-live="polite" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        Saving...
      </p>
    )
  }
  if (isDirty) {
    return (
      <p aria-live="polite" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-amber-500" />
        Unsaved changes
      </p>
    )
  }
  if (status === 'saved') {
    return (
      <p aria-live="polite" className="flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <CheckCircle2Icon className="size-4 text-leaf-ink" aria-hidden="true" />
        Saved
      </p>
    )
  }
  return null
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
  const router = useRouter()
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [list, setList] = useState<WordList | null>(null)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [deletePatternTarget, setDeletePatternTarget] = useState<SpellingPattern | null>(null)
  const [leaveTarget, setLeaveTarget] = useState<LeaveTarget | null>(null)
  /** A debounced save is armed but has not run yet. */
  const [hasPendingSave, setHasPendingSave] = useState(false)
  /** Patterns added this session that are still incomplete and local-only. */
  const [localOnlyCount, setLocalOnlyCount] = useState(0)
  /** The last save attempt failed; the edits are still unsaved. */
  const [saveFailed, setSaveFailed] = useState(false)
  /**
   * Ids of patterns with edits not yet confirmed saved. Drives each pattern
   * card's "Unsaved" badge, so the teacher can see which pattern is still
   * unsaved after blurring away from it. Cleared per pattern when a save
   * confirms the edit persisted.
   */
  const [unsavedPatternIds, setUnsavedPatternIds] = useState<ReadonlySet<string>>(new Set())
  /**
   * The list's classroom rules by pattern text, for the Rules section.
   * Null when the list has no classroom (unscoped pattern rules apply).
   */
  const [classRules, setClassRules] = useState<Record<string, string> | null>(null)
  /** The classroom's display name, for the Rules section. */
  const [className, setClassName] = useState<string | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  /** Latest list waiting for a debounced save; flushed on unmount. */
  const pendingSaveRef = useRef<WordList | null>(null)
  /** Sequence for classroom saves; only the latest may commit or revert. */
  const classroomSaveSeqRef = useRef(0)
  /** Chain of save promises; content and classroom saves run sequentially. */
  const saveChainRef = useRef<Promise<void>>(Promise.resolve())
  /** Last classroom id confirmed persisted; revert target on failure. */
  const persistedClassIdRef = useRef<string | null>(null)
  /** Whether this editor visit already logged an "edited" activity event. */
  const editLoggedRef = useRef(false)
  /**
   * Id of the pattern added most recently, waiting for its card to mount so
   * it can be scrolled into view. Cleared the moment the scroll fires.
   */
  const pendingScrollIdRef = useRef<string | null>(null)
  /**
   * Ids of patterns added in this session that have never been complete.
   * They stay local-only until the teacher fills the required fields; the
   * save payload filters them out so a half-typed pattern is never persisted
   * (and never trips API validation).
   */
  const unsavedPatternIdsRef = useRef<Set<string>>(new Set())
  /**
   * Wrapper around the bottom "Add a pattern" button, rendered below the
   * pattern list. Adding a pattern inserts a new card above it, pushing it
   * down; the wrapper's position is measured before and after so the shift
   * can be animated (see the layout effect below).
   */
  const bottomButtonRef = useRef<HTMLDivElement>(null)
  /**
   * Bottom button wrapper plus its document-relative Y, captured in
   * addPattern before the new card shifts the button down. Consumed by the
   * layout effect after commit; null when no add just happened (initial
   * load, deletions, and other edits never animate). Null when there is no
   * bottom button yet (empty list).
   */
  const bottomButtonShiftRef = useRef<{ el: HTMLDivElement; y: number } | null>(null)
  /** In-flight shift animation on the bottom button wrapper, if any. */
  const bottomButtonAnimationRef = useRef<Animation | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getList(listId)
        if (!cancelled) {
          setList(data)
          persistedClassIdRef.current = data.classId ?? null
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

  // Load the list's classroom (name + rules) for the per-pattern rule editor
  // whenever the classroom assignment changes. Null clears back to unscoped
  // rules.
  useEffect(() => {
    const classId = list?.classId
    if (!classId) {
      setClassRules(null)
      setClassName(null)
      return
    }
    let cancelled = false
    fetch(`/api/classes/${encodeURIComponent(classId)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((body) => {
        if (cancelled) return
        const rules: Record<string, string> = {}
        for (const [patternText, rule] of Object.entries(body.class.rules ?? {})) {
          rules[patternText] = (rule as { rule: string }).rule
        }
        setClassRules(rules)
        setClassName(body.class.name)
      })
      .catch((error) => {
        if (!cancelled) {
          reportError(error, { location: 'ListEditorPage.loadClass' })
          setClassRules(null)
          setClassName(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [list?.classId])

  // Flush any pending debounced save when leaving the page, and clear timers
  // so a stray save never fires after unmount.
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
      const pending = pendingSaveRef.current
      pendingSaveRef.current = null
      if (pending && pending.name.trim()) {
        const payload = {
          name: pending.name,
          gradeLevel: pending.gradeLevel,
          week: pending.week,
          color: pending.color,
          patterns: saveablePatterns(pending.patterns, unsavedPatternIdsRef.current),
        }
        // A mid-edit pattern with a cleared required field cannot be saved
        // yet; the leave guard already warned about unsaved changes. Skip
        // the doomed PUT instead of reporting a validation error.
        if (!isPayloadSaveable(payload.patterns)) return
        updateList(pending.id, payload)
          .then(() => {
            // Log the once-per-visit edit entry only now that the flush
            // actually succeeded.
            if (!editLoggedRef.current) {
              editLoggedRef.current = true
              logActivity('edited', pending.name, pending.id)
            }
            notifyListsChanged()
          })
          .catch((error: unknown) => {
            // The page is gone; the save state can't be shown, but the
            // failure is still reported.
            reportError(error, { location: 'ListEditorPage.flushPendingSave' })
          })
      }
    }
  }, [])

  const markPatternUnsaved = (patternId: string) => {
    setUnsavedPatternIds((prev) => {
      if (prev.has(patternId)) return prev
      return new Set(prev).add(patternId)
    })
  }

  const unmarkPatternUnsaved = (patternId: string) => {
    setUnsavedPatternIds((prev) => {
      if (!prev.has(patternId)) return prev
      const next = new Set(prev)
      next.delete(patternId)
      return next
    })
  }

  async function doSave(next: WordList): Promise<void> {
    pendingSaveRef.current = null
    setHasPendingSave(false)
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
    const payload = {
      name: next.name,
      gradeLevel: next.gradeLevel,
      week: next.week,
      color: next.color,
      patterns: saveablePatterns(next.patterns, unsavedPatternIdsRef.current),
    }
    // A pre-existing pattern that is mid-edit (a required field cleared while
    // retyping) fails API validation, so hold the save: no error toast, no
    // error report. The pending save stays armed and the next keystroke
    // retries; the Unsaved changes indicator stays on.
    if (!isPayloadSaveable(payload.patterns)) {
      pendingSaveRef.current = next
      setHasPendingSave(true)
      setSaveStatus('idle')
      return
    }
    setSaveStatus('saving')
    try {
      await updateList(next.id, payload)
      // Log the once-per-visit edit entry only now that the autosave
      // succeeded. Skipped blank-name saves and failed updates below leave
      // the activity trail alone.
      if (!editLoggedRef.current) {
        editLoggedRef.current = true
        logActivity('edited', next.name, next.id)
      }
      notifyListsChanged()
      // The payload just persisted, so every pattern it carried is saved.
      // Patterns still in unsavedPatternIdsRef never went to the API
      // (local-only drafts), so their badges stay on.
      setUnsavedPatternIds((prev) => {
        const stillUnsaved = new Set<string>()
        for (const id of prev) {
          if (unsavedPatternIdsRef.current.has(id)) stillUnsaved.add(id)
        }
        return stillUnsaved
      })
      setSaveFailed(false)
      setSaveStatus('saved')
      savedTimerRef.current = setTimeout(() => {
        setSaveStatus('idle')
      }, SAVED_MESSAGE_MS)
    } catch (error) {
      reportError(error, { location: 'ListEditorPage.doSave' })
      setSaveFailed(true)
      setSaveStatus('idle')
      toastError(getErrorMessage(error))
    }
  }

  function scheduleAutosave(next: WordList): void {
    pendingSaveRef.current = next
    setHasPendingSave(true)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      // Serialize behind the save chain (issue #263): the content PUT shares
      // a read-modify-write on the list item with classroom PUTs, so it must
      // not run concurrently with one. The save EXTENDS the chain (rather
      // than merely awaiting it) so a later classroom save automatically
      // waits for it.
      const prev = saveChainRef.current
      const task = prev.then(() => doSave(next))
      // doSave never rejects, so the chain cannot break here.
      saveChainRef.current = task
    }, SAVE_DEBOUNCE_MS)
  }

  /** Apply a local edit and schedule its auto-save. The once-per-visit
   * edit activity entry is logged from the successful save paths, not here,
   * so skipped or failed saves never leave a phantom "edited" entry. */
  function applyChange(next: WordList): void {
    setList(next)
    scheduleAutosave(next)
  }

  /**
   * Classroom assignment saves immediately (not debounced): it is an
   * explicit choice, not a content edit. Reverts on failure.
   *
   * Race handling (issue #263):
   * - Classroom saves run sequentially via a promise chain, so selecting
   *   A then B sends the PUTs in order and the last selection is the one
   *   persisted.
   * - The save waits for any pending or in-flight content autosave first,
   *   so the two PUTs cannot read the same prior list and discard each
   *   other's edits.
   * - On failure only the classId is reverted (via functional update) to
   *   the last persisted value, so content edits made while the PUT was
   *   pending are preserved; a newer classroom selection is never reverted.
   */
  async function handleClassroomChange(classId: string | null, current: WordList): Promise<void> {
    const saveId = ++classroomSaveSeqRef.current
    const attempted = classId ?? null
    const next: WordList = { ...current }
    if (classId) next.classId = classId
    else delete next.classId
    setList(next)

    // Chain onto the previous save so PUTs hit the API in order.
    const prevChain = saveChainRef.current
    const deferred = Promise.withResolvers<void>()
    saveChainRef.current = prevChain.then(() => deferred.promise)

    try {
      await prevChain
      // Serialize with content saves: flush a pending autosave and wait for
      // an in-flight one before the classroom PUT reads the list.
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      const pending = pendingSaveRef.current
      if (pending) {
        pendingSaveRef.current = null
        setHasPendingSave(false)
        // doSave never rejects (it reports its own failures), so no catch.
        await doSave(pending)
      }
      // Any content save active at entry was in prevChain and is already
      // awaited above; the flush above is also awaited. No separate
      // in-flight check is needed.
      // A newer classroom selection started while we waited; it owns the
      // outcome now.
      if (saveId !== classroomSaveSeqRef.current) return
      await updateList(next.id, { classId })
      persistedClassIdRef.current = attempted
      if (saveId === classroomSaveSeqRef.current) {
        notifyListsChanged()
      }
    } catch (error) {
      // Only the latest save reverts; a stale save's failure must not
      // clobber a newer selection (the saveId check ensures this).
      if (saveId === classroomSaveSeqRef.current) {
        const persisted = persistedClassIdRef.current
        setList((list) => {
          // handleClassroomChange only runs when list is loaded (the
          // ClassroomSelector renders after load), so list is non-null.
          const reverted = { ...list! }
          if (persisted) reverted.classId = persisted
          else delete reverted.classId
          return reverted
        })
      }
      reportError(error, { location: 'ListEditorPage.handleClassroomChange' })
      toastError(getErrorMessage(error))
    } finally {
      deferred.resolve()
    }
  }

  const reload = async () => {
    setLoadState('loading')
    try {
      const data = await getList(listId)
      setList(data)
      persistedClassIdRef.current = data.classId ?? null
      setLoadState('ready')
    } catch (err) {
      reportError(err, { location: 'ListEditorPage.reload' })
      setLoadState(err instanceof Error && /not found/i.test(err.message) ? 'not-found' : 'error')
    }
  }

  const isDirty = hasPendingSave || saveStatus === 'saving' || localOnlyCount > 0 || saveFailed
  const { depart } = useUnsavedChangesGuard(isDirty, setLeaveTarget)

  const cancelLeave = () => setLeaveTarget(null)
  const confirmLeave = () => {
    // Only reachable from the dialog's confirm button, which renders while leaveTarget is set.
    const target = leaveTarget as LeaveTarget
    setLeaveTarget(null)
    depart(() => {
      if (target.kind === 'url') {
        router.push(target.url)
      } else {
        // The guard re-armed its sentinel when the back button was pressed;
        // depart already removed it, so step one more entry back to leave.
        window.history.go(-2)
      }
    })
  }

  // After a pattern is added, glide the bottom "Add a pattern" button down
  // to its new position instead of letting it jump (FLIP: the document Y
  // captured in addPattern is the First, this is the Last, and the keyframes
  // below are the Invert and Play). Runs before paint, so no jump is ever
  // visible. Only addPattern arms it; deletes and the initial load skip it.
  useLayoutEffect(() => {
    const shift = bottomButtonShiftRef.current
    bottomButtonShiftRef.current = null
    if (shift === null) return
    const { el: wrapper, y: beforeY } = shift
    // jsdom does not implement the Web Animations API; the shift simply
    // does not animate there.
    if (typeof wrapper.animate !== 'function') return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Viewport-relative top plus scrollY keeps the measurement independent
    // of the smooth scroll that addPattern kicks off on the new card.
    const deltaY = beforeY - (wrapper.getBoundingClientRect().top + window.scrollY)
    if (deltaY === 0) return
    const animation = wrapper.animate([{ transform: `translateY(${deltaY}px)` }, { transform: 'translateY(0)' }], {
      duration: BUTTON_SHIFT_MS,
      easing: 'ease-out',
    })
    bottomButtonAnimationRef.current = animation
    return () => {
      animation.cancel()
      if (bottomButtonAnimationRef.current === animation) {
        bottomButtonAnimationRef.current = null
      }
    }
  }, [list?.patterns.length])

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
  /**
   * Save one spelling rule from the per-pattern rule editor (issue #313).
   * With a classroom, the rule is saved to the classroom (shared across
   * its lists); otherwise it is saved unscoped on the pattern itself.
   * Clearing a classroom rule deletes it via DELETE (issue #307): an empty
   * rule fails the rules API validation, so it cannot go through PUT.
   * Rejects on failure so the editor keeps the draft and shows the error.
   */
  const handleSaveRule = async (patternId: string, patternText: string, rule: string): Promise<void> => {
    if (list.classId) {
      if (rule === '') {
        const res = await fetch(`/api/classes/${encodeURIComponent(list.classId)}/rules`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ patternText }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        setClassRules((prev) => {
          const next = { ...(prev ?? {}) }
          delete next[patternText]
          return next
        })
        return
      }
      const res = await fetch(`/api/classes/${encodeURIComponent(list.classId)}/rules`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules: { [patternText]: { rule } } }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setClassRules((prev) => ({ ...(prev ?? {}), [patternText]: rule }))
    } else {
      const next: WordList = {
        ...list,
        patterns: list.patterns.map((p) => (p.id === patternId ? { ...p, rule: rule || undefined } : p)),
      }
      setList(next)
      await updateList(next.id, {
        patterns: saveablePatterns(next.patterns, unsavedPatternIdsRef.current),
      })
    }
  }

  const updatePattern = (patternId: string, updated: SpellingPattern) => {
    // Once a new pattern has its required fields, it graduates to a normal
    // pattern and is included in saves from here on.
    if (isPatternComplete(updated)) {
      unsavedPatternIdsRef.current.delete(patternId)
      setLocalOnlyCount(unsavedPatternIdsRef.current.size)
    }
    markPatternUnsaved(patternId)
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
    // Cancel any in-flight shift animation so the measurement below reads
    // the bottom button wrapper's true layout position.
    bottomButtonAnimationRef.current?.cancel()
    bottomButtonAnimationRef.current = null
    // First (FLIP): document-relative Y before the new card pushes the
    // bottom button down. Viewport-relative top plus scrollY keeps the
    // measurement independent of the smooth scroll that fires on the new
    // card. Null when there is no bottom button yet (empty list).
    const wrapper = bottomButtonRef.current
    bottomButtonShiftRef.current = wrapper
      ? { el: wrapper, y: wrapper.getBoundingClientRect().top + window.scrollY }
      : null
    // Local-only until the required fields are filled: no auto-save fires,
    // so a blank pattern is never persisted (or rejected by API validation).
    unsavedPatternIdsRef.current.add(newPattern.id)
    markPatternUnsaved(newPattern.id)
    // Flag the new card so its mount scrolls it into view (see the pattern
    // list rendering below).
    pendingScrollIdRef.current = newPattern.id
    setLocalOnlyCount(unsavedPatternIdsRef.current.size)
    setList({ ...list, patterns: [...list.patterns, newPattern] })
  }

  const confirmDeletePattern = (target: SpellingPattern) => {
    if (unsavedPatternIdsRef.current.delete(target.id)) {
      setLocalOnlyCount(unsavedPatternIdsRef.current.size)
    }
    unmarkPatternUnsaved(target.id)
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
        <SaveIndicator status={saveStatus} isDirty={isDirty} />
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
        <div className="w-36 space-y-1.5">
          <Label htmlFor="list-week">Week (optional)</Label>
          <Input
            id="list-week"
            value={list.week ?? ''}
            onChange={(e) => applyChange({ ...list, week: e.target.value })}
            placeholder="e.g. 5"
            maxLength={20}
          />
        </div>
        <div className="space-y-1.5">
          <span className="flex items-center gap-2 text-sm leading-none font-medium select-none">List color</span>
          <ListColorPicker
            value={resolveListColor(list)}
            onChange={(color: ListColor) => applyChange({ ...list, color })}
          />
        </div>
        <div className="w-52 space-y-1.5">
          <ClassroomSelector value={list.classId} onChange={(classId) => handleClassroomChange(classId, list)} />
        </div>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-[22px] font-bold">Spelling patterns ({list.patterns.length})</h2>
          <p className="text-sm text-muted-foreground">
            One column per spelling pattern, so the pattern jumps out at a glance. Wider columns are the more common
            spellings, which tells students which spelling to try first.
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
        <>
          <div className="space-y-6">
            {list.patterns.map((pattern) => (
              <div
                key={pattern.id}
                ref={(element) => {
                  if (!element) return
                  // The new card mounts in the same commit as the state update
                  // that flagged it, so scroll it into view exactly once here.
                  // Keeps the card clear of the sticky header (scroll-mt-24).
                  if (pendingScrollIdRef.current === pattern.id) {
                    pendingScrollIdRef.current = null
                    const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
                    element.scrollIntoView({ behavior, block: 'start' })
                  }
                }}
                className="scroll-mt-24"
              >
                <PatternEditor
                  pattern={pattern}
                  onChange={(updated) => updatePattern(pattern.id, updated)}
                  onRemove={() => setDeletePatternTarget(pattern)}
                  color={resolveListColor(list)}
                  isUnsaved={unsavedPatternIds.has(pattern.id)}
                  classId={list.classId}
                  className={className}
                  classRules={classRules}
                  onSaveRule={handleSaveRule}
                />
              </div>
            ))}
          </div>
          <div ref={bottomButtonRef} className="flex justify-center pt-2">
            <Button onClick={addPattern}>Add a pattern</Button>
          </div>
        </>
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

      <Dialog open={leaveTarget !== null} onOpenChange={(open) => !open && cancelLeave()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave without saving?</DialogTitle>
            <DialogDescription>
              You have unsaved changes. If you leave now, those changes will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={cancelLeave}>
              Keep editing
            </Button>
            <Button variant="destructive" onClick={confirmLeave}>
              Leave without saving
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
