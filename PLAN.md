# PLAN: Fully remove odd ducks (#381)

Remove the entire odd-ducks feature: model fields, UI, sort-game logic,
tests. Legacy stored data with `oddDucks`/`isOddDuck` still parses because
zod strips unknown keys (no migration needed).

## Source changes

1. `src/models/WordList.ts`: remove `oddDucks` and `isOddDuck` fields from
   SpellingPatternSchema; update module docstring ("odd ducks = irregulars").
2. `src/lib/sort-activity.ts`: buildWordBank collects ALL words; update comment.
3. Delete `src/components/OddDuck.tsx` + `OddDuck.test.tsx` entirely.
4. `src/components/PatternChartDisplay.tsx`: drop OddDuck import, oddDuckWords
   memo, isOddDuck word-card styling, and the "Odd ducks" section.
5. `src/components/PatternEditor.tsx`: drop OddDuck import, oddDucks cleanup
   in removeWord, toggleWordOddDuck, and the odd-duck toggle button in
   renderWordActions (the Tooltip wrappers stay for the remaining buttons).
6. `src/components/SortActivity.tsx`: drop OddDuck import, oddDuckWords memo,
   and the "Odd ducks, already placed" section.
7. `src/components/WordAnalysis.tsx`: drop `odd` const, plum underline
   variant, and the "Odd duck" note section.
8. `src/components/HelpDialog.tsx`: remove the odd-duck FAQ entry.
9. `src/components/PatternListsManager.tsx`: drop OddDuck import; delete-dialog
   illustration becomes a lucide warning icon (TriangleAlertIcon, text-coral).
10. `src/components/PracticeMode.tsx`: drop OddDuck import; review pill and
    review-mode banner use lucide RotateCcwIcon (retry semantics), keep plum
    styling.
11. `src/components/DisplayMode.tsx`: update comment (remove "odd ducks" from
    the unknowable-layout list).
12. `DESIGN_PLAN.md`: update the two stale word-row button lists
    (mic, sentence, remove).
13. `e2e/display.spec.ts`: remove `isOddDuck` from the seed pattern and the
    "Odd ducks" band assertion.

## Test changes (100% coverage thresholds must stay green)

- Delete `src/components/OddDuck.test.tsx`.
- `PatternChartDisplay.test.tsx`: drop `isOddDuck` fixture, delete the
  word-level odd-duck print test, reword the no-band test.
- `PatternEditor.test.tsx` / `.mobile.test.tsx`: delete odd-duck toggle
  mark/unmark tests, drop `isOddDuck` render prop.
- `SortActivity.test.tsx`: drop `isOddDuck` fixture, delete the
  "already placed" test, adjust bank wording.
- `SortActivity.sensors.test.tsx`, `.mobile.test.tsx`: drop `isOddDuck`
  fixtures.
- `src/lib/sort-activity.test.ts`: drop `isOddDuck` fixtures, delete the
  word-level exclusion test, adjust wording.
- `src/models/WordList.test.ts`: delete the four odd-duck schema tests.
- `WordAnalysis.test.tsx`: delete the three isOddDuck tests.
- `HelpDialog.test.tsx`: drop the odd-duck FAQ assertion.
- `ui/tooltip.test.tsx`: replace "Mark as odd duck" fixture text with neutral
  copy.
- `DisplayMode.test.tsx`: update the comment mentioning odd ducks.

## Test plan

- `npm run format`, oxlint, tsc typecheck, full vitest suite with coverage
  thresholds (100%).
- e2e/display.spec.ts locally (DynamoDB Local); if the local stack cannot
  run, say so.
- Local Playwright screenshots of the present chart and sort page (not
  committed) to verify no layout breakage.
