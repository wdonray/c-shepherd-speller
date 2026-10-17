# PLAN.md — Issue #373: Remove the long small sentence under patterns on the present page

## What

Remove the centered helper caption under the present chart:
"Tap a word to see its analysis, or press the speaker icon to hear it. Patterns are ordered by how common the spelling is; longer bars mean more common."

## Files

1. `src/components/PatternChartDisplay.tsx`
   - Delete the `CHART_CAPTION` export (its only purpose was this caption and the skeleton's invisible-copy placeholder).
   - Delete the `{!isPrint && <p className="mt-6 ...">{CHART_CAPTION}</p>}` line.
2. `src/components/DisplayMode.tsx`
   - Delete the `CHART_CAPTION` import.
   - Delete the skeleton caption placeholder block in `DisplayChartSkeleton`
     (`<p className="mt-6 text-center text-sm"><GhostText text={CHART_CAPTION} .../></p>`):
     the skeleton must stay geometrically identical to the loaded chart, which no longer has the caption.
3. `src/components/PatternChartDisplay.test.tsx`
   - Replace the "explains the frequency encoding in the caption" test (asserts the caption IS present)
     with a test asserting the caption text is NOT in the document in present mode (issue #373).
   - The "hides the interactive caption in print" test still passes unchanged (absence holds).

## Test plan

- `npm run format` first (prettier), then `npm run lint`, `npm run typecheck`.
- Full unit suite with coverage thresholds: `npm run test:unit` (or the repo's coverage command).
- `e2e/display.spec.ts` regression check (chart renders, no visual difference beyond the removed line).
- Quick Playwright screenshot before/after is overkill for a line deletion; rely on the spec.
