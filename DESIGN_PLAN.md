# Pattern Card Redesign Plan (Issue #324)

**Scope:** the pattern editing card on the list edit page (`src/components/PatternEditor.tsx`).
Restyle and reorganize only. No features added or removed. Page layout
(`ListEditorPage.tsx`, the flex-wrap of cards) is untouched.

**Owner bar:** simple and easy for everyday teachers who are not very technical;
decluttered; visually uniform. Works on mobile (~390px) and desktop (1280px+).
Must stay green on the repo's axe-core WCAG 2.2 AA gate (`e2e/a11y.spec.ts`).

---

## 1. Research: patterns this plan follows

Short, citable patterns found via web research. The implementation PR should
be able to point at these when Donray asks "why this shape".

1. **Chunk into labeled groups, not one undifferentiated list.** Group meaning
   with Gestalt cues (proximity, shared spacing, headings); three labeled
   chunks beat one flat list of fields. Fieldset/legend is the accessible
   embodiment.
   Source: `01-ux-fundamentals/cognitive-load-progressive-disclosure.md`
   (https://github.com/eneryleen/ai-web-design-codex/blob/HEAD/01-ux-fundamentals/cognitive-load-progressive-disclosure.md)
2. **One-column layout, labels above inputs.** A single vertical eye path
   reduces missed fields, errors, and perceived complexity versus a Z-shaped
   two-column scan. Group each label tightly with its control.
   Source: https://designlab.com/blog/form-ui-design-best-practices
3. **Google Forms question-card anatomy.** The question text sits on top, the
   content in the middle, and secondary/destructive actions live in a bottom
   action bar inside the card (Duplicate, Delete, Required, More). Destructive
   actions are visible but quiet, separated from content by the bar.
   Source: https://www.makeuseof.com/tag/best-guide-google-forms/
4. **Progressive disclosure: defer, do not delete.** Show frequently needed
   options up front; move the rest one step away while keeping full
   capability. A dedicated editing task may keep more controls visible than a
   creation form. When an optional control has a value, show a short summary
   beside its entry point so the choice stays discoverable without reopening it.
   Sources: the ai-web-design-codex doc above and
   http://dev.to/aisongsmaker/progressive-disclosure-in-creative-forms-keep-the-draft-hide-the-options-224a
5. **Settings-row anatomy (iOS/macOS convention).** Secondary controls render
   as uniform rows: icon, label, current-value summary, chevron. Identical row
   height and alignment across rows makes a block of options scannable at a
   glance.

---

## 2. Diagnosis: why the current card feels cluttered

Mapped from the current `PatternEditor.tsx` structure to the owner's complaint:

- **Mixed control styles.** The pattern input is a custom 22px bold field, the
  sound input a 15px muted field, the frequency control a custom icon-only
  radiogroup with a detached text label, the add-word row a shadcn Input plus
  chunky Button, delete a custom text button, lock a custom pill, and the
  keyword image a dashed box. Seven visual languages in one card.
- **Z-shaped scan path.** The header is a `flex-wrap` two-column row: pattern
  input left, frequency radiogroup right. Research pattern 2 says this path
  causes missed fields and reads as more complex than it is.
- **Labels are not labels.** "Keyword image" and "Frequency" are plain `span`s,
  "Sound:" is an inline prefix span (left-label anti-pattern), while "Spelling
  pattern" uses the shadcn `Label`. Inconsistent, and the sound field's visible
  text is not programmatically associated (it only has `aria-label`).
- **Sections compete.** Accent bar, Unsaved badge, keyword image box, frequency
  radiogroup, rule row, try chips, words table, add-word row, footer actions
  all carry similar visual weight. Nothing says "primary vs secondary".

---

## 3. Information hierarchy

| Priority  | Content                                       | Treatment                                          |
| --------- | --------------------------------------------- | -------------------------------------------------- |
| Primary   | Pattern spelling, sound, words list, add-word | On the card surface, full weight                   |
| Secondary | Frequency, spelling rule, keyword image       | One grouped, visually quieter block ("Details")    |
| Tertiary  | Lock pattern, delete pattern                  | Bottom action bar, separated by a rule (pattern 3) |

**Ordering rationale.** A teacher building a list does one loop: name the
pattern, say its sound, add its words. Frequency, rule, and keyword image are
set once per pattern and then rarely touched, so they belong in a demoted but
fully visible group. Per research pattern 4, a dedicated editing surface may
keep secondary controls visible rather than hiding them behind a disclosure,
which would bury a per-pattern teaching decision. Lock/delete are destructive
or state-changing, so they sit apart in the footer bar per pattern 3.

**Nothing is removed.** Frequency selector, keyword image, rule affordance,
try-word chips, lock, and delete all keep their behavior; each is restyled or
relocated, with the justification in section 7.

---

## 4. New card anatomy

Single column at every width. Sections separated by whitespace and one
consistent section-heading treatment (no rules between sections; the footer
bar keeps its top border per pattern 3).

```
+----------------------------------------------------------+
| accent bar (kept, top, list color)                       |
|                                                          |
|  A. PATTERN (identity block)                             |
|     [Spelling pattern ............] [Unsaved badge]      |
|     Sound                                                |
|     [long a .........]                                   |
|                                                          |
|  B. WORDS (4)                                            |
|     Try: (chips, only when suggestions exist)            |
|     words table (desktop) / stacked cards (mobile)       |
|     [Add a word .........] [Add]                        |
|                                                          |
|  C. DETAILS                                              |
|     +---------------- quiet well --------------------+  |
|     | Frequency                      (i)              |  |
|     | [Common|Less common|Rare] segmented             |  |
|     | ------------------------------------------------  |
|     | [icon] Spelling rule    "ay says long a"   [>]  |  |
|     | ------------------------------------------------  |
|     | [thumb] Keyword image   "apple"             [>]  |  |
|     +-----------------------------------------------+  |
|                                                          |
|  ------------------------------------------------------ |
|  Delete pattern                        [Lock pattern]   |
+----------------------------------------------------------+
```

### 4a. Mobile (~390px)

- Card padding `p-4`.
- Identical section order. Everything stacks; nothing sits side by side except
  the add-word row (input flex-1 + Add button; fits at 390px) and the footer
  row (delete left, lock right; both fit, `flex-wrap` as safety).
- Frequency segmented control: full width, three equal segments.
- Words render as the existing stacked mini-cards (keep `MOBILE_QUERY` at
  767px and the stacked-card markup; restyle only to the new type scale).

### 4b. Desktop (1280px+)

- Card padding `p-6`.
- Same single-column order. The card is one column of the pattern chart, so
  the internal layout must not go multi-column at any width.
- Words render as the existing table (keep columns Word / Example sentence /
  Actions; keep `max-w-[300px] truncate` on sentences).
- Details well: max content width is the card width; rows are full-bleed
  inside the well.

### 4c. What the page around the card does

Nothing. `ListEditorPage.tsx` keeps its `flex flex-wrap` of cards, card
widths, and the add-pattern affordance. The accent bar, Unsaved badge logic,
and card `aria-label` are unchanged.

---

## 5. Uniform control system (exact)

### 5a. Spacing rhythm (4px base)

- Card padding: `p-4` mobile, `p-6` desktop.
- Between sections (A/B/C/footer): `space-y-6` (24px).
- Between blocks inside a section (chips to table to add-row; rows in the
  well): `space-y-4` (16px).
- Label to control: `space-y-2` (8px).
- Inline gaps: `gap-2` (8px) for chips and tight rows, `gap-3` (12px) for
  control rows.
- Footer bar: `border-t-2 border-line pt-4` (16px), kept from today.

### 5b. Type and label treatments (exactly two)

1. **Field labels:** the shadcn `Label` component everywhere
   (`text-sm font-medium leading-none`). This fixes "Sound:", "Frequency",
   and "Keyword image", which are currently spans.
2. **Section headings:** one style for "Words (n)" and "Details":
   `text-[13px] font-bold uppercase tracking-[0.06em] text-muted-foreground`,
   rendered as `h4` (keeps today's heading level for "Words"; add the same
   for "Details"). "Words (4)" keeps its count.

### 5c. Input style (one style, two sizes)

- Base: the existing shadcn `Input` untouched
  (`h-12 rounded-xl border-2 border-line bg-card px-4 text-base`,
  `focus-visible:border-sky-deep focus-visible:ring-[3px]`).
- Hero: the pattern spelling input is the one larger field in the card
  (it is the card's identity): base Input plus `h-14 text-xl font-bold` and
  the existing accent text color. Same border, radius, and focus treatment
  as every other input. The current `text-[22px]` becomes `text-xl` and the
  custom padding overrides are deleted.
- Sound input: becomes a plain base Input with a `Label` above it
  ("Sound"). Delete the inline "Sound:" prefix span and the custom
  `h-9 text-[15px] text-muted-foreground` overrides.

### 5d. Button hierarchy (three levels, from the existing variants)

1. **Primary:** `Button variant="default"` (chunky green). Exactly one per
   card: the "Add" word button.
2. **Secondary:** `Button variant="secondary"`. The lock toggle becomes a
   secondary button (`aria-pressed` kept) with lock/unlock icon and label
   "Locked" / "Lock pattern". The keyword-image and rule rows use the
   settings-row anatomy in 5e, not buttons.
3. **Quiet destructive:** `Button variant="ghost"` with `text-destructive`.
   The "Delete pattern" footer button: ghost button, trash icon, bold label.
   Visible but quiet, per pattern 3. The existing confirm flow is untouched.

Word-row icon buttons (mic, odd-duck, sentence, remove) are already uniform
44px round buttons; keep them as is.

### 5e. Settings-row anatomy (Details well)

Frequency, rule, and keyword image all render as rows with identical anatomy
(pattern 5):

```
[min-h-[56px] row] [icon or 44px thumb] [label + summary stacked] [chevron or control]
```

- Row: `flex min-h-[56px] w-full items-center gap-3 rounded-xl px-3`
  (56px gives the 44px touch target breathing room).
- Left: `size-5` lucide icon in `text-muted-foreground`, or a `size-11`
  rounded preview for the keyword image.
- Middle: label (`text-sm font-bold text-ink`) over a summary line
  (`text-[13px] text-muted-foreground truncate`): the saved rule text or
  "Add a rule"; the keyword name/emoji or "Not set".
- Right: `ChevronRightIcon size-5 text-muted-foreground` for rows that open
  an editor; the frequency segmented control instead for its row.
- Dividers between rows: `divide-y divide-line` on the well's row container.

### 5f. Details well container

`rounded-2xl border-2 border-line bg-muted/40 p-4 space-y-4` around the three
rows. The tinted well is the single Gestalt cue (pattern 1) that says
"secondary, set once". The "Details" `h4` sits above the well in the section
heading treatment.

---

## 6. Element-by-element spec

### 6a. Pattern identity block (section A)

- Row: `Label htmlFor="pattern-spelling-{id}"` ("Spelling pattern") plus the
  Unsaved badge (unchanged markup, `role="status"`).
- Input: hero style from 5c. Keep `placeholder="e.g. a_e"`, `maxLength={20}`,
  `aria-label="Pattern spelling"`.
- Sound field below: `space-y-2`, `Label` ("Sound"), base Input,
  `placeholder="e.g. long a"`, `maxLength={50}`. Delete the `aria-label`
  (the real label now names it) or keep it identical; do not change the
  accessible name.
- The keyword image box leaves the header entirely (moves to 6d).

### 6b. Words section (section B)

- `h4` "Words (n)" in the section heading treatment.
- Try chips: keep the `role="group"` with its labelled "Try:" prefix. Restyle
  chips to one pill style: `min-h-[44px] rounded-full border-2 border-line
bg-card px-4 text-[15px] font-bold text-ink hover:border-sky-deep
hover:text-sky-ink` with the standard `focus-visible:ring-[3px]`. The
  current sky-tinted chips are a fourth accent color in the card; the neutral
  pill with sky hover matches the well rows and reduces color noise. Keep the
  max-3 suggestion logic and filtering.
- Words table (desktop): keep structure, columns, and 44px action buttons.
  Restyle header row text to the section heading treatment for the `th`s?
  No: keep `th` as `text-[13px] font-bold text-ink` (column headers are not
  section headings). Keep `rounded-2xl border-2 border-line` wrapper.
- Stacked word cards (mobile): keep the `h5` word heading and labeled
  sentence block; align padding with the new rhythm (`p-4`).
- Add-word row: unchanged behavior (Enter to add, mismatch dialog,
  dedupe). Markup: base Input (`aria-label="New word"`, or better, a real
  `Label` with `sr-only` so the visible design is unchanged but the label is
  programmatic) plus `Button variant="default"` "Add", `disabled` when empty.
  Keep `max-w-md` on the row.

### 6c. Frequency (in the Details well)

- Row 1 of the well. Label line: `Label` "Frequency" plus the existing info
  `button` (opens `FrequencyHelpDialog`, unchanged) with its tooltip.
- Control: proper segmented control, `role="radiogroup"` kept on the
  container:
  `flex rounded-xl border-2 border-line bg-card p-1 gap-1` (full width on
  mobile, `sm:w-auto` is unnecessary; full width is fine at all sizes inside
  the well).
- Each option: `role="radio"`, `aria-checked`, `flex-1 flex min-h-[44px]
items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-bold`,
  containing the `PowerBar` glyph (`size` small) and the visible text label
  ("Common", "Less common", "Rare").
- Selected: `bg-{accent}-soft text-{accent}-ink border-2 border-current` is
  noisy; use the well-consistent selected style:
  `bg-sky-soft text-sky-ink` with `aria-checked`, unselected
  `text-muted-foreground hover:text-ink`. Keep the accent-colored PowerBar
  fill (frequency color-coding is existing product language) but drop the
  per-option accent border/text so the control reads as one unit.
  Keep the `focus-visible:ring-[3px] focus-visible:ring-ring/60`.
- This fixes today's gap where the options are icon-only and the visible
  "Less common" text is detached from the control (visible label should name
  the control). `FREQUENCY_LABELS` text moves into the options; the separate
  selected-value line is deleted.
- Keep the per-option `aria-label` with the meaning sentence
  ("Common. Shows up in most words with this sound...") so screen-reader
  users keep the teaching-order guidance.

### 6d. Spelling rule (in the Details well)

- Row 2 of the well. The existing `PatternRuleEditor` trigger button already
  has the right anatomy (icon, summary-or-placeholder, chevron); restyle it
  to the settings-row classes in 5e: remove its own `border-2`, keep it a
  full-row button with `min-h-[56px]`, label text "Spelling rule" bold with
  the rule summary beneath (two-line middle stack), chevron right.
  Implementation: add a `rowClassName`-style prop or restyle inside
  `PatternRuleEditor`; do not touch the modal internals, save logic, or the
  "Shared with {className}" caption (keep the caption under the row).
- Empty state summary: "Add a rule" in `text-muted-foreground`.

### 6e. Keyword image (in the Details well)

- Row 3 of the well. Restyle the `KeywordImagePicker` trigger to the
  settings-row anatomy: `size-11 rounded-xl` preview (photo, large emoji, or
  the dashed placeholder, all at 44px) on the left, middle stack with label
  "Keyword image" and summary (the chosen name/emoji or "Not set"), chevron
  right. The picker's dialog/popover internals are untouched.
- Justification for the move: beside the pattern input it competed with the
  hero field; as a row it keeps its full behavior with a fraction of the
  visual weight, and the summary line keeps the current choice discoverable
  (pattern 4).

### 6f. Footer action bar

- `mt-6 flex flex-wrap items-center justify-between gap-3 border-t-2
border-line pt-4` (unchanged geometry).
- Left: "Delete pattern" as `Button variant="ghost"` + `text-destructive`,
  trash icon, `min-h-[44px]`. Keep the parent's confirm flow (`onRemove`).
- Right: lock toggle as `Button variant="secondary"` with `aria-pressed`,
  lock/unlock icon, "Locked" / "Lock pattern". Keep the tooltip text
  ("Locked patterns are hidden in present mode until you unlock them.").
- The footer is the only place a `border-t` appears in the card.

---

## 7. Group / reorder / demote / remove decisions

| Element                     | Decision                                  | Justification                                                                                                      |
| --------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Pattern input               | Keep, hero size, same input style         | Card identity; one hero field per card is fine                                                                     |
| Sound input                 | Keep, standard Input, label above         | Fixes the inline-prefix anti-pattern and the non-programmatic label                                                |
| Keyword image               | Move to Details well row                  | Was competing with the hero field; behavior unchanged, choice stays visible as a summary line                      |
| Frequency                   | Move to Details well as segmented control | Was a second visual column fighting the header; teaching-order decision is per-pattern setup, not the core loop    |
| Rule affordance             | Move to Details well row                  | Same as keyword image; modal untouched                                                                             |
| Try-word chips              | Keep in Words section, neutral pill style | Content suggestions belong with words; color noise reduced                                                         |
| Words table / stacked cards | Keep both, restyle only                   | Responsive behavior already correct                                                                                |
| Add-word row                | Keep, unchanged                           | Primary action of the core loop                                                                                    |
| Delete pattern              | Keep in footer, quiet ghost style         | Pattern 3: destructive actions live visibly but quietly in the card's bottom bar; confirm dialog is the safety net |
| Lock pattern                | Keep in footer, secondary toggle          | State-changing; belongs with the other card-level action, not mixed into content                                   |
| Unsaved badge               | Keep, next to the pattern label           | Unchanged                                                                                                          |
| Accent bar                  | Keep                                      | List color identity                                                                                                |

**Removed: nothing.** Every control keeps its behavior. If the owner later
wants the Details well collapsible, that is a follow-up; the well's rows
already have the anatomy a disclosure would need.

---

## 8. Accessibility notes

- **Heading order:** card is `section` with `aria-label` (kept). Section
  headings are `h4` ("Words (n)", "Details"); mobile word cards keep `h5`.
  Verify against the page: the list edit page must supply h1-h3 above the
  cards. If it does not, file a separate page-level issue; do not renumber
  inside this PR.
- **Label associations:** every input gets a real `Label` (`htmlFor`).
  Converts the sound field, frequency group, and keyword image row from
  spans to programmatic labels. Add-word input gets an `sr-only` real label.
- **Keep accessible names byte-identical** where tests or AT depend on them:
  pattern input `aria-label="Pattern spelling"`, frequency group label,
  mic/odd-duck/sentence/remove word buttons, delete/lock buttons. Do not
  rename; restyle only.
- **Touch targets:** 44px minimum everywhere (already true for word-row
  buttons; enforce on segmented options `min-h-[44px]`, well rows
  `min-h-[56px]`, chips `min-h-[44px]`, footer buttons `min-h-[44px]`).
- **Focus visibility:** the repo standard `focus-visible:ring-[3px]
focus-visible:ring-ring/60` (or the input/button built-ins) on every
  interactive element. No control may lose its visible focus ring in the
  restyle.
- **Radiogroup pattern:** keep `role="radiogroup"`, `role="radio"`,
  `aria-checked`, arrow-key behavior if any exists; the new visible text
  labels become the accessible names (improves label-in-name, WCAG 2.5.3).
- **Dialogs and recorder:** `FrequencyHelpDialog`, word-delete confirm,
  mismatch warning, `VoiceRecorderModal`, rule modal, `SentencePicker`
  popover: markup and behavior untouched.
- **Motion:** keep `transition` usage as is; no new animation.
- **Tests:** update `PatternEditor` unit tests only where they assert on
  removed class names or structure (e.g. the detached frequency value line,
  the inline "Sound:" span). Keep all `getByRole`/`getByLabelText` queries
  passing by preserving roles and names. Add a11y spec coverage if the new
  "Details" heading introduces a landmark expectation.

---

## 9. Untouched (do not modify in this PR)

- All dialogs: word-delete confirm, pattern-mismatch warning, frequency help.
- `VoiceRecorderModal` and the recording-presence logic (`recordedWords`,
  `savedDuringLookupRef`, mic permission flow).
- `PatternRuleEditor` modal internals, save/error/dirty logic, shared-rule
  caption behavior.
- `KeywordImagePicker` and `SentencePicker` popover/dialog internals.
- Present and Sort read paths (frequency power bars, keyword images, rules,
  lock filtering).
- `ListEditorPage.tsx` layout, the add-pattern flow, save/unsaved plumbing.
- Design tokens (`bg-card`, `border-line`, `text-ink`, `text-muted-foreground`,
  accent classes), the shadcn `Input`/`Button`/`Label` components themselves.

---

## 10. Implementation guidance (one focused PR)

- **Files:** primarily `src/components/PatternEditor.tsx`; trigger-only
  restyles in `src/components/PatternRuleEditor.tsx` and
  `src/components/KeywordImagePicker.tsx` (trigger classes only, no logic).
  Update `src/components/__tests__/PatternEditor.test.tsx` (and picker/rule
  tests if they assert trigger classes).
- **Tokens/components:** Tailwind v4; use `bg-card`, `border-line`,
  `text-ink`, `text-muted-foreground`, `bg-muted/40`, accent classes from
  `LIST_ACCENT_CLASSES`; shadcn `Input`, `Button`, `Label`; lucide icons;
  existing `PowerBar`. No new dependencies, no new tokens.
- **Copy (no em dashes):** "Spelling pattern", "Sound", "Words (n)", "Try:",
  "Add a word", "Add", "Details", "Frequency", "Common", "Less common",
  "Rare", "Spelling rule", "Add a rule", "Keyword image", "Not set",
  "Delete pattern", "Lock pattern", "Locked". Tooltip: "Locked patterns are
  hidden in present mode until you unlock them." (kept).
- **Order of work:** 1) section skeleton + spacing + headings; 2) identity
  block; 3) words section restyle; 4) details well (frequency segmented
  control, rule row, keyword row); 5) footer; 6) tests; 7) local Playwright
  screenshots at 390px and 1280px for Donray's visual approval (screenshots
  are never committed, per repo rules).
- **Verification:** `npm run format`, unit tests, and the axe-core a11y spec
  must be green before merge. Compare the new card against production
  side by side before showing Donray.
