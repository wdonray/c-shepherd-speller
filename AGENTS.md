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
- **Hold teacher-scoped content until the session resolves.** A client page
  that filters content by the signed-in teacher (e.g. hidden videos) must
  hold its content while next-auth `status === 'loading'`, not just until
  the teacher's list loads: on first paint the status is still loading, so
  the page flashes unfiltered content and churns when the session lands
  (found 2026-10-18: issue #439, the /videos grid).
- **A bare `grid` blows out past fixed widths.** An implicit `auto` grid
  column sizes to the largest min-content contribution, so any `nowrap`
  descendant (`truncate` titles, long URLs) forces a fixed-width grid
  container wider than its `max-w`. Constrain the column with
  `minmax(0, 1fr)` (as the shared DialogContent does) or put `min-w-0` on
  the grid items; `min-w-0` on a deeper flex child is not enough because
  the blowout is measured at the grid level (found 2026-10-18: issue #434,
  the song videos modal overflowed its dialog on mobile).
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
- **Print routes with an interactive first step keep their chrome on
  screen.** Stripping the site header/footer for a whole `/print` route
  also strips them from screen-only steps like the sentence gap flow, which
  then looks nothing like the page it came from. Keep the chrome on screen
  and hide it only in print CSS (`print:hidden` on the header slot and
  footer), so interactive steps match the rest of the app and the printed
  job stays clean (found 2026-10-18: issue #436, Sentences needed page had
  no header or back button).
- **Native checkboxes need theme-adaptive accent colors.** A fixed
  accent-color like `accent-black` renders as a washed-out gray in dark
  mode (Chromium brightens dark accent colors under `color-scheme: dark`).
  Use a token that adapts, e.g. `accent-ink`, which also matches the
  checked card's `border-ink` highlight (found 2026-10-18: issue #435,
  worksheet picker checkboxes).

## Reliability

- **A new third-party origin means a CSP update.** When a feature pulls
  images, embeds, or API calls from an origin the app has not used before,
  add that origin to the matching Content-Security-Policy directive in
  `next.config.ts` in the same change: `img-src` for images, `frame-src`
  for iframes, `connect-src` for fetches. The shipped CSP silently blocks
  anything not listed, and the failure mode is invisible (blank thumbnails,
  black embed boxes) with no error in the app (found 2026-10-18: issue
  #438, song-video thumbnails broke because `i.ytimg.com` was never added
  to `img-src`). When fixing a CSP gap, audit every directive the feature
  touches in the same change, not just the one in the report: the #438 fix
  added only `img-src`, so the song-video embeds stayed blocked until
  #440 added the missing `frame-src` (found 2026-10-18).

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
- **Assertions on async-driven button states must wait, not assert bare.**
  The FakeAudio stub reports duration from a `setTimeout(0)` (a macrotask),
  while the wall-clock time between fake Record and Stop clicks is a
  fraction of a second, under the 1s save minimum. A bare
  `toBeEnabled()/toBeDisabled()` on the Save button races that timer and
  flakes in CI; use `await waitFor(() => ...)` so the test settles after the
  metadata lands (found 2026-10-18: issue #435, VoiceRecorderModal flake).
