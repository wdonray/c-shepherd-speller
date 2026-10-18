# AGENTS.md

Operating notes for AI agents working in this repo. Donray is the owner;
he decides, you execute. He verifies your work as a habit, be precise.

## Product positioning

**Source of truth:** `docs/why-patternspell.md` explains why PatternSpell exists, who it's for, and what problem it solves. Read it before writing any user-facing copy, landing page content, or user guides. The key points:

- For elementary teachers who teach spelling through phonics patterns (any curriculum).
- Solves slow list-building and hard classroom display.
- Pattern chart display is the teacher-preferred format (not a tree).
- Not a game site, not a curriculum replacement, not student-facing.

## Workflow

- **One PR per task.** Small, focused PRs. Merge as soon as all required CI
  checks are green; do not wait for human review and do not let green PRs sit.
- **If CI doesn't start on a PR:** newly added workflows sometimes miss the
  `opened` event; push an empty commit to trigger `synchronize` and start them.
- **Run formatting before the first push:** `npm run format` (prettier).
- **PR titles follow conventional commits.** PR bodies use
  `## What` / `## Why` / `## How` sections.
- **Screenshots gate UI changes but are never committed.** Take local
  Playwright screenshots to review UI changes, show them in chat, keep them
  out of the repo.
- **No em dashes in user-facing copy.** Use commas, colons, or split the
  sentence instead.
- **Keep the public surface truthful.** If a feature does not exist, do not
  document it as if it does.
- **Removing a zod schema field needs no data migration.** Zod strips
  unknown keys by default, so stored DynamoDB items that still carry the
  removed field keep parsing fine. Add a test asserting the legacy field is
  stripped rather than building a migration (found 2026-10-18: issue #381
  odd-ducks removal).

## Local development loop (DynamoDB Local, no AWS account)

1. `cp .env.example .env.local`
2. `docker run -p 8000:8000 amazon/dynamodb-local`
3. `npm run create-tables` (idempotent; creates `c-shepherd-users` and
   `next-auth`, honoring `DYNAMODB_ENDPOINT`, `USER_TABLE_NAME`,
   `AUTH_TABLE_NAME`)
4. `npm run test-db` to verify the connection and table presence
5. `npm run dev`

`DYNAMODB_ENDPOINT` set routes DynamoDB traffic to the local instance;
unset it and set `AUTH_DYNAMODB_REGION`/`AUTH_DYNAMODB_ID`/
`AUTH_DYNAMODB_SECRET` to use real AWS. Local DynamoDB accepts any
credentials.

## Stack

- Next.js 15 (App Router), React 19, TypeScript
- Tailwind CSS v4, Radix/shadcn UI, next-themes, zod
- next-auth v4 + DynamoDB adapter, Google OAuth, DynamoDB via AWS SDK v3
- oxlint for linting, prettier for formatting, husky + lint-staged hooks

## Auto-merge convention

- This repo has GitHub "Allow auto-merge" and "Automatically delete head branches" turned on. Auto-merge only fires when the `main` ruleset's required checks are green (Build, Lint, Unit tests, E2E tests).
- The `.github/workflows/auto-merge.yml` workflow enables auto-merge on every PR automatically (merge method `--squash`). Agents no longer need to add the `auto-merge` label or run `gh pr merge --auto` themselves.
- Never disable auto-merge on someone else's PR.

## UI conventions

- **Skeleton loaders only when the layout is known.** A skeleton is a
  promise about geometry: use one only when the loading page's layout is
  knowable up front. When too much is unknown (item counts, text lengths,
  conditional sections), use a centered spinner instead. A skeleton that
  guesses the geometry shifts the page when the real content arrives, which
  is worse than a spinner (found 2026-10-17: issue #366, the present-page
  skeletons could never match pattern counts, word counts, rule text, or
  the odd-ducks section).
- **A second fetch after first paint is layout shift too.** Data that
  arrives in a follow-up request and changes visible geometry (a header
  pill, rule text) shifts the loaded page just like a bad skeleton, and no
  loading-state choice can fix it. Join that data server-side into the
  initial payload so the single loading state covers it; degrade to the
  no-data rendering when the join fails rather than failing the whole load
  (found 2026-10-17: issue #388, the present page's classroom pill and
  class rules arrived after the chart rendered).
- **Status indicators must never shift layout.** Things like save/unsaved
  indicators reserve their space or overlay; they never push content around
  when they appear, change, or disappear.
- **Full screen must own its exit path.** When full screen hides the only
  visible exit control, register an explicit Escape handler that calls
  `document.exitFullscreen()`; native Esc-to-exit varies across classroom
  browsers and automation, so the app cannot rely on it. The handler must
  not prevent default or stop propagation, so dialogs and popovers keep
  their own Escape behavior (found 2026-10-17: issue #380, present-mode
  full screen hid the chart header with the exit button in it).
- **Prefer CSS transitions over JS animation for show/hide.**
  motion/AnimatePresence exit animations never complete in this repo's
  jsdom setup (rAF does not tick), so the exiting node stays mounted
  forever in tests. A CSS grid-rows/opacity transition with a timed
  unmount is deterministic under real timers (found 2026-10-17: issue
  #374, rule slot animation).
- **Autosave modals must not swallow a close while a save is in flight.**
  When the draft is clean (e.g. Clear-then-Done), queue the close and honor
  it when the save settles. If the save fails, discard the queued close and
  keep the modal open with the error and the draft intact (found 2026-10-17:
  issue #363, rules could not be cleared).
- **Testing Library does not normalize query strings.** getByText and
  getByTitle collapse whitespace in the DOM text but match the query
  string literally, so a double space in verbatim bank data (video titles,
  sentences) needs a single-space or regex query to match. Keep the data
  verbatim; write the query to match (found 2026-10-18: issue #401 video
  bank titles).
- **Modal save failures must surface inside the modal.** A modal that
  applies edits immediately has no draft to keep, so a rejected save
  reverts the list behind it. Radix marks background content aria-hidden
  while a dialog is open, so a page-level error alert behind the modal is
  invisible to the teacher (and unfindable by role in tests). Pass the
  failure into the modal as a saveError prop and render it there; clear it
  on the next save attempt and when the modal opens (found 2026-10-18:
  issue #401, song-video saves from the present chart).
- **Blocked keystrokes need a visible reason.** When a controlled input
  rejects an update (validation block), the input silently reverts to its
  previous value, which reads as a swallowed keystroke. Always show a
  notice explaining why the change was not applied, and clear it on the
  next accepted edit (found 2026-10-18: issue #414, duplicate pattern
  pairs blocked at the identity inputs).
- **Conditional elements above aligned content need reserved slots.**
  When a conditional element (keyword image/emoji) sits above content that
  must share a top edge across grid columns (the rule callouts), columns
  with the element sit lower than columns without it. When any column
  renders the element, every column reserves the same fixed-height slot;
  when none do, render nothing so no dead space appears (found
  2026-10-18: issue #420, present-chart rule boxes misaligned by 56px).
- **Sticky chrome must outrank card content, not tie it.** Equal z-index
  ties break by DOM order, so a sticky bar at z-10 loses to card action
  rows at z-10 that come later in the DOM: scrolling card buttons paint on
  top of the stuck bar. Give sticky chrome a strictly higher z-index than
  anything that scrolls beneath it (found 2026-10-18: issue #421, list
  card Edit/Present/Delete buttons covered the stuck filter bar).

## Reliability

- **Prefer our own data over the network, and cap third-party timeouts.**
  Local-first lookups answer instantly; a flaky external API must never hold
  UI open. Browser-side calls to third-party services get a short timeout
  (a few seconds) and no retries (found 2026-10-17: dictionaryapi.dev
  flaked, and the sentences dialog sat on a spinner for ~21s before falling
  back to the local bank).

## Testing

- **In Playwright, `page.request` shares the browser context's cookies; the
  bare `request` fixture does not.** Authenticated API calls in e2e specs
  must go through `page.request`, or they arrive without the minted session
  cookie and 401 (found 2026-10-18: issue #402, the worksheets e2e seeded
  lists through the wrong fixture).
- **Never key a fetch effect on a derived array.** The fresh array identity
  re-runs the effect on every render, and the previous run's cleanup cancels
  the in-flight request, so the data never lands. Fetch per row on mount, or
  key the effect on a stable scalar (found 2026-10-18: issue #402, the
  sentence-suggestion fetch).
