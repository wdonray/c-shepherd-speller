# PLAN.md — Issue #523: Worked example on cut-and-paste sheet

## What
Add one worked example to the `CutSortSheet` student sheet: the first word of
the first (most frequent) pattern column is pre-placed in its paste box,
clearly marked "Example". That word is removed from the cut-out bank below.
The answer key is unchanged (all boxes filled, no example marker).

## Files
- `src/components/worksheets/WorksheetSheets.tsx` — `CutSortSheet` only.
  - Student sheet: first box of first column renders the word plus an
    `EXAMPLE` tag inside the box (text classes only, black on white, no gray
    per the photocopy rule); aria-label becomes
    `Example: <word> is sorted under <pattern>`; remaining empty boxes keep
    their positional numbering (`Paste box 2 under ...`, etc.).
  - Word bank: `groups.flatMap(...).filter(...)` drops exactly the first word
    of the first group (index-based, not value-based, so a duplicate word in
    another column is not affected) before `shuffleWords`.
  - Instruction paragraph gains one short sentence:
    "One word is placed as an example."
  - Docstring updated.
- `src/components/worksheets/WorksheetSheets.test.tsx` — update
  `CutSortSheet` tests for the new labels, the bank minus the example word,
  and the new expected shuffle order; add tests for the example tag and the
  unchanged answer key.

## Design notes
- Deterministic: always the first word of the first column. No RNG, so prints
  and the answer key are stable.
- No layout shift: paste-box heights (`PASTE_BOX`) are fixed; the tag lives
  inside the box, so it cannot overlap the column header.
- Black and white only; the tag uses text classes (no `border-neutral`,
  which the photocopy test forbids).

## Test plan
`npm run format`, lint (oxlint), typecheck, full unit suite with coverage
(100% thresholds hold), then run `e2e/worksheets.spec.ts` locally as the
regression check for this UI flow.
