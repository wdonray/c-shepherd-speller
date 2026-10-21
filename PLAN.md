# PLAN: #511 — Accept all suggestions becomes Approve all (two-state button)

## What

On the worksheet print route's "Sentences needed" gap flow
(`src/components/worksheets/WorksheetsPrintPage.tsx`, `WorksheetsJob`),
turn the "Accept all suggestions" button into a two-state button:

- **State 1 — "Accept all suggestions"** (secondary variant, unchanged behavior):
  fills each gap word's first suggestion into its typed box; never overwrites
  teacher-typed text; skips words with no suggestions.
- **State 2 — "Approve all"** (default primary green variant, matching the
  per-word "Use this sentence" button): appears once EVERY remaining gap word
  has a non-empty typed draft. Tapping it batch-saves all drafts (one
  `updateList`, mirroring `saveSentence`, skipped for prebuilt weeks) and the
  page advances to the print step when the gaps clear.
- **Revert**: clearing a typed box drops back to "Accept all suggestions",
  so an incomplete set can never be approved.
- Words with no suggestions hold the button in accept state until the
  teacher types, removes, or per-word-saves for every word.

## Constraints from the issue

- No layout shift: one `<Button>` in both states, same size/position, with
  `min-w-60` reserving the wider "Accept all suggestions" geometry.
- Approve is disabled while a per-word save is in flight (and vice versa),
  so two read-modify-write updates can never race.
- E2E (desktop + 390px): accept fills all → green "Approve all" → tap
  advances to print; no-suggestion word holds accept state; clearing a
  sentence reverts.
- 100% coverage thresholds hold; no em dashes in user-facing copy.

## Files

- `src/components/worksheets/WorksheetsPrintPage.tsx`
  - Add `approving` state; derive `allGapsFilled` from `typedSentences`.
  - Add `approveAllSentences` (batch save, one updateList, error → gapError).
  - Render the two-state button; pass `busy || approving` into `GapWordRow`.
- `src/components/worksheets/WorksheetsPrintPage.test.tsx`
  - Unit tests: approve appears after accept; approve saves all drafts in one
    updateList and advances to print; clearing a draft reverts; no-suggestion
    word holds accept state; approve disabled during per-word save;
    approve-all error surfaces gapError; prebuilt skips persistence.
- `e2e/worksheets.spec.ts`
  - New describe block for the two-state button covering the issue's E2E list
    at desktop and 390px viewports.

## Verification

`npm run format`, typecheck, full unit suite with coverage, related e2e specs
locally (dynalite + own server on a free port, throwaway config).
