'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PlusIcon, SearchIcon, XIcon, TriangleAlertIcon } from 'lucide-react'
import { getLists, deleteList, updateList, notifyListsChanged } from '@/lib/lists-api'
import { logActivity } from '@/lib/activity'
import { type WordList, isListFavorite } from '@/models/WordList'
import { reportError } from '@/lib/report-error'
import { getErrorMessage, toastError } from '@/lib/error-toast'
import { cn } from '@/lib/utils'
import { useLocalStorage } from '@/lib/use-local-storage'
import {
  sortFavorites,
  toggleFavorite,
  reorderFavorites,
  sortLists,
  reorderCustom,
  initializeCustomOrder,
  LIST_SORT_STORAGE_KEY,
  type ListSort,
} from '@/lib/list-organize'
import { searchLists } from '@/lib/list-search'
import ListsOverviewCard from './ListsOverviewCard'
import ListSortMenu from './ListSortMenu'
import ListsMobileFilterBar, { type ListView } from './ListsMobileFilterBar'
import PrebuiltLibrarySection from './PrebuiltLibrarySection'
import { touchDragLiftModifier } from '@/lib/sort-drag'

/** All/Favorites view selection, persisted across sessions. */
const VIEW_STORAGE_KEY = 'patternspell:lists-view'

/** Below this width the compact single-row filter bar replaces the stacked toolbar (issue #484). */
const MOBILE_QUERY = '(max-width: 767px)'

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
  const [sort, setSort] = useLocalStorage<ListSort>(LIST_SORT_STORAGE_KEY, 'recent')
  const [announcement, setAnnouncement] = useState('')
  // True while an order persist is in flight; reordering stays disabled
  // until it lands so concurrent saves cannot interleave (review feedback).
  const [savingOrder, setSavingOrder] = useState(false)
  const [query, setQuery] = useState('')
  const [searchExpanded, setSearchExpanded] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  // "/" focuses search on desktop (ignored while typing in a field). On
  // mobile the search lives behind the compact bar's toggle, so "/" expands
  // the field instead (the bar focuses the input on expand).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      event.preventDefault()
      if (window.matchMedia(MOBILE_QUERY).matches) {
        setSearchExpanded(true)
      } else {
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

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

  // Empty-state guide (issue #463): scrolls to the prebuilt library section
  // on this same page. scroll-mt-20 on the section keeps it clear of the
  // sticky site header.
  const scrollToPrebuiltLibrary = useCallback(() => {
    document.getElementById('prebuilt-library')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  const favorites = useMemo(() => sortFavorites(lists), [lists])
  const showFavoritesTab = favorites.length > 0
  // A stored "favorites" view with no favorites falls back to All.
  const effectiveView: ListView = view === 'favorites' && showFavoritesTab ? 'favorites' : 'all'
  // Search spans all lists (including favorites) and ignores the tab
  // selection; the active sort applies within results.
  const searching = query.trim().length > 0
  const visibleLists = searching
    ? sortLists(searchLists(lists, query), sort)
    : effectiveView === 'favorites'
      ? favorites
      : sortLists(lists, sort)
  const reorderable =
    !searching && !savingOrder && (effectiveView === 'favorites' || (effectiveView === 'all' && sort === 'custom'))

  // Scroll behavior (issue #484, Donray-confirmed): when the result set
  // changes (view tab, sort order, or search query), scroll to the top of
  // the page, the teacher is looking at a new list. Actions that do not
  // change the result set (e.g. favoriting) do not scroll.
  const scrollResultsToTop = useCallback(() => {
    window.scrollTo(0, 0)
  }, [])

  const handleViewChange = useCallback(
    (tab: ListView) => {
      if (tab === effectiveView) return
      setView(tab)
      scrollResultsToTop()
    },
    [effectiveView, setView, scrollResultsToTop]
  )

  const handleQueryChange = useCallback(
    (next: string) => {
      if (next === query) return
      setQuery(next)
      scrollResultsToTop()
    },
    [query, scrollResultsToTop]
  )

  const handleToggleFavorite = useCallback(
    async (list: WordList) => {
      const toggled = toggleFavorite(lists, list.id)
      if (!toggled) return
      setLists(toggled.lists)
      setAnnouncement(
        toggled.update.isFavorite ? `${list.name} added to favorites.` : `${list.name} removed from favorites.`
      )
      try {
        await updateList(list.id, toggled.update)
        notifyListsChanged()
      } catch (error) {
        // Restore only the failed list; other optimistic updates stay.
        setLists((prev) => prev.map((l) => (l.id === list.id ? list : l)))
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

  // The DragOverlay renders a smooth floating copy of the dragged card while
  // the original stays in place (hidden), mirroring the Sort page.
  const [activeListId, setActiveListId] = useState<string | null>(null)
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveListId(String(event.active.id))
  }, [])
  const handleDragCancel = useCallback(() => {
    setActiveListId(null)
  }, [])
  const activeList = useMemo(
    () => (activeListId ? (lists.find((list) => list.id === activeListId) ?? null) : null),
    [lists, activeListId]
  )

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveListId(null)
      const { active, over } = event
      if (!over || active.id === over.id || savingOrder) return
      const favoriteReorder = effectiveView === 'favorites'
      const reordered = favoriteReorder
        ? reorderFavorites(lists, String(active.id), String(over.id))
        : reorderCustom(lists, String(active.id), String(over.id))
      if (reordered === lists) return
      setLists(reordered)
      setAnnouncement(favoriteReorder ? 'Favorites reordered.' : 'Lists reordered.')
      setSavingOrder(true)
      try {
        if (favoriteReorder) {
          await Promise.all(
            reordered.filter(isListFavorite).map((l) => updateList(l.id, { favoriteOrder: l.favoriteOrder }))
          )
        } else {
          await Promise.all(reordered.map((l) => updateList(l.id, { sortOrder: l.sortOrder })))
        }
        notifyListsChanged()
      } catch (error) {
        reportError(error, { location: 'PatternListsManager.handleDragEnd' })
        toastError(getErrorMessage(error))
        // Some saves may have landed; re-sync with the server rather than
        // guessing which orders persisted.
        const fresh = await getLists().catch(() => null)
        if (fresh) setLists(fresh)
      } finally {
        setSavingOrder(false)
      }
    },
    [lists, effectiveView, savingOrder]
  )

  const handleSortChange = useCallback(
    async (next: ListSort) => {
      if (next === sort || savingOrder) return
      scrollResultsToTop()
      if (next !== 'custom') {
        setSort(next)
        return
      }
      // Entering custom order: the arrangement starts as the order on
      // screen, then persists so it survives reloads.
      // Build the custom order from the full All view, not the visible
      // (possibly searched) subset, so every list gets a sortOrder.
      const ordered = initializeCustomOrder(sortLists(lists, sort))
      const previousSort = sort
      const orderMap = new Map(ordered.map((l) => [l.id, l.sortOrder] as const))
      setLists((prev) => prev.map((l) => ({ ...l, sortOrder: orderMap.get(l.id) })))
      setSort(next)
      setAnnouncement('Custom order. Drag the handles to reorder your lists.')
      setSavingOrder(true)
      try {
        await Promise.all(ordered.map((l) => updateList(l.id, { sortOrder: l.sortOrder })))
        notifyListsChanged()
      } catch (error) {
        setSort(previousSort)
        reportError(error, { location: 'PatternListsManager.handleSortChange' })
        toastError(getErrorMessage(error))
        const fresh = await getLists().catch(() => null)
        if (fresh) setLists(fresh)
      } finally {
        setSavingOrder(false)
      }
    },
    [sort, visibleLists, savingOrder, scrollResultsToTop]
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
        {/* Sticky filter bar: matches the loaded sticky tabs + sort + search (issue #341).
            z-20 keeps the bar above the card action-button rows (relative z-10,
            issue #421): equal z-index ties break by DOM order, so at z-10 the
            scrolling buttons painted on top of the stuck bar.
            Stick offset (issues #476, #485): the site header scrolls away at
            every breakpoint (its sticky top-0 is trapped in SiteChrome's
            74px slot wrapper), so the bar pins flush to the viewport top
            everywhere. The old 72px offset assumed a stuck header and floated
            the bar over a gap that scrolling cards showed through. */}
        <div
          className="sticky top-0 z-20 -my-1 bg-background py-1.5 [transform:translateZ(0)] md:py-3"
          data-testid="lists-filter-toolbar"
          aria-hidden="true"
        >
          {/* Compact bar geometry on mobile (issue #484): a single 56px row. */}
          <div className="md:hidden">
            <div className="h-14 animate-pulse rounded-full bg-line/60" />
          </div>
          {/* Desktop skeleton, unchanged apart from the wrapper. */}
          <div className="hidden space-y-4 md:block">
            <div className="inline-flex rounded-full border-2 border-line bg-card p-1">
              <div className="h-[44px] w-20 animate-pulse rounded-full bg-line/60" />
              <div className="h-[44px] w-24 animate-pulse rounded-full bg-line/40" />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="h-[44px] w-48 animate-pulse rounded-full bg-line/60" />
              <div className="h-[44px] min-w-[220px] flex-1 animate-pulse rounded-full bg-line/40 sm:max-w-xs" />
            </div>
          </div>
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

          {/*
            Sticky so tabs + search stay pinned while scrolling (issue #298),
            and isolated in its own compositing layer so iOS Safari stops
            ghosting card action bars into a stuck duplicate that smears over
            the controls while scrolling.
            Stick offset (issues #476, #485): the site header scrolls away at
            every breakpoint (its sticky top-0 is trapped in SiteChrome's
            74px slot wrapper), so the bar pins flush to the viewport top
            everywhere. The old 72px offset assumed a stuck header and floated
            the bar over a gap that scrolling cards showed through.
            z-20 (not z-10): the card action-button rows are relative z-10,
            and equal z-index ties break by DOM order, so at z-10 the
            scrolling buttons painted on top of the stuck bar (issue #421).
          */}
          <div
            className="sticky top-0 z-20 -my-1 bg-background py-1.5 [transform:translateZ(0)] md:py-3"
            data-testid="lists-filter-toolbar"
          >
            {/*
              Compact single-row bar on mobile (issue #484): the tabs, sort,
              and search collapse into one 56px row instead of three stacked
              full-width rows.
            */}
            <div className="md:hidden">
              <ListsMobileFilterBar
                view={effectiveView}
                onViewChange={handleViewChange}
                showFavoritesTab={showFavoritesTab}
                searching={searching}
                sort={sort}
                onSortChange={handleSortChange}
                showSort={(effectiveView === 'all' || searching) && lists.length > 0}
                query={query}
                onQueryChange={handleQueryChange}
                searchExpanded={searchExpanded}
                onSearchExpandedChange={setSearchExpanded}
              />
            </div>

            {/* Full stacked toolbar on desktop, unchanged. */}
            <div className="hidden space-y-4 md:block" data-testid="desktop-filter-bar">
              {showFavoritesTab && !searching && (
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
                      onClick={() => handleViewChange(tab)}
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

              {lists.length > 0 && (
                <div className="flex flex-wrap items-center gap-3">
                  {(effectiveView === 'all' || searching) && (
                    <>
                      <ListSortMenu sort={sort} onSortChange={handleSortChange} />
                      {sort === 'custom' && !searching && (
                        <p className="text-[15px] text-muted-foreground">Drag the handles to reorder your lists.</p>
                      )}
                    </>
                  )}
                  <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
                    <SearchIcon
                      className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <Input
                      ref={searchRef}
                      value={query}
                      onChange={(event) => handleQueryChange(event.target.value)}
                      placeholder="Search lists"
                      aria-label="Search lists"
                      className="min-h-[44px] rounded-full pl-10 pr-10"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => handleQueryChange('')}
                        aria-label="Clear search"
                        className={cn(
                          'absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full',
                          'text-muted-foreground outline-none transition-colors hover:bg-line/60 hover:text-ink',
                          'focus-visible:ring-[3px] focus-visible:ring-ring/60'
                        )}
                      >
                        <XIcon className="size-5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {searching && (
            <p className="text-[15px] text-muted-foreground" role="status">
              {visibleLists.length === 0
                ? `No lists match "${query.trim()}".`
                : `${visibleLists.length} ${visibleLists.length === 1 ? 'result' : 'results'} for "${query.trim()}".`}
            </p>
          )}

          {lists.length === 0 ? (
            <div className="rounded-[20px] border-2 border-line bg-card p-10 text-center">
              <p className="text-xl font-bold">No word lists yet</p>
              <p className="mt-2 text-[15px] text-muted-foreground">
                Build your own from scratch, or start from 162 weeks of ready-made pattern lists and make them yours.
              </p>
              <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
                <Button onClick={() => router.push('/lists/new')}>
                  <PlusIcon className="size-4" />
                  Create your own list
                </Button>
                <Button variant="secondary" onClick={scrollToPrebuiltLibrary}>
                  Start from a ready-made list
                </Button>
              </div>
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              onDragStart={handleDragStart}
              onDragCancel={handleDragCancel}
              onDragEnd={handleDragEnd}
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="lists-grid">
                {visibleLists.map((list) => (
                  <ListsOverviewCard
                    key={list.id}
                    list={list}
                    reorderable={reorderable}
                    onOpen={openList}
                    onDelete={setDeleteListTarget}
                    onToggleFavorite={handleToggleFavorite}
                    highlightQuery={searching ? query : ''}
                  />
                ))}
              </div>
              <DragOverlay dropAnimation={null} modifiers={[touchDragLiftModifier]} style={{ zIndex: 100 }}>
                {activeList && (
                  // Inert ghost copy: the real handlers are unreachable while
                  // the overlay is inert, but keep them wired for correctness.
                  <div aria-hidden="true" inert>
                    <ListsOverviewCard
                      list={activeList}
                      reorderable={false}
                      onOpen={openList}
                      onDelete={setDeleteListTarget}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  </div>
                )}
              </DragOverlay>
            </DndContext>
          )}
        </>
      )}

      {/*
        Prebuilt library (issue #463 redesign): a secondary section below the
        teacher's own lists. Her lists stay primary and dominant above; a
        teacher who never scrolls down never notices this. It renders even
        when her lists fail to load because the prebuilt data is bundled,
        not fetched. (loading is always false here: the skeleton returned
        early above.)
      */}
      <PrebuiltLibrarySection />

      <Dialog open={deleteListTarget !== null} onOpenChange={() => setDeleteListTarget(null)}>
        {deleteListTarget && (
          <DialogContent className="border-2 border-coral">
            <div className="flex items-start gap-4">
              <TriangleAlertIcon className="size-14 shrink-0 text-coral" aria-label="Warning" />
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
