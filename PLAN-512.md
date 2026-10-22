# PLAN: #512 — Pre-print customization options for worksheets (font size, style, layout)

## Scope (Donray 2026-10-21: keep narrow)

#512 covers the pre-print options UI ONLY. Explicitly out of scope, proceeding as
separate issues: #516 (Name/Date header), #517 (uniform blanks), #519 (word
search difficulty), #522 (sentence caps). Writing-line variants and font-style
choices from the candidate list are also out: no sheet renders handwriting-ruled
lines to vary, and research (Dyslexia Scotland; 2019 PLOS ONE) says spacing beats
typeface, so font knobs add prep work for no readability gain.

## Research summary

- Deep research report (report.md sections 1-3) plus audit-our-worksheets.md:
  body 12-14pt min (14pt ideal younger), word-search letters 14pt+ (18-24pt
  large-print), BDA dyslexia spacing (letter +0.03em, word >=3.3x letter
  spacing, line 1.5x), answer keys separate/toggleable (WorksheetWorks,
  simplified.tools "show answer key" toggle).
- Generator UX prior art (freeworksheetgenerator.com): controls panel beside a
  live preview that updates as you go, then print. Zero-prep survives via
  presets, not per-knob fiddling.

## Design

- The `/lists/[id]/worksheets/print` page becomes a real preview: options panel
  (`print:hidden`) above the sheets, Print button calls `window.print()`.
  The auto-`window.print()` on load is REMOVED (it would fire before the teacher
  can touch options). One extra click vs before; defaults preserve old output.
- Presets (radio group, classroom language), persisted per teacher in
  localStorage (existing `useLocalStorage` pattern):
  - Standard: regular type and spacing (today's rendering, unchanged).
  - Large print: bigger type for younger readers. Body to 14pt, puzzle grid
    letters to 18pt with larger cells (44px ~= 11.7mm, clears the 9mm spec),
    sub-headings to 17pt (keeps >=20% over body per BDA).
  - Dyslexia-friendly: same sizes as standard, BDA spacing (letter +0.03em,
    word 0.1em, line-height 1.5) via one container CSS rule so the on-screen
    preview matches the printed page.
- Answer key toggle (checkbox, default ON = today's behavior): "Include answer
  key". Per print job, NOT persisted (issue says per print job).
- Preset application: a `PrintPresetContext` in WorksheetSheets.tsx
  (`usePrintPreset()`, defaults to 'standard' so sheets stay usable standalone).
  Small preset->class maps for body text, sub-headings, grid cells/letters,
  crossword clue numbers. Dyslexia spacing is container CSS
  (`.print-sheets[data-preset='dyslexia-friendly']` in globals.css) because
  letter/word/line spacing inherit naturally; no per-element work.
- No layout shift: preset changes swap classes in place (no remount, no
  spinners); the options panel is fixed content above the sheets.

## Files

- NEW `src/lib/print-options.ts`: `PrintPreset` type, `PRINT_PRESETS`
  (id/label/description), `DEFAULT_PRINT_PRESET`, `PRINT_PRESET_STORAGE_KEY`,
  `parsePrintPreset()` (validates stored value, falls back to standard).
- NEW `src/lib/print-options.test.ts`: parse valid/invalid/empty, constants.
- EDIT `src/components/worksheets/WorksheetSheets.tsx`: context + hook,
  preset class maps (body, subhead, grid cell, grid letter, clue number).
- EDIT `src/components/worksheets/WorksheetsPrintPage.tsx`: options panel,
  remove auto-print, `data-preset` on `.print-sheets` container, answer-key
  toggle, localStorage persistence of preset.
- EDIT `src/app/globals.css`: dyslexia-friendly container spacing rule.
- EDIT `src/components/worksheets/WorksheetsPrintPage.test.tsx`: new flow
  (no auto-print; Print button prints), preset selection + persistence +
  invalid fallback, answer-key toggle.
- EDIT `src/components/worksheets/WorksheetSheets.test.tsx`: sheets render
  in each preset (classes applied), hook default without provider.
- EDIT `e2e/worksheets.spec.ts`: options panel visible; Print button calls
  window.print (counted stub).

## Test plan

- `npm run format`, oxlint, typecheck, full unit suite with coverage
  (100% thresholds hold).
- Related e2e: `npx playwright test e2e/worksheets.spec.ts` (needs DynamoDB
  local per repo AGENTS.md).
- Playwright screenshot of the options panel for visual review (not committed).

## Copy (adult-educator tone, no em dashes, classroom language)

- "Print options" / "Set how the worksheets print. Your print style is saved
  for next time."
- Presets: Standard ("Regular type and spacing."), Large print ("Bigger type
  for younger readers."), Dyslexia-friendly ("Extra spacing between letters,
  words, and lines.")
- "Include answer key" ("Print the teacher answer key after the worksheets.")
- Button: "Print worksheets".
