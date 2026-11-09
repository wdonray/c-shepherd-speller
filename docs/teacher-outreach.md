# Getting real teachers testing PatternSpell

Goal: real elementary teachers using PatternSpell for a real week of spelling, and telling us what breaks, confuses, or is missing, through the feedback form in the app.

## Where we are (Nov 9, 2026)

- The feedback loop works. The app has a full-page "Give feedback" form in the menu (Menu → Give feedback). It emails Donray directly with the teacher's message, their info, and the app version, and it accepts a screenshot. Chaley tested it Oct 10, 2026 and the mail landed.
- The front door works. patternspell.org is a public landing page: what the tool is, who it is for, three steps, "Get started free". Free for teachers 18 and older, sign in with Google or email.
- Real users are close to zero. Four signups on record as of Oct 25, 2026, three of them test accounts. The signup notification email (shipped Oct 20, PR #500) is live, and no signup notification has landed in Gmail since, so either no one new has signed up or something upstream is not firing. Phase 0 settles which.
- The app is ready to be judged. Pattern chart display, present mode, practice, seven printable worksheet types with answer keys, example sentences, song videos per pattern, and a ready-made library (162 weeks in the standard sequence, 90 weeks in the UFLI sequence) teachers can copy and customize.

## Phase 0: pre-flight (before anyone is invited)

1. Test signup: create a test account and confirm the signup notification email lands in Donray's inbox. If it does not, fix that first. New signups must not go unnoticed.
2. Test feedback: submit the feedback form as a teacher would and confirm the mail lands with the right details.
3. Confirm the landing page call to action works end to end: patternspell.org → Get started free → account created.

## Phase 1: Chaley's network (warmest, free, first)

Chaley teaches, and her teacher network already shaped this app: the pattern chart itself came from teachers telling us the spelling tree was confusing and messy. Ask Chaley for 5 to 10 elementary teachers who teach spelling by pattern.

- Donray emails each one personally from his own Gmail. No blast, no campaign tool. A few personal emails beat a campaign for a group this small.
- The ask: use PatternSpell for one real week of spelling, then tell us what happened through Menu → Give feedback in the app.
- The promise: Donray reads every note personally and fixes what they hit, then replies to say what changed.
- Only email teachers Chaley knows or who have asked to hear about it. No cold bulk mail, no purchased lists.

## Phase 2: the signups we already have

Email every real signup (not test accounts) with the same ask: one real week, feedback through the form. These teachers already showed intent by creating an account. One personal email each.

## Phase 3: teacher communities (free, careful)

Only after Phase 1 is running. Facebook teacher groups, r/teachers and grade-level subreddits, TPT forums.

- Only post where sharing a free teacher resource is welcome. Ask the mods first where that is the rule.
- One post, in Donray's own words, linking patternspell.org. No repeat posts, no cross-post spam.
- This is a later step, not the first one. Warm testers first, cold audience second.

## The loop (this is the whole point)

1. A teacher submits feedback through the form. It lands in Donray's inbox.
2. Log it in `docs/teacher-feedback-log.md`: date, teacher (first name and grade only, no email), what they said in their own words, theme, and what we did about it.
3. Triage it into the normal queue: a bug report goes in as a `bug` issue, a missing piece as an `idea` issue. The workers pick them up like any other issue.
4. Donray replies to the teacher personally and says what changed (or what will not change, and why). Teachers who see their feedback land come back, and they tell other teachers.

## What good looks like

- 5 to 10 testers, each using it for one real week of spelling.
- Feedback that is specific and usable: what confused them, what took too long, what was missing, what their students did with it.
- Signups alone do not count. A tester who signs up and never uses it teaches us nothing.

## What not to do

- No paid ads and no purchased email lists. No consent, no list.
- No cold bulk email. Personal email to people we know, or a public post in a community that welcomes it.
- No teacher names or email addresses in this repository. It is public. The contact list lives privately at `~/workspace/patternspell-teacher-outreach/contacts.md`. What lives here is the plan, the email, and anonymized feedback themes.

## Outreach email

Send from Donray's Gmail, one teacher at a time, personalizing the first line with how you know them and what they teach. Subject options:

1. Will you test a free spelling tool for one week?
2. A spelling chart tool built for my wife's classroom
3. Free spelling lists by pattern, want to try it?

Body:

> Hi [First name],
>
> I'm Donray. My wife Chaley teaches elementary school, and I built her a tool for spelling. I'm looking for a few real teachers to try it for one week and tell me what breaks.
>
> PatternSpell is for teachers who teach spelling by pattern. You pick the week's patterns, add your words, and it shows them as one clear chart on your projector or smartboard, one column per pattern, every word visible at once. It works with whatever program you already teach: CKLA, Fundations, UFLI, Words Their Way, or your own sequence.
>
> It is free for teachers. There is also a ready-made library you can copy and make your own: 162 weeks in the standard sequence and 90 weeks following UFLI's sequence. And printable worksheets with answer keys, example sentences for words, and song videos for the patterns.
>
> What I'm asking: use it for one real week of spelling, then tell me what happened. In the app, go to Menu, then Give feedback, and say what confused you, what took too long, or what was missing. I read every note myself, and I fix what people hit.
>
> You can start here: https://patternspell.org
>
> Thank you for teaching, and for even considering it.
>
> Donray Williams
> patternspell.org

## Running this

- Owner: Donray (replies, invites). The workers file and fix what comes back.
- Review the log monthly: which themes keep coming up, what got fixed, who still waits for a reply.
- The contact list (who was invited, when, whether they replied) lives privately at `~/workspace/patternspell-teacher-outreach/contacts.md`, never in this repository.
