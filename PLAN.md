# PLAN.md — Issue #488: word-chip grid (idea worker run 2026-10-19)

## What

Replace per-word full-width cards with a compact tappable word-chip grid
inside each pattern column of the present chart (PatternChartDisplay).

## Spec (Donray-authored, ready)

- Each word becomes a compact chip; the WHOLE chip is the audio tap target
  (44px minimum touch target), no separate speaker button per word.
- 2 columns on mobile, 3 on desktop; grid nests inside the existing
  side-by-side pattern columns.
- Present-mode chips slightly larger (arm's-length tapping on projector).
- Pattern headers (sound, frequency dots, rule) stay exactly as-is.
- Visible audio affordance on chips (speaker icon) so teachers know they
  are tappable.
- Tap-to-hear keeps working everywhere (list detail, present mode, practice).

## Design decisions

- Present variant only. Print poster keeps its existing plain-text rows
  (issue #402: print layout is locked; chips are tappable, print is not).
- Chip = single `<button onClick={speak(word)}>` with word text + small
  Volume2 icon. `min-h-[56px]` (exceeds the 44px floor = "slightly larger"
  for present mode), `text-[22px]` (matches current word size), rounded-full.
- Grid: `grid grid-cols-2 gap-2 md:grid-cols-3` on the words `<ul>`.
- Long words: keep the issue #415 fix (min-w-0 + break-words) so chips
  shrink inside grid tracks instead of bleeding.
- Underlines (showUnderlines) keep working inside chips.
- **Analysis tap**: the spec redefines the tap as audio-only. The chart's
  "Analyze the word" entry point is removed per the spec; WordAnalysis.tsx
  and its tests are RETAINED (not deleted) and the PR body flags that the
  modal lost its chart trigger, so Donray can say delete or re-home.
  Nothing else references WordAnalysis.

## Files

- `src/components/PatternChartDisplay.tsx`: grid + chip, remove analysis
  wiring (openAnalysis, selected state, WordAnalysis render), docstring
  touch-ups. Print branch untouched.
- `src/components/PatternChartDisplay.test.tsx`: update word-card tests to
  chip behavior (tap speaks; no analysis dialog from chart).
- `e2e/word-chips.spec.ts`: NEW. Seeds a list, visits /lists/[id],
  asserts chip grid renders (2-col mobile grid class), chips are buttons
  named "Hear the word X", clicking a chip calls speechSynthesis.speak
  with the word (stubbed via addInitScript).

## Test plan

1. `npm run format`
2. lint (oxlint), typecheck
3. Full unit suite with coverage thresholds (100% on touched code)
4. New e2e spec locally (needs DynamoDB Local + build + free port per
   AGENTS.md; hyphen-free dummy creds)
5. 390px visual check via Playwright screenshot (not committed)
