# PLAN: Issue #479 — Client-side cache for list data + user document

## Problem

Every page showing list data fetches fresh: dashboard, /lists, list detail,
present chart, worksheets each fire their own request for the same documents.
Audit 2026-10-19: present mode ~3-4s, worksheets ~2-3s. Target: <500ms
interactive on navigation.

## Research

Skipped (Step 4.2): straightforward change, no external information needed.
Prior art in-repo: `LISTS_CHANGED_EVENT` / `notifyListsChanged()` in
lists-api.ts already centralizes cross-view invalidation signaling.

## Design

Two strategies considered:

1. Cache inside the API client modules via a shared `data-cache.ts` helper.
   Zero component changes; all reads already flow through the seam
   (lists-api.ts, spelling-api.ts); writes invalidate at the same seam.
2. React Query-style library. Rejected: new dependency, touches every
   consuming component, larger blast radius for the same win.

Picked #1: smallest correct change.

## Changes

1. NEW `src/lib/data-cache.ts`:
   - `cachedGet(key, fetcher, ttlMs = 5min)`: module-level Map, in-flight
     request dedup (simultaneous same-key calls share one fetch), rejections
     never cached, TTL expiry refetches.
   - `invalidateDataCache(key)`, `invalidateDataCachePrefix(prefix)`,
     `clearDataCache()` (exported for tests / future logout hygiene; NOT
     wired into auth — "no change to auth behavior" per issue).
2. `src/lib/lists-api.ts`:
   - `getLists()` -> key `lists:all`; `getList(id)` -> `lists:{id}`;
     `getListWithClassroom(id)` -> `lists:{id}:classroom`.
   - `createList` / `updateList` / `deleteList`: on success, invalidate
     prefix `lists:` (covers collection + single + classroom entries).
   - `notifyListsChanged()`: also invalidates `lists:` (import/migration
     path fires this event without going through the write functions).
3. `src/lib/spelling-api.ts`:
   - `getUserByEmail(email)` -> key `user:{lowercased email}`.
   - NEW export `invalidateUserCache(email)`; called by ProfileForm.
4. `src/components/ProfileForm.tsx`: after successful profile PUT in
   `doSave`, call `invalidateUserCache(session.user.email)` so the Header's
   cached user doc never shows a stale name/photo after a profile edit.
   (Spelling-data writes in spelling-api.ts touch /spelling subresource,
   not the user doc, so they do not invalidate.)
5. `AGENTS.md`: durable lesson — any new write path to /api/lists or
   /api/users must invalidate the data-cache, since reads are cached.

Not cached (out of scope): onboarding flow in home/page.tsx (one-shot),
getSpelling (no client callers), class-rules fetches (write-through, small).

## Test plan

- NEW `src/lib/data-cache.test.ts`: miss/hit, TTL expiry (fake timers),
  in-flight dedup, rejection not cached + in-flight cleared, invalidate key,
  invalidate prefix, clear. 100% coverage of the new module.
- `src/lib/lists-api.test.ts`: `clearDataCache()` in beforeEach (cache is
  module-level); new tests: getLists served from cache on 2nd call,
  createList/updateList/deleteList invalidate, notifyListsChanged invalidates.
- `src/lib/spelling-api.test.ts`: same beforeEach hygiene; getUserByEmail
  cached by email, invalidateUserCache drops the entry.
- Full suite: `npm run format`, `npm run lint`, `npm run typecheck`,
  `npm run test:unit` (coverage thresholds 100% must hold). No UI change,
  so no e2e/screenshot gate; run the worksheets + present e2e specs only if
  time permits (they exercise the cached paths).
