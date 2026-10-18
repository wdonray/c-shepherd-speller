# PLAN: Let teachers block videos (#443)

Per-teacher block list for song videos. A blocked video never appears in
suggestions, search, home browse, or present-mode rows for that teacher.
Reversible from profile settings.

## Changes

- `src/models/User.ts` + `src/types/User.d.ts`: `blockedVideoIds: string[]`
  on the user profile (zod schema, defaults to empty).
- `src/lib/db-utils.ts`, `src/lib/spelling-api.ts`: read/write the block list.
- `src/app/api/users/[id]/route.ts`: PATCH accepts blockedVideoIds.
- `src/lib/youtube.ts`: `isYouTubeVideoId` helper; filter helpers skip
  blocked IDs in suggestions/search results.
- `src/components/PatternVideoModal.tsx`: Hide action on suggested and
  attached video rows; blocked IDs filtered from suggestions.
- `src/components/Dashboard.tsx`: Hide on home browse cards; blocked IDs
  filtered from the browse section.
- `src/components/PatternChartDisplay.tsx`, `src/components/PatternEditor.tsx`:
  present-mode video rows respect the block list.
- `src/app/profile/page.tsx`: hidden-videos list with Unhide actions.

## Tests

Unit tests alongside each change (route, modal, dashboard, profile,
youtube helpers). Verified: prettier, oxlint (0 errors), tsc clean,
151 tests passing across the touched files.
