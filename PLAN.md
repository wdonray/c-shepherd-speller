# PLAN: Full-screen search view on mobile lists page (issue #555)

## What changes

On mobile widths only, tapping the search icon in the lists toolbar opens a
dedicated full-screen search view instead of expanding the field inline in
the 56px toolbar row. Desktop keeps the current inline expansion untouched.

## Design (brief comparison)

Two placements were considered for the overlay:

1. Overlay rendered by `PatternListsManager` (chosen): the results grid
   lives in the parent, and the cards use `useDraggable`/`useDroppable`,
   so they must stay inside the parent's `DndContext`. Rendering the
   overlay here reuses `visibleLists` and the existing search semantics
   with no new backend and no change to what is searchable.
2. Overlay rendered inside `ListsMobileFilterBar` (rejected): the bar has
   no access to the results or the drag context, so it would need both
   lifted anyway.

While the overlay is open, the page grid underneath does not render: the
overlay covers it, and rendering both would duplicate draggable /
droppable ids inside one `DndContext` plus duplicate accessible names.

## Files

- `src/components/ListsMobileSearchOverlay.tsx` (new): the full-screen
  view. Fixed to the viewport (`fixed inset-x-0 top-0 h-dvh`, `z-50`,
  `md:hidden`): header row with a back arrow (Android convention) and a
  `Cancel` label (iOS convention), both closing the view; a search input
  with `autoFocus` so the cursor is ready with no second tap; and a
  scrollable results region (`flex-1 overflow-y-auto`) holding the result
  count and the matching list cards. `h-dvh` (not `h-screen`) is the
  keyboard fix: the dynamic viewport height shrinks when the on-screen
  keyboard opens, so the results region stays above the keyboard instead
  of behind it. Escape closes the view. Body scroll is locked while open.
  Closing clears the query, so dismissing restores the list exactly as it
  was (same as the old inline X behavior).
- `src/components/PatternListsManager.tsx`: renders the overlay inside
  the existing `DndContext` when `searchExpanded` is true, and suppresses
  the page grid and the page-level result count while it is open. Adds a
  close handler (clear query + collapse). Search semantics, sorting, and
  the desktop toolbar are untouched.
- `src/components/ListsMobileFilterBar.tsx`: drops the inline expanded
  overlay (`mobile-search-expanded`) and its input focus choreography.
  The search toggle now only opens the parent's full-screen view; the
  collapse-to-toggle focus return stays, so keyboard users never lose
  their place. `onQueryChange` prop removed (no longer used in the bar).
- `src/components/ListsMobileSearchOverlay.test.tsx` (new unit tests).
- `src/components/ListsMobileFilterBar.test.tsx`,
  `src/components/PatternListsManager.test.tsx`: updated for the new
  open/close flow (overlay testid, Cancel/back controls).
- `e2e/lists-compact-mobile-bar.spec.ts`: the mobile search test updated
  to the overlay flow.
- `e2e/lists-mobile-fullscreen-search.spec.ts` (new): 390px verification
  that the overlay fills the viewport, focuses the field, filters, and
  that Cancel and the back arrow each restore the full list; desktop
  keeps the inline field.

## Test plan

- `npm run format`, lint, typecheck, full unit suite with coverage
  (100% thresholds: new component fully covered).
- E2E locally: the new spec plus the updated compact-bar spec, against a
  local server on a free port with dynalite (no docker on this VM).
- Screenshots gate: local Playwright screenshots at 390px to eyeball the
  overlay (kept out of the repo).
