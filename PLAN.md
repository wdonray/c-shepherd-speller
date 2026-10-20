# PLAN: History-aware back buttons (issue #504)

## Research findings

- **NN/g (Breadcrumbs: 11 Design Guidelines):** "Breadcrumbs Should Display the
  Current Location in the Site's Hierarchical Structure, Not the Session
  History." This is about breadcrumb _trails_. NN/g explicitly contrasts trails
  with "a browser's native Back button": a back control is the history-showing
  control, and that is legitimate. Our BackBreadcrumb is a single back control,
  not a trail, so making it history-aware does not contradict NN/g.
- **Apple HIG (Navigation Bars):** "When a new screen is displayed, a back
  button, often labeled with the title of the previous screen, appears on the
  left side of the bar." Convention: the back button always carries the
  _previous screen's title_, never the word "back". This is exactly Donray's
  ask: name the page you came from, and pop the stack to return.
- **Android:** the system back button is pure history, unlabeled. The web has
  no labeled system back, so the app must supply the label itself.
- **Why not document.referrer:** it does not update on SPA (pushState)
  navigations and cannot supply friendly page titles.

**Mechanism choice (the iOS model):** a per-tab, sessionStorage-backed
navigation _trail_ records every client-side navigation. The trail mirrors
the session-history stack (pushes append; a note for the entry below the top
is a history-back and pops), so the "previous page" is always the entry a
real history-back would land on, even across same-pathname search-param
steps (DisplayMode picker -> chart) and back-out-then-onward flows. The back
control labels itself with that entry's friendly title and performs a real
`router.back()`. On direct landing (refresh, deep link, new tab: no in-app
referrer in this tab) it falls back to today's parent-named link. One-line
reason: it is the only mechanism that knows the previous page's friendly
title per tab, survives refresh correctly, and degrades cleanly to the #378
behavior when there is no in-app history.

Alternatives rejected:

- document.referrer: stale on SPA navigations, no titles.
- Full breadcrumb trail: contradicts NN/g for a two-level app and the #378
  decision; does not fix Donray's complaint.

## Audit of back surfaces

BackBreadcrumb consumers (all keep their `href`/`label` props as fallback):

- src/app/feedback/page.tsx, lists/page.tsx, practice/page.tsx,
  profile/page.tsx, videos/page.tsx -> /home "Home"
- src/app/lists/prebuilt/[id]/page.tsx -> /lists "My Spelling Lists"
- src/components/DisplayMode.tsx (picker -> /home "Home"; chart step ->
  /display "Present a list", same-route search-param step)
- src/components/ListEditorPage.tsx -> /lists "My spelling lists"
- src/components/NewListForm.tsx -> /lists "My spelling lists"
- src/components/PracticeMode.tsx -> /practice "Practice"
- src/components/worksheets/WorksheetsPrintPage.tsx -> worksheetsHref
  "Printable worksheets"
- src/app/auth/signout/page.tsx: Cancel button already does router.back();
  auth-flow cancel action, intentionally out of scope (not a named control).

## Changes

1. **NEW `src/lib/navigation-history.ts`** (client-safe, no window at module
   top level): `PAGE_NAMES` registry (static route -> friendly name, matching
   existing in-repo idiom), pattern matchers for `/lists/[id]/worksheets` and
   `/print`, `resolvePageName()`, `noteNavigation(fullKey, pathname)` trail
   state machine (push appends; a note for the entry below the top pops as a
   history-back; first-note bootstrap from sessionStorage distinguishes
   refresh from direct landing; capped at 50 entries), `reportPageName(name)`
   for dynamic titles, `readPreviousPage()`, `usePreviousPage()` via
   useSyncExternalStore (server snapshot null -> SSR renders today's
   fallback, no hydration error).
2. **NEW `src/components/navigation-tracker.tsx`**: 'use client' component
   using usePathname + useSearchParams (Suspense-wrapped); calls
   noteNavigation on every navigation, keyed on pathname+search so the
   DisplayMode picker -> chart search-param step records correctly.
   Mounted once in `src/app/layout.tsx` next to AnalyticsTracker.
3. **NEW `src/components/report-page-name.tsx`**: tiny client component for
   server pages with dynamic names.
4. **EDIT `src/components/BackBreadcrumb.tsx`**: becomes 'use client'. When a
   valid previous page exists (different path, history.length > 1): renders a
   `<button>` with identical visual classes, labeled with the previous page's
   name, calling `router.back()`. Otherwise renders today's `<Link>`
   unchanged. Works with the unsaved-changes guard: dirty -> sentinel popstate
   opens the confirm dialog; confirm -> go(-2) clamps onto the previous page.
5. **EDIT `src/components/ListEditorPage.tsx`**: reportPageName(list.name)
   once the list loads (effect keyed on loadState + list name string).
6. **EDIT `src/app/lists/prebuilt/[id]/page.tsx`**: `<ReportPageName
name={week.title} />`.
7. **EDIT `src/app/layout.tsx`**: mount `<NavigationTracker />`.

## Test plan

- Unit (vitest, 100% thresholds hold):
  - `src/lib/navigation-history.test.ts`: registry + pattern resolution,
    noteNavigation transitions (first landing, in-app nav, refresh keeps prev,
    direct landing clears prev, unnamed prev -> fallback, storage throwing),
    reportPageName (no-op before first note, skips unchanged name),
    readPreviousPage validation, usePreviousPage subscription/events/cache.
  - `src/components/BackBreadcrumb.test.tsx` (update): fallback link when no
    prev; history button when prev exists (click -> router.back()); same-path
    prev -> fallback; history.length <= 1 -> fallback.
  - `src/components/navigation-tracker.test.tsx`: notes on mount and on
    navigation change; skips empty pathname.
  - `src/components/report-page-name.test.tsx`: reports on mount/name change.
  - Existing ListEditorPage/prebuilt tests must still pass (reportPageName is
    side-effect-only).
- E2E (new `e2e/history-aware-back.spec.ts`, DynamoDB Local + built app):
  1. Home -> Edit list: back control is a button named "Home"; clicking lands
     on /home.
  2. Lists -> Edit list: back control named "My spelling lists"; clicking
     lands on /lists.
  3. Direct load of /lists/[id] (fresh context): back control is a link named
     "My spelling lists" to /lists.
- Manual: Playwright screenshots at 390px and desktop of the edit page via
  in-app nav and via direct load; confirm no layout shift, label correct.
  Screenshots stay out of the repo.

## Naming idiom

Registry uses existing labels: Home, My spelling lists, New word list,
Present a list, Practice, Profile, Feedback, Song videos, Printable
worksheets, Print pattern chart. Dynamic pages report their real names
(list name, ready-made week title).
