# PLAN-443.md — Issue #443: Let teachers block videos they do not want suggested

(Note: the repo already tracks a stale PLAN.md from an earlier task; this
file is the #443 plan and is deleted before the PR is finished.)

## What
Per-teacher blocked-video set stored on the user profile. "Hide" actions on
(1) suggestion rows in the video modal, (2) home browse cards, (3) present-mode
video modal rows. Blocked videos are filtered from suggestions, in-app search
results, and the home browse section. Reversible via a "Hidden videos" list in
profile settings with per-video Unhide.

## Design decisions
- **Storage shape**: `blockedVideos?: BlockedVideo[]` on `IUser`
  (`{ videoId, title, channel? }`), NOT bare IDs. Reason: the hidden-videos
  list must show titles for every blocked video, including teacher-pasted
  custom videos whose titles live nowhere else. Title/channel are snapshotted
  at block time. Deduped by videoId server-side.
- **API shape**: extend `PUT /api/users/[id]` with a `blockedVideos` field
  (validated, sanitized, field-scoped write via existing `updateUser`), rather
  than a new sub-resource route. Reason: the task pointers name this route as
  the home of teacher-specific profile fields; clients already hold the full
  list so read-modify-write is natural; the PUT response echoes the sanitized
  list so no re-fetch is needed.
- **Client state**: one `useBlockedVideos()` hook (`src/hooks/useBlockedVideos.ts`)
  per page: fetches the profile once, optimistic block/unblock with
  revert+toast on failure. Dashboard calls it and gates its loading skeleton on
  it (per repo layout-shift rule: blocked count changes the browse card count,
  so it must resolve inside the single loading state). PatternEditor and
  PatternChartDisplay each call it and pass `blockedVideoIds` + `onHideVideo`
  into PatternVideoModal. The modal itself never fetches the profile.
- **Hide semantics on attached rows**: Hide = unattach from the current list
  AND block (spec: "don't ever show me this video again"). Blocking alone does
  not detach videos from other patterns (spec only filters suggestions, search,
  browse).

## Files to change
- `src/models/User.ts`: `BlockedVideo` interface + `blockedVideos?: BlockedVideo[]` on `IUser`
- `src/types/User.d.ts`: `UpdateUserBody.blockedVideos`
- `src/lib/spelling-api.ts`: client `User.blockedVideos`
- `src/lib/db-utils.ts`: `updateUser` signature (type-only)
- `src/lib/youtube.ts`: export `isYouTubeVideoId()` (strict 11-char check)
- `src/app/api/users/[id]/route.ts`: `parseBlockedVideos` validation (array,
  object entries, YouTube-ID videoId, title 1..200, channel <=100, dedupe by
  videoId, cap 200; 400 'Invalid hidden videos') + wiring into `updateData`
- `src/hooks/useBlockedVideos.ts`: NEW hook (fetch, blockVideo, unblockVideo)
- `src/components/PatternVideoModal.tsx`: optional `blockedVideoIds` /
  `onHideVideo` props; filter suggestions + search; "Hide" ghost buttons
  (EyeOff icon) on suggestion, search, and attached rows; docstring update
- `src/components/Dashboard.tsx`: call hook; `loading` also waits for blocked
  fetch when authenticated; `SongVideosSection` filters cards, Hide overlay
  pill on cards (restructure card button into div + inner play button)
- `src/components/PatternEditor.tsx`: call hook, pass props to modal
- `src/components/PatternChartDisplay.tsx`: call hook, pass props to modal
  (covers present mode via DisplayMode)
- `src/components/HiddenVideosSection.tsx`: NEW profile section (list +
  Unhide + empty/loading states)
- `src/app/profile/page.tsx`: render the section; metadata mentions hidden videos

## Test plan
- Unit (100% coverage thresholds; every new line/branch):
  - route.test.ts: valid array, dedupe, channel trim/drop, empty clears,
    non-array, over-cap, bad videoId (non-string, malformed), bad title
    (non-string, blank, too long), bad channel (non-string, too long)
  - youtube.test.ts: `isYouTubeVideoId` valid/invalid/edge
  - useBlockedVideos.test.ts: signed-out, session-loading, missing email,
    load success/failure, block (add, dedupe, no-user, channel-less, persist
    failure revert+toast, server echo fallback), unblock (remove, missing id,
    no-user, failure revert)
  - PatternVideoModal.test.tsx: blocked filtered from suggestions and search,
    Hide on suggestion calls onHideVideo, Hide on attached row calls onChange
    removal + onHideVideo, no Hide UI when onHideVideo omitted
  - Dashboard.test.tsx (hook mocked): blocked cards filtered, Hide button
    calls blockVideo, no Hide when signed out, loading gate waits for blocked
  - PatternEditor/PatternChartDisplay tests (hook mocked): props passed through
  - HiddenVideosSection.test.tsx (hook mocked): loading, empty, list, unhide,
    unhide failure
- E2E (new `e2e/hidden-videos.spec.ts`): hide from browse card, verify gone;
  unhide from profile, verify back; hide from modal suggestions.
- Regression e2e: `video-modal-mobile.spec.ts`, `no-layout-shift.spec.ts`
  (dashboard CLS), plus full unit suite with coverage, lint, typecheck, prettier.
- Screenshots (local Playwright, never committed): browse cards with Hide,
  modal with Hide buttons, profile hidden-videos list.

## Out of scope
#88, sentry issues, any other issue/PR; game logic, auth, payments untouched.
