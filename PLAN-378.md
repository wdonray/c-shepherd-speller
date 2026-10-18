# PLAN-378.md: Rethink back buttons and breadcrumbs (issue #378)

## Step A: Research

### Current-state audit (proves the "not consistent" claim)

Every page-top back affordance today, and where it actually goes:

| Page                      | Current label                        | Destination          | Problem                                                        |
| ------------------------- | ------------------------------------ | -------------------- | -------------------------------------------------------------- |
| `/feedback`               | "Back to home"                       | `/home`              | 3 different labels for the same destination                    |
| `/lists`                  | "Home"                               | `/home`              | same destination, different label                              |
| `/practice` (picker)      | "Back"                               | `/home`              | says "Back" (implies history), always goes Home                |
| `/profile`                | "Back to home"                       | `/home`              | same destination, different label                              |
| `/display` (picker)       | "Back" (ghost button, `router.push`) | `/home`              | says "Back", goes Home                                         |
| `/lists/new`              | "My spelling lists"                  | `/lists`             | same destination, 2 labels                                     |
| `/lists/[id]` (editor)    | "My lists"                           | `/lists`             | same destination, 2 labels                                     |
| `/display?list=X` (chart) | "Lists"                              | `/display`           | label does not match destination page title ("Present a list") |
| `/practice?list=X`        | "Exit practice"                      | `/practice`          | exits to another screen also titled "practice"                 |
| sort mode (in chart)      | "Exit sort" (X)                      | `setSortMode(false)` | truthful modal exit; keep as-is                                |

The core lie: labels say "Back" (which promises "the page you came from",
like a browser back button) but every one is a fixed-destination link. A
teacher who arrived from `/lists` and clicks "Back" lands on Home, not My
spelling lists. Labels are also inconsistent across pages for identical
destinations ("Back to home" / "Home" / "Back"; "My lists" / "My spelling
lists").

History-based nav found elsewhere is unrelated page-top chrome and stays:
`auth/signout` uses `router.back()`, and the unsaved-changes guard
(`use-unsaved-changes-guard.ts`, `ListEditorPage` `history.go(-2)`) intercepts
the _browser_ back button. Both out of scope.

### Industry research (prior art)

- **Nielsen Norman Group, "Breadcrumbs: 11 Design Guidelines"**: "Breadcrumbs
  should display the current location in the site's hierarchical structure,
  not the session history." Path-based trails "become long and confusing".
  Include the current page as the last (unlinked) item, start with Home, and
  on mobile show only the last level and never wrap.
- **GOV.UK Design System**: the Back link is only for multi-page
  _transactions_ and must take users "to the previous page they were on, in
  the state they last saw it". Never use it together with breadcrumbs. "For
  more complex user journeys, consider using different link text, like 'Go
  back to [page]' ... if you used 'Back', it might not be clear to users what
  they are going back to." GOV.UK breadcrumbs start with Home and end with
  the parent section; on mobile they collapse.
- **Intelligence Community Design System** (UK): "Use the 'back breadcrumb'
  for apps with simple structures that are only one or two levels deep. Show
  the current page's immediate parent in the back breadcrumb link."
  PatternSpell's hierarchy is exactly 1-2 levels deep
  (Home > My spelling lists > List), so this is the prescribed pattern.
- **NN/g usability heuristic (consistency) + GOV.UK**: link text must
  represent the title of the page it links to, so the destination is never
  a surprise.

Sources: nngroup.com/articles/breadcrumbs,
design-system.service.gov.uk/components/back-link and /breadcrumbs,
design.sis.gov.uk/components/breadcrumb.

## Step B: Design

Compared:

1. **Deterministic location breadcrumbs** (full trail: Home / My spelling
   lists / Long A). Pro: standard, orients deep-linked users. Con: noisy on
   PatternSpell's shallow hierarchy and on the projector-optimized chart
   header.
2. **True history-based Back** (`history.back()` labeled "Back"). Pro:
   label finally truthful. Con: landing spot varies by how the teacher
   arrived (bookmark, login redirect, external link); duplicates the browser
   back button, which NN/g advises against.
3. **"Back breadcrumb": single link to the immediate parent, labeled with
   the parent's page name** (the IC/GOV.UK pattern for 1-2 level apps).

**Chosen: option 3.** One-line reason: it is deterministic, so the same page
always names the same destination and a non-technical teacher can never be
surprised, and it is the research-recommended pattern for a hierarchy as
shallow as PatternSpell's.

Per-page parent labels (each matches the destination's page title or the
name the app already uses for that section):

| Page                      | New parent link                 |
| ------------------------- | ------------------------------- |
| `/feedback`               | "Home" -> `/home`               |
| `/lists`                  | "Home" -> `/home`               |
| `/lists/new`              | "My spelling lists" -> `/lists` |
| `/lists/[id]`             | "My spelling lists" -> `/lists` |
| `/practice` (picker)      | "Home" -> `/home`               |
| `/profile`                | "Home" -> `/home`               |
| `/display` (picker)       | "Home" -> `/home`               |
| `/display?list=X` (chart) | "Present a list" -> `/display`  |
| `/practice?list=X`        | "Practice" -> `/practice`       |

No "Back" text anywhere. Sort mode keeps its truthful "Exit sort".

## Step C: Implementation plan

Files:

- NEW `src/components/BackBreadcrumb.tsx`: single parent link ("< Parent"),
  same text-link visual language as the old BackLink (ArrowLeft icon, 14px
  semibold, muted-foreground). Props: `href`, `label`, optional `className`.
  Header comment cites the research and issue #378.
- DELETE `src/components/BackLink.tsx` + `src/components/BackLink.test.tsx`
  (replaced).
- NEW `src/components/BackBreadcrumb.test.tsx` (keeps 100% coverage).
- Edit usages:
  - `src/app/feedback/page.tsx`, `src/app/lists/page.tsx`,
    `src/app/profile/page.tsx`: BackLink -> BackBreadcrumb, label "Home".
  - `src/app/practice/page.tsx` picker: BackLink("Back") -> BackBreadcrumb
    "Home".
  - `src/components/NewListForm.tsx`: label stays "My spelling lists".
  - `src/components/ListEditorPage.tsx`: "My lists" -> "My spelling lists".
  - `src/components/DisplayMode.tsx`: picker header ghost "Back" button
    (and now-unused `backToApp` callback) -> BackBreadcrumb "Home";
    chart header "Lists" ghost link -> BackBreadcrumb "Present a list".
  - `src/components/PracticeMode.tsx`: header "Exit practice" button ->
    BackBreadcrumb href="/practice" label="Practice". `onExit` prop stays
    (still used by the two completion-screen buttons, same destination).
- `e2e/authenticated.spec.ts`: update `'My lists'` -> `'My spelling lists'`.
- Update any unit tests asserting old labels (practice page "Back",
  DisplayMode "Back"/"Lists", PracticeMode "Exit practice").

Test plan:

- Unit: new component tests; updated page/component tests; full suite with
  the 100% coverage thresholds.
- `npm run format` first, then lint, typecheck, unit suite.
- E2E: run the specs touching these pages locally as regression; Playwright
  screenshots of a couple of changed headers for the visual check (not
  committed).

Guardrails: no em dashes in copy; adult-educator positioning untouched;
no behavior changes beyond the nav chrome; do not touch PR #88.
