# PLAN: collapse the auth-then-fetch waterfall (#480)

## Problem

Every route blocked in sequence: (1) app shell renders, (2) client
`useSession()` resolves via `GET /api/auth/session`, (3) page fetches data,
(4) skeletons replaced. Two sequential blocking round trips before
interactive. Audit: dashboard ~2-4s, /lists ~2-4s, /display ~2-3s.

Traced 2026-10-19, the actual waterfall lives almost entirely on /home:

- `src/app/home/page.tsx` gates rendering `<Dashboard/>` on
  `status === 'loading'` AND on the `syncUser` effect (`GET /api/users?email=`,
  then maybe `POST /api/users`). The dashboard does not even mount until both
  settle.
- `src/components/Dashboard.tsx` `loadLists` refuses to fetch until
  `status === 'authenticated'`, so `getLists()` starts only after the
  next-auth client fetch resolves.
- `/lists` (PatternListsManager) and `/display` (DisplayMode) already fetch
  on mount with no session gate; nothing to change there.

## Design

**Chosen: parallel fetch (start data fetches on mount, in parallel with the
session check).** One-line reason: `src/proxy.ts` middleware is already the
real auth gate, server-side, on every request (pages redirect to
`/auth/signin`, `/api/*` returns JSON 401), so waiting client-side for
`useSession()` to resolve before fetching gates nothing; `fetch` sends the
session cookie automatically and the API scopes data by it.

Rejected alternative: resolve the session server-side in the (server)
pages and prefetch route data (RSC). The interactive components already
need client-side fetching anyway (lists-changed event reloads, retry
buttons), so a server prefetch would be large churn for no extra round-trip
win beyond what the parallel fetch achieves.

Auth semantics preserved:

- Signed-out page visits: middleware redirects before any component renders.
  Unchanged.
- Signed-out API calls: JSON 401 from middleware. Unchanged.
- Session expiring mid-load: the data fetch 401s; Dashboard already treats a
  401 as "signed out, not an error" (empty lists, no error card, no Sentry).
  That handler stays.
- Data scoping stays server-side. No user-data semantics change.

First-paint loading state: unchanged geometry. HomePage's page-level
skeleton is removed (it only existed to cover the session wait); Dashboard
renders its own `DashboardSkeleton` while loading, the exact same component
the page used before (issue #341 geometry).

## Changes

1. `src/app/home/page.tsx`
   - Render `<Dashboard/>` immediately on mount.
   - `syncUser` effect becomes fire-and-forget: runs when the session
     resolves, keeps its silent failure handling, no longer gates render.
   - Drop `isSyncing` state and the `status === 'loading'` gate; keep the
     scroll-pin `useLayoutEffect` untouched.
2. `src/components/Dashboard.tsx`
   - `loadLists`: drop the `status !== 'authenticated'` early return and the
     `status` dependency; fetch on mount. Keep the `HttpError 401` branch
     (session expired between load and fetch reads as signed out).
   - Greeting falls back to the nameless greeting until the session
     resolves; `session?.user?.name` still arrives via the existing
     `useSession()` call.
3. Tests (behavior contracts change):
   - `src/app/home/page.test.tsx`: dashboard renders immediately while the
     session is loading (skeleton from Dashboard itself); sync effect still
     fires GET/conditional POST, still silent on failure.
   - `src/components/Dashboard.test.tsx`: "does not fetch lists when signed
     out" and "does not fetch lists while the session is still loading"
     become "fetches lists immediately on mount" (401 path = signed out,
     not an error).
4. e2e: no new assertions needed; `e2e/authenticated.spec.ts` home flow
   still passes (visible outcome unchanged).

## Test plan

- `npm run format`, lint (oxlint), typecheck (`tsc --noEmit`), full unit
  suite with coverage thresholds. 100% on changed code; existing thresholds
  hold.
- Regression: run related specs locally (`page.test.tsx`, `Dashboard.test.tsx`).
- UI change surface is minimal (skeleton timing only); local Playwright
  screenshot of /home before/after not required beyond CI, but the
  e2e home test covers the flow.

## Rebase note (2026-10-19)

The branch was rebased onto main after PR #490 (issue #479, client-side
data cache + `useBlockedVideos`) merged. Reconciliation:

- `Dashboard.tsx` kept #490's `listsLoading` rename and `useBlockedVideos`
  wiring; the #480 change applies on top (fetch on mount, no session gate).
- `loading` is now `listsLoading || status === 'loading' ||
(status === 'authenticated' && !blockedLoaded)`: the skeleton stays up
  while the session resolves so the page never flashes content, then the
  skeleton, then content when the blocked-video load starts on
  authentication. This pairs with the AGENTS.md hold-content rule (#439).
- The AGENTS.md lesson pairs with #439's hold-content rule instead of
  conflicting: fetch early, hold the skeleton.
