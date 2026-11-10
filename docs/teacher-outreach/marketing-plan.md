# PatternSpell marketing plan (free only)

Goal: the first 10 elementary teachers using PatternSpell weekly and giving
feedback through the in-app form. Free marketing only. No warm teacher
network exists (the Chaley network in `docs/teacher-outreach.md` Phase 1 is
void), so growth comes from helpful answers in teacher communities, one
findable page per pattern and program week, and Pinterest.

Companion docs: `docs/teacher-outreach.md` (testing outreach),
`docs/teacher-feedback-log.md` (feedback). Full research behind this plan:
workspace research report, Nov 10, 2026
(`research_notes/patternspell-free-marketing-20261110-1155/report.md`).

## What counts as a user

A teacher who builds, projects, or prints a list in a real week of spelling.
Not a signup. Track signups, weekly-active teachers, and "would you share
this with your grade team?" separately.

## Where we are (verified Nov 10, 2026)

- Signups: 4 total, unchanged since Oct 16, 2026 (live check via the
  donray.dev `/api/ps-stats` endpoint, which reads the DynamoDB users table).
  Three are Donray and Chaley test accounts. The only real user is the
  Oct 12, 2026 signup.
- Landing-page traffic, all time: 793 page views, 56 unique visitors.
- No signup-notification email has landed in Gmail since the notification
  shipped Oct 20, 2026 (PR #500). That matches zero new signups, but the
  notification path itself is still untested. Phase 0 settles it.
- No feedback has arrived through the in-app form yet.

## Correction: the old Step 1 double-counted

An early draft of this plan said "email the 4 signups plus the 1 real user",
as if those were 5 people. They are not. There are 4 signups total and 1 of
them is real. Step 1 is: email the 1 real signup personally. The 3 test
accounts need no email.

## Ranked channels

1. **Helpful answers in Facebook teacher groups** (UFLI Foundations
   Community, Science of Reading group). Teachers already ask "what
   list/words for UFLI lesson X?" there. Answer completely with no link and
   no product name; share a link only if someone asks where to get the
   list, with disclosure ("I built this free tool..."). Ask an admin before
   posting anything with a link. Never DM strangers to pitch.
2. **One findable page per pattern and program week on patternspell.org.**
   Teachers search by pattern and week ("UFLI lesson 84 word list", "ai ay
   spelling words"), not by app name. Each page shows the full word list
   grouped by pattern on the page (not behind sign-in), a screenshot of the
   projectable chart, a free printable worksheet with answer key (no email
   gate), and one link to build a list free in PatternSpell. This is the
   only channel that compounds while we sleep. Judge it after 4 to 12
   weeks, not after week 2.
3. **Pinterest.** One fresh pin per SEO page (2:3, keyword title and
   description, link to the page, not the homepage). Never duplicate-pin
   the same image and URL across boards; Pinterest flags that as spam.
4. **Reddit, answering only.** r/ELATeachers and r/education, link-free
   answers where a teacher asks for spelling-list help. Never post the
   product in r/teachers: self-promotion is banned there, including posts
   framed as "looking for feedback".
5. **Teacher blogs and micro-influencers.** Pitch 5 small literacy
   bloggers in week 2. Personal, under 150 words, reference a specific
   post of theirs, offer free access with no script and no obligation.
   Expect 0 to 1 replies; that is normal. Never pay, never ask for a
   positive review or a link.
6. **Teachers Pay Teachers (later phase, not week 1-2).** Donray has a
   TpT account (Nov 10, 2026). Publish one free resource built from the
   flagship page, e.g. a printable ai/ay word list or worksheet, priced
   Free, with a link back to patternspell.org. Verify seller access
   when the step comes up: if the account is not a seller account yet,
   Basic seller is a one-time $29, a deliberate decision, not a
   surprise. Do not build the listing until the first pattern pages are
   live and the Facebook and Pinterest work is running.
7. **Deferred:** Product Hunt (wrong audience, one shot, needs 20+ real
   users first), YouTube as a channel (support only: one 60 to 90 second
   screen demo embedded on the SEO pages).

## First 2 weeks

Assumes 3 to 4 hours a week. Items marked GATE need Donray's explicit
approval in chat first.

### Week 1: learn from the user we have, ship one findable page

| Day | Task                                                                                                                                                                                                                                                         | Done when...                                                                                      |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------- |
| 1   | Email the 1 real signup personally (GATE: send as Donray). Short, human: "You signed up for PatternSpell, what pattern/week are you teaching, and did the chart work on your projector? 15-min call or 3 replies?"                                           | 1 email sent; aim for a reply or a call booked.                                                   |
| 1   | Set up free measurement: Google Search Console and Google Analytics 4 (GATE: creating accounts). Note baseline signups and weekly actives.                                                                                                                   | Search terms visible before anything is published.                                                |
| 2   | Keyword check with free tools (Keyword Planner, Ubersuggest 3 free searches/day). Check the 5 seeds below and rank the target pages by real volume.                                                                                                          | Written ranked list of 5 target pages. Do not write a page nobody searches for.                   |
| 3-4 | Publish the flagship pattern page (see target list).                                                                                                                                                                                                         | One live page a teacher can use without signing up. Submit it in Search Console once that exists. |
| 5   | Pinterest setup (GATE: creating the account) and pins for the flagship page. Join the 2 Facebook groups (GATE: Donray joins from his own account), read the rules and pinned posts, note the 3 most-asked spelling-list questions. Do not post anything yet. | Pins live; group membership pending or approved; 3 real questions saved.                          |

### Week 2: publish more of what works, answer in public, ask for referrals

| Day | Task                                                                                                                                                                                                                                     | Done when...                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| 1-2 | Publish 2 more pattern pages from the ranked list, same format. Pin each once on Pinterest.                                                                                                                                              | 3 live pattern pages.                               |
| 3   | Answer 2 to 3 saved Facebook group questions helpfully, no link, no product name. Same on Reddit in 1 to 2 threads.                                                                                                                      | Answers posted; any replies noted.                  |
| 4   | Pitch 5 micro literacy bloggers (GATE: send as Donray).                                                                                                                                                                                  | 5 emails sent.                                      |
| 5   | Follow up with anyone who replied in week 1. Ask the most active users: "Who else on your grade team teaches this pattern? Would you forward them the chart?" Log the source of each signup (group answer, Pinterest, Google, referral). | Feedback log updated; at least 1 referral ask made. |

Good after 2 weeks: 2 to 5 real teacher conversations, 3 pattern pages live,
Pinterest running, membership plus helpful answers in both Facebook groups,
5 blogger pitches out, and a source log. Do not judge SEO or Pinterest yet.

## Ongoing cadence (after the 2-week starter)

Each weekly run does the next item in this order, as capacity allows:

1. Check state: live signup count, any new signup-notification emails, landing-page visits. Log the numbers.
2. Publish one new SEO pattern or program-week page.
3. Draft one Pinterest pin for that page (pinning itself needs the account, GATE).
4. Draft helpful answers for open teacher questions found that week (posting needs Donray, GATE).
5. Draft one blogger pitch when the pitch queue runs dry (sending needs Donray, GATE).
6. Later, once the first pattern pages are live: publish one free TpT
   resource from the flagship page (GATE: posting publicly; verify
   seller access first).

Self-heal: if a step fails, a page underperforms, or a community removes a
post, record the cause in the private marketing log and adjust the plan
(different channel, different wording, different pattern page) without
asking Donray. Only escalate when the fix needs a gated action or a product
judgment call.

## Target pages (ranked)

Lesson numbers verified against the app's own UFLI prebuilt lists
(`src/data/prebuilt-lists/ufli-grade-*.json`). Keyword volumes are still
unverified; run the Week 1 Day 2 check before building past the flagship.

1. **UFLI Lesson 84, ai/ay words (Grade 2, Week 7).** Flagship. Words in
   the app: ai: rain, train, wait, snail, paint, chain. ay: play, day,
   say, away, stay, tray.
2. **Silent e / VCe words (UFLI Grade 1, Lessons 54-59).** a_e, i_e, o_e,
   u_e, e_e across Weeks 13 to 17.
3. **R-controlled words (UFLI Grade 2, Lessons 77-83).** ar, or, ore, er,
   ir, ur across Weeks 1 to 3.
4. **CVC word families, Grade 1.** From the standard sequence; confirm
   the week mapping from the app library before writing.
5. **Fundations spelling list.** Only if a Fundations week mapping exists
   in the app; the app has no Fundations sequence today, so this page
   waits until one does. Do not invent a mapping.

## Hard gates (stop and report, never do without Donray's explicit approval)

- Spend any money.
- Create any account (Pinterest, Search Console, Product Hunt, or
  anything else). Donray already has a Teachers Pay Teachers account;
  only seller access is still to verify, when that step comes up.
- Post anything publicly (Facebook groups, Reddit, Teachers Pay Teachers,
  Product Hunt, blogs).
- Send any email as Donray.

Prepare drafts instead and put them in the weekly run report for approval.

## What not to do

- Never email-gate the free lists or worksheets on the SEO pages.
- Never use student data. Never buy lists or mass-DM teachers.
- Never post a promo link in r/teachers or in any Facebook group without
  reading its rules or asking an admin.
- Never pretend to be an unaffiliated teacher recommending the tool.
- Never launch on Product Hunt before 20+ real users exist.
- Never build a mobile app or new features before talking to users.
  Distribution is the bottleneck, not features.

## Running this

- Owner: Donray (replies, invites, approvals). The weekly loop runs on its
  own and reports to the PatternSpell side chat.
- Private working log (never in this repo):
  `~/workspace/goals/patternspell-first-teacher-users/hidden_files/marketing-log.md`.
  Teacher names and emails never go in this public repo; the contact list
  lives privately at `~/workspace/patternspell-teacher-outreach/contacts.md`.
- Stop condition: 10 teachers using PatternSpell weekly, or Donray says stop.
