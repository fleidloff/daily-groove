---
name: create-feature-for-persona
description: Review the live app in character as the persona in `docs/persona.md` — what works, what is unclear, what is missing — then turn the single strongest finding into either a quick ticket via `/create-quick-feature` or a feature briefing via `/create-feature`, deciding by the size test. Stops at the ticket or the briefing; runs no roadmap, no PRDs, no code. Use whenever the user runs `/create-feature-for-persona`, or asks for a feature idea from the persona's point of view, a persona walkthrough, or a UX review of the deployed app that ends in a ticket or a briefing.
argument-hint: [url | local] — defaults to the deployed app
---

# Create feature for persona

The feature list is written by the person building the app, who knows where
every button is and what every word means. This skill borrows a different pair
of ears: it walks the live app as the persona in `docs/persona.md`, notices what
that person would notice, and records the single best finding through whichever
of the repo's two doors fits it — a quick ticket in `specs/quick/` or a feature
briefing in `specs/features/`.

It ends at the ticket or at `briefing.md`. `/quick-feature`, `/roadmap`,
`/brainstorm`, `/writespec` and `/implement-feature` are the user's to run — do
not run them, and do not offer to.

## 1. Load the persona

Read `docs/persona.md` in full. It is the whole basis for the review; without it
this skill is just another opinion.

If it doesn't exist, stop and say so. Don't invent a persona — one you made up
would agree with you about everything.

Take three things from it and keep them in front of you: what the persona wants,
what loses them, and who they are explicitly **not**. The last one does most of
the work: it is what stops the review turning into a wishlist for a musician
this app isn't for.

## 2. Look at the app

Default target: `https://daily-groove-phi.vercel.app/`. An argument overrides it
— a URL, or `local` to run the app from this checkout (use the `run` skill).

**Use a real browser if this session has one** — a browser MCP such as
chrome-devtools or playwright. That is the only way to see the app the persona
sees: click play, hear nothing (you can't), guess wrong, guess wrong again, take
the nudge, give up, reveal. Walk the whole cycle.

Two states matter, and the first matters more:

- **First run** — empty `localStorage`, which is the persona's actual first
  contact. Use a fresh profile or clear site data. Feature 8 exists entirely to
  serve this moment; check whether it does.
- **Returning** — after a solve, and after a wrong guess or two, where the
  explanation box is gone and the streak means something.

**If no browser is available**, say so plainly in the report and fall back:
fetch the deployed page and read the rendered text, then read the feature slice
under `src/features/` to reconstruct what the interactions do. This gives you
copy, labels, ordering and flow — enough for a real finding — and gives you
nothing about sound, motion, timing or visual weight. Do not write about those
as though you saw them.

**Never describe something you did not observe.** A fabricated observation
becomes a briefing bullet, then an epic, then code. Where you are inferring from
source rather than from the running app, mark it as such.

## 3. Review in character

Write the review as the persona, in their voice, first person. Three headings,
and keep each to a handful of lines:

- **What I like** — name what actually works. This is not politeness: a review
  that only complains gives the user no idea what is safe to change.
- **What is unclear** — where the persona hesitates, guesses, or reads a word
  they don't know. Quote the exact copy or control.
- **What is missing** — what they wanted next and could not find.

Two rules of judgement:

- **Confusion the persona would have, not confusion you would have.** They play
  an instrument by feel and don't know the theory vocabulary. "Dorian" is not
  self-evident to them; a chord chip with no audible reference is.
- **Missing ≠ absent.** Much of what the app doesn't do, it deliberately doesn't
  do — one puzzle a day, no account, the page ends at the puzzle. Read the
  *Not the persona* and *What this implies* sections of `docs/persona.md` before
  calling something a gap. A "gap" that is a stated non-goal is a
  misunderstanding, not a finding.

## 4. Pick exactly one feature

One. The value of this skill is the choice, not the list — a feature per finding
is the same wishlist the persona review was supposed to replace.

Choose the finding that would change the persona's next session most, and
prefer:

- **their own words over your taxonomy** — a fix to the moment they hesitated,
  not a category of improvement;
- **the first two minutes over the tenth day** — this persona is lost or kept
  before they ever build a streak;
- **one coherent shippable thing** over a theme that would need three epics to
  mean anything.

**Then check it isn't already on the plan.** Read `specs/features.md`, all
three tables:

- It duplicates a shipped or planned feature (numbered, or a lettered
  candidate) or a quick change → pick your next-best finding instead, and say in
  the report which feature or ticket already covers the first one.
- It matches one of the auto-generated candidate ideas at the bottom → that is
  fine, and is exactly the promotion those rows exist for. `/create-feature`
  retires the row; note it.

State the choice in one sentence before writing anything, along with the finding
it comes from and what you passed over.

## 5. Pick the door

The repo has two ways to record a change, and the finding decides which one —
not its importance to the persona, which is already settled, but its size.
Run the four questions from `/quick-feature` §2 against the finding as you
understand it from the app and `docs/architecture.md`:

1. Can you say what changes and what done means in five bullets or fewer?
2. Does it touch at most **two** of the six modules — catalogue, theory, audio,
   puzzle, coaching, shell? A copy change, a reordering, one new line in a
   panel is one module; anything that needs new audio *and* a new control is
   two or more.
3. Does it leave the four frozen things in `docs/music.md` alone? Anything that
   re-renders the catalogue or reassigns past puzzles is never quick.
4. Is one `git revert` the whole rollback?

**All four yes → a quick ticket (§5a). Any no, or any you cannot answer from
here → a feature briefing (§5b).** The expensive door is the safe default: a
briefing that turns out to be one epic gets offered the quick path by
`/roadmap`, and a ticket that turns out to be a feature is escalated by
`/quick-feature`, so a wrong guess costs one hand-off either way. But the two
mistakes are not symmetric — a feature smuggled through the cheap door skips
the requirements nobody wrote down, so when in doubt, brief it.

State the verdict in one line, question by question, before writing anything.

### 5a. Hand it to `/create-quick-feature`

Invoke the `create-quick-feature` skill and let it do the mechanical work — the
next free number, the two sections, the confirmation, the row in the Quick
changes table, the report.

**The content comes from you, not from an interview.** Hand over both halves as
the seed so the skill skips its own question:

- `## What` — the change in the persona's terms, `*` bullets, one idea each,
  including one bullet naming the moment in the app that prompted it.
- `## Done when` — bullets a test or a look at the page can settle: what the
  persona sees afterwards that they did not before.

Do not write `## Notes` or `## Open questions`; those are `/quick-feature`'s,
on its analyze run. Do not name files or modules — you checked them for the size
test, but the ticket records intent, and the analyze run names files with the
tree open.

### 5b. Hand it to `/create-feature`

Invoke the `create-feature` skill and let it do the mechanical work — the label,
the bullet house style, the confirmation, the row in `specs/features.md`, the
report.

Two things are different from a normal run, and you supply both:

- **The briefing content comes from you, not from an interview.** You already
  have it; there is nothing to ask the user. Hand over the bullets as the seed
  so `/create-feature` skips its own question.
- **A letter, not a number.** A persona finding is an idea worth keeping, not a
  commitment to build — which features get numbers, and in what order, is the
  user's scheduling decision. Propose the next free letter at the confirmation
  gate and allocate a number only if the user asks for one.

Write the bullets in the persona's terms, in the repo's briefing style: `*`
bullets, short imperative fragments, one idea per bullet, no headings, no prose.
Aim for four to eight. Include:

- what the feature does, as separate bullets for separately decidable pieces;
- one bullet naming the persona problem it solves — the intent, in their words,
  is the most useful line in the file;
- any non-goal you are deliberately setting, especially one that keeps the
  feature from colliding with a stated non-goal of the app.

Do not specify. No components, no state shape, no file paths, no acceptance
criteria — `/roadmap` and `/brainstorm` are the cycles that ask about those, and
a bullet that answers early arrives looking like a decision the user made.

Either skill shows what it is about to write and waits for confirmation. Let it.
Adjust and re-confirm rather than arguing for your idea — the user knows the
plan better than the persona does.

## 6. Report back

- **How you looked** — browser or fallback, which states you reached, and what
  you could not observe.
- **The review** — the three headings from §3, in the persona's voice, tight.
- **The choice** — the one finding, what you passed over and why, and the
  door: the four size-test answers in one line each.
- Whatever the skill you handed to reports: the ticket or folder, the bullets,
  the row.

Then stop. The next step differs by door, and you point at it without running
it:

- **Quick ticket** → `/quick-feature N`, which analyzes the ticket and asks
  anything blocking inside it.
- **Lettered candidate** → nothing. It is parked until the user promotes it to a
  number; suggesting `/roadmap feature-X` would plan work nobody has committed
  to.
- **Numbered feature**, if the user asked for one → `/roadmap feature-N`.
