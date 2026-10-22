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
- **Base worktrees on origin/main, never the local main ref.** The main
  clone's local `main` goes stale because all work happens in worktrees
  (it was 10 releases behind origin when checked). Always
  `git fetch origin main` first and create the worktree from
  `origin/main`, or the feature's code may not exist in the branch you
  build on (found 2026-10-19: issue #459, /videos did not exist on the
  stale local main).
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
credentials, but access key IDs containing hyphens are rejected with
`UnrecognizedClientException` (found 2026-10-19: local e2e runs must use
hyphen-free dummy creds, e.g. `e2edummyid`).

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
- **Custom state CSS that must beat utilities belongs in `@layer utilities`.**
  Tailwind v4 resolves equal-specificity conflicts by layer order (utilities
  beats base), so a state rule in `@layer base` loses to a utility like
  `outline-none` on the same element even when specificities tie. Put the
  rule in `@layer utilities`, after the tailwind import, so it lands later
  in the winning layer (found 2026-10-21: issue #509, the unsaved-field ring
  never painted until it moved out of the base layer).
- **Hold teacher-scoped content until the session resolves.** A client page
  that filters content by the signed-in teacher (e.g. hidden videos) must
  hold its content while next-auth `status === 'loading'`, not just until
  the teacher's list loads: on first paint the status is still loading, so
  the page flashes unfiltered content and churns when the session lands
  (found 2026-10-18: issue #439, the /videos grid).
- **Do not wait for the client session before fetching data.** The proxy
  middleware (`src/proxy.ts`) is the real auth gate: it redirects signed-out
  page visits and 401s API calls server-side. `fetch` sends the session
  cookie, so data fetches can start on mount, in parallel with the
  client-side `useSession()` check. Gating a fetch on
  `status === 'authenticated'` adds a sequential round trip before first
  paint (found 2026-10-19: issue #480, the dashboard blocked on the session
  check and then on the user sync before fetching lists). Treat a 401 from
  the API as "signed out, not an error", never as an application failure.
  (This pairs with the hold-content rule above: fetch early, but keep the
  skeleton up until the session resolves so the page never flashes.)
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
- **Back controls are history-aware; the parent-named link is the fallback.**
  BackBreadcrumb is a client component: with an in-app referrer it names the
  previous page (from the sessionStorage navigation tracker mounted in the
  root layout) and performs a real history-back; on direct landing, and during
  SSR, it renders the parent-named link. Pages with dynamic titles must name
  themselves via reportPageName() (ListEditorPage) or the ReportPageName
  component (server pages), or the control falls back to the parent link
  (found 2026-10-20: issue #504).
- **Sticky is bounded by its containing block.** A `position: sticky`
  element can only travel within its parent's box, so wrapping the site
  header in a fixed-height slot (to stop layout shift when it pops in)
  silently un-sticks it: a 74px header inside a 74px slot has nowhere to
  travel and scrolls away with the page. Any sticky offset that assumed the
  header was stuck (the lists toolbar's `top-[72px]`) then floats over a
  gap. When reserving space for sticky chrome, re-derive dependent offsets
  from what actually sticks, per breakpoint (found 2026-10-19: issue #476,
  lists toolbar gap on mobile).
- **Measure stick behavior at every breakpoint, not just the reported one.**
  The #476 fix scoped the header-scrolls-away finding to mobile and kept
  `md:top-[72px]` on desktop, but SiteChrome's slot wrapper is not
  breakpoint-scoped, so the header's sticky is trapped at every breakpoint
  and the desktop toolbar floated over the same gap (found 2026-10-19:
  issue #485, desktop toolbar cut through the prebuilt week cards). When a
  stickiness assumption changes, scroll the page at each breakpoint in a
  real browser and re-derive every dependent offset from what actually
  sticks.
- **Print emphasis must use borders, not rings or box-shadows.** Tailwind
  `ring-*` paints via box-shadow, which printers skip when background
  graphics are off, so ring-based emphasis silently vanishes on paper.
  Real borders always print (found 2026-10-18: issue #455, word-search
  answer key circles).
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
- **Shrinkable grid tracks plus break-words wraps mid-word.** A grid whose
  tracks shrink below their max (3-up word chips inside pattern columns
  squeezed under their 420px cap at ~1200px viewports) gives
  `overflow-wrap: break-word` permission to break anywhere, so "train"
  renders as "trai"+"n" and rows go uneven. When a track can shrink under
  its content, keep words whole with `whitespace-nowrap` and pick the
  column count for the longest real content (2 roomy columns beat 3
  cramped ones); `min-w-0` on the items still guards against grid blowout
  (found 2026-10-21: issue #507, word chips wrapped mid-word).

- **Grow sub-24px touch targets with padding, canceled by negative margin.**
  Padding on the control grows the hit area while the visible text stays
  text-sized; an equal negative margin keeps the in-flow box (and any fixed
  header geometry) exactly unchanged. No background paints on these controls,
  so nothing shifts and nothing looks different (found 2026-10-22: issue
  #537, the present-chart back link measured 21px; `py-3 -my-3` took the hit
  area to 45px with the header pixel-identical before/after).

- **@media print rules never paint the on-screen print preview.** The
  preview route renders the same DOM the printer will see, but print-scoped
  rules do not apply until printing. An element that is invisible without
  its styling (an empty span, not visible text) needs its geometry rule
  outside `@media print`, or the preview shows nothing where the printed
  page has content (found 2026-10-22: issue #517, the uniform worksheet
  blanks lived in the print block and vanished from the preview once they
  stopped rendering underscore text).

## Reliability

- **List reads are cached; every write path must invalidate.** `getLists`,
  `getList`, and `getListWithClassroom` in `src/lib/lists-api.ts` and
  `getUserByEmail` in `src/lib/spelling-api.ts` cache reads in
  `src/lib/data-cache.ts` (5-minute TTL, in-flight dedup). Writes through
  the lists-api write functions invalidate automatically; any other write
  path to `/api/lists`, `/api/users`, or `/api/classes/:id/rules` must call
  the exported `invalidateListsCache`, `invalidateUserCache`, or
  `invalidateListClassroomCache`, or teachers will see stale data after
  saving (found 2026-10-19: issue #479).
- **Never trust the shape of a 200 response.** A success body with an
  unexpected shape (a test stub answering every fetch, a proxy, a future
  API change) must degrade to the empty value, never crash the page.
  Validate arrays with `Array.isArray` (or parse with zod) at the client
  boundary before handing data to components (found 2026-10-19: issue
  #458, the video-library client crashed the dashboard on a non-array
  body).
- **A named import from a component module drags its whole dependency graph
  into your route's shared chunk.** This package has no `sideEffects: false`,
  so `import { touchDragLiftModifier } from './SortActivity'` shipped
  motion, @dnd-kit and canvas-confetti (199 kB) inside /lists's initial
  bundle for one tiny function. Keep helpers shared across routes in a
  dependency-free lib module instead (found 2026-10-19: issue #482).
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
- **Condition read-modify-write updates on the value you read.** A read,
  in-memory append, and unconditional `SET` silently drops a concurrent
  writer: the second write overwrites the first and neither request fails.
  Put a ConditionExpression on the update (`attribute_not_exists(attr)` when
  the read found nothing, `attr = :expected` with the exact value read
  otherwise) and retry the read-write loop a bounded number of times on
  ConditionalCheckFailedException. De-dupe and cap logic re-runs on the
  fresh read inside the loop (found 2026-10-19: issue #473, concurrent video
  pastes dropped a video from the personal library).

- **Decouple the data fetch from the session, but clean up on session loss.**
  Fetching dashboard data in parallel with the client-side session check
  (no `status` dependency on the fetch effect) is faster, but a mounted
  component then keeps rendering private data after a cross-tab sign-out or
  session refresh. Add a separate `status === 'unauthenticated'` effect that
  clears the private state; keep the initial fetch parallel (found
  2026-10-19: issue #480, PR #491 review).
- **A background user-record create can lose the race with the first fetch.**
  If the sign-in sync POSTs the database user record while the page fetches
  its data in parallel, the fetch may land first and hit the 403 "no user
  record yet" path. After a successful create, dispatch
  `notifyListsChanged()` (it also drops the cached reads) so the fetch
  retries instead of parking on an error card (found 2026-10-19: issue #480,
  PR #491 review).

## Testing

- **YouTube embed-allow checks do not run on this VM.** oEmbed returns 200
  even for embedding-disabled videos, so the song-bank curation rule calls
  for a real embed load — but scripted Chromium cannot tunnel through the
  egress proxy (`ERR_TUNNEL_CONNECTION_FAILED`, even for example.com), and
  the managed browser loads a bare embed URL with no Referer, which YouTube
  rejects with Error 153 on every video including known-good bank entries.
  For video research here: verify existence plus verbatim title/channel via
  oEmbed, prefer established kids' phonics channels (embedding is their
  distribution model), and name the unchecked embed gate in the PR body
  (found 2026-10-20: issue #495).

- **One unit test needs DynamoDB Local.** `src/lib/auth.test.ts`'s
  sign-in round-trip test hits localhost:8000, so without docker (no
  DynamoDB Local) it fails with ECONNREFUSED. That is a pre-existing
  environmental failure, not a red change: verify by running that single
  file on clean main, where it fails identically (found 2026-10-19:
  issue #459).
- **No Docker? dynalite stands in for DynamoDB Local.** `npx dynalite
--port <free-port>` speaks enough of the DynamoDB API for
  `npm run create-tables` and the e2e suite; point DYNAMODB_ENDPOINT at
  it and use hyphen-free dummy creds. Note `src/lib/auth.test.ts`
  stubs DYNAMODB_ENDPOINT to `http://localhost:8000` itself, so that
  one file needs the mock on port 8000 exactly (found 2026-10-20:
  issue #488 e2e, no docker/java on the VM).

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
- **Local e2e: verify port 3000 serves YOUR build before trusting a run.**
  Playwright's `reuseExistingServer` attaches to whatever is already
  listening, and with multiple workers on this VM that can be another
  agent's server on a shared port. Seed failures against the wrong server
  look like app bugs. Start your own server on a free port and point a
  throwaway config at it instead (found 2026-10-18: the worksheets e2e
  seeded against another worker's :3000).
- **Assertions on async-driven button states must wait, not assert bare.**
  The FakeAudio stub reports duration from a `setTimeout(0)` (a macrotask),
  while the wall-clock time between fake Record and Stop clicks is a
  fraction of a second, under the 1s save minimum. A bare
  `toBeEnabled()/toBeDisabled()` on the Save button races that timer and
  flakes in CI; use `await waitFor(() => ...)` so the test settles after the
  metadata lands (found 2026-10-18: issue #435, VoiceRecorderModal flake).
- **Playwright's click scrolls the target into view before clicking.**
  When asserting that an action does NOT scroll the page (e.g. favoriting
  a list), a plain `click()` moves the page itself during actionability
  checks and the assertion measures the driver's scroll, not the app's.
  Use `dispatchEvent('click')` to fire the handler without the driver
  scrolling, so the scroll assertion isolates the app's behavior (found
  2026-10-19: issue #484, the no-scroll-on-favorite e2e).
