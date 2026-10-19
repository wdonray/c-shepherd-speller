'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckIcon } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createList, getLists, notifyListsChanged, updateList } from '@/lib/lists-api'
import { generatePatternId, isDuplicatePatternPair, type SpellingPattern, type WordList } from '@/models/WordList'
import { prebuiltGradeLabel, type PrebuiltWeek } from '@/lib/prebuilt-lists'

/** The schema cap on patterns per list; the API rejects more. */
const MAX_PATTERNS_PER_LIST = 20

type View =
  | { name: 'loading' }
  | { name: 'loadError' }
  | { name: 'pick' }
  | { name: 'saving' }
  | { name: 'saveError' }
  | { name: 'done'; targetId: string; targetName: string; added: number; addedWords: number; skipped: number }

const LOAD_ERROR = 'Could not load your lists. Check your connection and try again.'
const SAVE_ERROR = 'Could not add the patterns. Check your connection and try again.'

interface PullPatternsModalProps {
  week: PrebuiltWeek
  onClose: () => void
}

/**
 * Pull individual patterns from a prebuilt week into one of the teacher's
 * lists (issue #463, Phase B). She picks the target list (or creates a new
 * one), checks the patterns she wants, and confirms. Patterns whose
 * spelling/sound pair already exists in the target list are skipped with a
 * visible reason, mirroring the blocked-keystroke notice convention.
 */
export default function PullPatternsModal({ week, onClose }: PullPatternsModalProps) {
  const router = useRouter()
  const [view, setView] = useState<View>({ name: 'loading' })
  // The teacher's lists live outside `view` so a save failure (which changes
  // the view) never drops the loaded lists or the selected target: retry
  // works from the same state. The target is the list object itself (or
  // 'new'), never an id that could go stale.
  const [lists, setLists] = useState<WordList[] | null>(null)
  const [target, setTarget] = useState<WordList | 'new'>('new')
  const [newListName, setNewListName] = useState(week.title)
  const [checked, setChecked] = useState<boolean[]>(() => week.patterns.map(() => true))

  const loadLists = () => {
    setView({ name: 'loading' })
    getLists().then(
      (fetched) => {
        setLists(fetched)
        setTarget(fetched[0] ?? 'new')
        setView({ name: 'pick' })
      },
      () => setView({ name: 'loadError' })
    )
  }

  useEffect(() => {
    loadLists()
    // Mount-only: the teacher's lists are fetched once when the modal opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const targetList: WordList | null = target === 'new' ? null : target

  const selectedIndices = useMemo(() => checked.map((c, i) => (c ? i : -1)).filter((i) => i >= 0), [checked])

  // Patterns whose spelling/sound pair the target list already has. Skipped
  // with a visible reason rather than silently dropped.
  const duplicateIndices = useMemo(() => {
    if (!targetList) return []
    return selectedIndices.filter((i) => {
      const p = week.patterns[i]
      const candidate: SpellingPattern = {
        id: '',
        sound: p.sound,
        pattern: p.pattern,
        frequency: p.frequency,
        words: p.words,
      }
      return isDuplicatePatternPair(targetList.patterns, candidate)
    })
  }, [targetList, selectedIndices, week.patterns])

  const addableIndices = useMemo(
    () => selectedIndices.filter((i) => !duplicateIndices.includes(i)),
    [selectedIndices, duplicateIndices]
  )

  const addableWords = useMemo(
    () => addableIndices.reduce((sum, i) => sum + week.patterns[i].words.length, 0),
    [addableIndices, week.patterns]
  )

  const overCap = targetList !== null && targetList.patterns.length + addableIndices.length > MAX_PATTERNS_PER_LIST

  const togglePattern = (index: number) => {
    setChecked((prev) => prev.map((c, i) => (i === index ? !c : c)))
  }

  const handleConfirm = async () => {
    // The confirm button is disabled when there is nothing addable or the
    // cap would be exceeded, so handleConfirm only runs in the valid state.
    setView({ name: 'saving' })
    const newPatterns = addableIndices.map((i) => {
      const p = week.patterns[i]
      return { sound: p.sound, pattern: p.pattern, frequency: p.frequency, words: p.words }
    })
    try {
      if (target === 'new') {
        const list = await createList({
          name: newListName.trim() || week.title,
          gradeLevel: prebuiltGradeLabel(week.grade),
          patterns: newPatterns,
        })
        notifyListsChanged()
        setView({
          name: 'done',
          targetId: list.id,
          targetName: list.name,
          added: newPatterns.length,
          addedWords: addableWords,
          skipped: duplicateIndices.length,
        })
      } else {
        const updated = await updateList(target.id, {
          patterns: [...target.patterns, ...newPatterns.map((p) => ({ ...p, id: generatePatternId() }))],
        })
        notifyListsChanged()
        setView({
          name: 'done',
          targetId: updated.id,
          targetName: updated.name,
          added: newPatterns.length,
          addedWords: addableWords,
          skipped: duplicateIndices.length,
        })
      }
    } catch {
      // Back to pick (not a dead end): the teacher's selections are intact.
      setView({ name: 'saveError' })
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add patterns to your lists</DialogTitle>
          <DialogDescription>Choose a list and the patterns to add from {week.title}.</DialogDescription>
        </DialogHeader>

        {view.name === 'loading' && (
          <div className="flex justify-center py-10" role="status" aria-label="Loading your lists">
            <div className="size-8 animate-spin rounded-full border-4 border-line border-t-ink" />
          </div>
        )}

        {view.name === 'loadError' && (
          <div className="space-y-4 py-4">
            <p role="alert" className="text-[15px] text-muted-foreground">
              {LOAD_ERROR}
            </p>
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={loadLists}>Try again</Button>
            </DialogFooter>
          </div>
        )}

        {(view.name === 'pick' || view.name === 'saving' || view.name === 'saveError') && (
          <div className="space-y-6">
            {view.name === 'pick' && lists !== null && lists.length > 0 && (
              <fieldset>
                <legend className="text-[15px] font-bold text-ink">Add to</legend>
                <div className="mt-2 space-y-2">
                  {lists.map((list) => (
                    <label
                      key={list.id}
                      className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[16px] border-2 border-line bg-card p-3"
                    >
                      <input
                        type="radio"
                        name="pull-target"
                        checked={target === list}
                        onChange={() => setTarget(list)}
                        className="h-5 w-5 shrink-0 accent-ink"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[16px] font-bold text-ink">{list.name}</span>
                        <span className="block text-[13px] text-muted-foreground">{list.patterns.length} patterns</span>
                      </span>
                    </label>
                  ))}
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[16px] border-2 border-line bg-card p-3">
                    <input
                      type="radio"
                      name="pull-target"
                      checked={target === 'new'}
                      onChange={() => setTarget('new')}
                      className="h-5 w-5 shrink-0 accent-ink"
                    />
                    <span className="text-[16px] font-bold text-ink">Create a new list</span>
                  </label>
                </div>
              </fieldset>
            )}

            {target === 'new' && (view.name === 'pick' || view.name === 'saveError') && (
              <div className="space-y-1.5">
                <Label htmlFor="pull-new-list-name">New list name</Label>
                <Input
                  id="pull-new-list-name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  maxLength={100}
                />
              </div>
            )}

            <fieldset>
              <legend className="text-[15px] font-bold text-ink">Patterns from {week.title}</legend>
              <div className="mt-2 space-y-2">
                {week.patterns.map((p, i) => {
                  const isDuplicate = duplicateIndices.includes(i)
                  return (
                    <label
                      key={p.pattern}
                      className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[16px] border-2 border-line bg-card p-3"
                    >
                      <input
                        type="checkbox"
                        checked={checked[i]}
                        onChange={() => togglePattern(i)}
                        className="h-5 w-5 shrink-0 accent-ink"
                        aria-label={`${p.pattern}, ${p.sound}`}
                      />
                      <span className="rounded-full bg-line/50 px-2.5 py-0.5 text-[13px] font-bold text-ink">
                        {p.pattern}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[14px] text-muted-foreground">
                        {p.sound} · {p.words.length} words
                        {isDuplicate && targetList && ` · already in ${targetList.name}`}
                      </span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            {/* Reserved so notices never shift the layout when they appear. */}
            <div className="min-h-6">
              {duplicateIndices.length > 0 && targetList && (
                <p role="status" className="text-[13px] text-muted-foreground">
                  {duplicateIndices.length} pattern{duplicateIndices.length !== 1 ? 's' : ''} already in{' '}
                  {targetList.name}, so {duplicateIndices.length !== 1 ? 'they' : 'it'} will be skipped.
                </p>
              )}
              {overCap && targetList && (
                <p role="alert" className="text-[13px] text-muted-foreground">
                  {targetList.name} already has {targetList.patterns.length} patterns. Lists hold up to{' '}
                  {MAX_PATTERNS_PER_LIST} patterns, so pick fewer or remove some from the list first.
                </p>
              )}
              {view.name === 'saveError' && (
                <p role="alert" className="text-[13px] text-muted-foreground">
                  {SAVE_ERROR}
                </p>
              )}
            </div>

            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={onClose} disabled={view.name === 'saving'}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={view.name === 'saving' || addableIndices.length === 0 || overCap}
              >
                {view.name === 'saving'
                  ? 'Adding...'
                  : `Add ${addableIndices.length} pattern${addableIndices.length !== 1 ? 's' : ''}${
                      targetList ? ` to ${targetList.name}` : ''
                    }`}
              </Button>
            </DialogFooter>
          </div>
        )}

        {view.name === 'done' && (
          <div className="space-y-4 py-2">
            <p role="status" className="flex items-start gap-2 text-[16px] font-bold text-ink">
              <CheckIcon className="mt-0.5 size-5 shrink-0 text-leaf" aria-hidden="true" />
              Added {view.added} pattern{view.added !== 1 ? 's' : ''} ({view.addedWords} words) to {view.targetName}
            </p>
            {view.skipped > 0 && (
              <p className="text-[15px] text-muted-foreground">
                {view.skipped} pattern{view.skipped !== 1 ? 's' : ''} skipped: already in the list.
              </p>
            )}
            <DialogFooter className="flex-col gap-2 sm:flex-row">
              <Button variant="secondary" onClick={onClose}>
                Done
              </Button>
              <Button onClick={() => router.push(`/lists/${view.targetId}`)}>Open list</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
