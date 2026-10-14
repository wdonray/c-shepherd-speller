'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PlusIcon } from 'lucide-react'
import { getLists, deleteList, updateList, notifyListsChanged } from '@/lib/lists-api'
import { logActivity } from '@/lib/activity'
import { type WordList, isListFavorite } from '@/models/WordList'
import { reportError } from '@/lib/report-error'
import { getErrorMessage, toastError } from '@/lib/error-toast'
import { cn } from '@/lib/utils'
import { useLocalStorage } from '@/lib/use-local-storage'
import { sortFavorites, toggleFavorite, reorderFavorites } from '@/lib/list-organize'
import ListsOverviewCard from './ListsOverviewCard'
import { OddDuck } from './OddDuck'

/** All/Favorites view selection, persisted across sessions. */
type ListView = 'all' | 'favorites'
const VIEW_STORAGE_KEY = 'patternspell:lists-view'

/**
 * List-of-lists overview, rendered as the full /lists page. Creating a list
 * happens on /lists/new; editing a single list on /lists/[id].
 *
 * Issue #275: teachers star favorite lists (All/Favorites tabs, favorites
 * stay in All with a filled star, favorites drag-reorder independently).
 */
export default function PatternListsManager() {
  const router = useRouter()
  const [lists, setLists] = useState<WordList[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [deleteListTarget, setDeleteListTarget] = useState<WordList | null>(null)
  const [deletingList, setDeletingList] = useState(false)
  const [view, setView] = useLocalStorage<ListView>(VIEW_STORAGE_KEY, 'all')
  const [announcement, setAnnouncement] = useState('')

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
      router.push(`/lists/${encodeURIComponent(list.id)}`)
    },
    [router]
  )

  const favorites = useMemo(() => sortFavorites(lists), [lists])
  const showFavoritesTab = favorites.length > 0
  // A stored "favorites" view with no favorites falls back to All.
  const effectiveView: ListView = view === 'favorites' && showFavoritesTab ? 'favorites' : 'all'
  const visibleLists = effectiveView === 'favorites' ? favorites : lists
  const reorderable = effectiveView === 'favorites'

  const handleToggleFavorite = useCallback(
    async (list: WordList) => {
      const toggled = toggleFavorite(lists, list.id)
      if (!toggled) return
      const previous = lists
      setLists(toggled.lists)
      setAnnouncement(
        toggled.update.isFavorite ? `${list.name} added to favorites.` : `${list.name} removed from favorites.`
      )
      try {
        await updateList(list.id, toggled.update)
      } catch (error) {
        setLists(previous)
        reportError(error, { location: 'PatternListsManager.handleToggleFavorite' })
        toastError(getErrorMessage(error))
      }
    },
    [lists]
  )

  // useSensor normalizes a missing options argument to {}, which the
  // KeyboardSensor requires (see SortActivity's sentry #255 note).
  const pointerSensor = useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  const keyboardSensor = useSensor(KeyboardSensor)
  const sensors = useSensors(pointerSensor, keyboardSensor)

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event
      if (!over || active.id === over.id) return
      const reordered = reorderFavorites(lists, String(active.id), String(over.id))
      if (reordered === lists) return
      const previous = lists
      setLists(reordered)
      setAnnouncement('Favorites reordered.')
      try {
        await Promise.all(
          reordered.filter(isListFavorite).map((l) => updateList(l.id, { favoriteOrder: l.favoriteOrder }))
        )
      } catch (error) {
        setLists(previous)
        reportError(error, { location: 'PatternListsManager.handleDragEnd' })
        toastError(getErrorMessage(error))
      }
    },
    [lists]
  )

  const confirmDeleteList = async (target: WordList) => {
    // The Delete button is disabled while a delete is in flight.
    setDeletingList(true)
    try {
      await deleteList(target.id)
      // No listId: the deleted list's editor no longer exists, so the
      // entry stays plain text rather than a dead link.
      logActivity('deleted', target.name)
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
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
      <div aria-live="polite" className="sr-only" role="status">
        {announcement}
      </div>
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
              <Button onClick={() => router.push('/lists/new')}>
                <PlusIcon className="size-4" />
                New list
              </Button>
            )}
          </div>

          {showFavoritesTab && (
            <div
              role="tablist"
              aria-label="List views"
              className="inline-flex rounded-full border-2 border-line bg-card p-1"
            >
              {(['all', 'favorites'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={effectiveView === tab}
                  onClick={() => setView(tab)}
                  className={cn(
                    'min-h-[44px] rounded-full px-5 py-2 text-[15px] font-bold outline-none transition-colors',
                    'focus-visible:ring-[3px] focus-visible:ring-ring/60',
                    effectiveView === tab ? 'bg-ink text-background' : 'text-muted-foreground hover:text-ink'
                  )}
                >
                  {tab === 'all' ? 'All' : 'Favorites'}
                </button>
              ))}
            </div>
          )}

          {lists.length === 0 ? (
            <div className="rounded-[20px] border-2 border-line bg-card p-10 text-center">
              <p className="text-xl font-bold">No word lists yet</p>
              <p className="mt-2 text-[15px] text-muted-foreground">
                Create your first list to organize words by spelling pattern.
              </p>
              <Button onClick={() => router.push('/lists/new')} className="mt-6">
                <PlusIcon className="size-4" />
                New list
              </Button>
            </div>
          ) : (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="lists-grid">
                {visibleLists.map((list) => (
                  <ListsOverviewCard
                    key={list.id}
                    list={list}
                    reorderable={reorderable}
                    onOpen={openList}
                    onDelete={setDeleteListTarget}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))}
              </div>
            </DndContext>
          )}
        </>
      )}

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
