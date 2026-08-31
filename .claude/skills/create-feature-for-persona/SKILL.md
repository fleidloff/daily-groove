---
name: create-feature-for-persona
description: Review the live app in character as the persona in `docs/persona.md` — what works, what is unclear, what is missing — then turn the single strongest finding into a new numbered feature via `/create-feature`. Stops at the briefing; runs no roadmap, no PRDs, no code. Use whenever the user runs `/create-feature-for-persona`, or asks for a feature idea from the persona's point of view, a persona walkthrough, or a UX review of the deployed app that ends in a briefing.
argument-hint: [url | local] — defaults to the deployed app
---

# Create feature for persona

The feature list is written by the person building the app, who knows where
every button is and what every word means. This skill borrows a different pair
of ears: it walks the live app as the persona in `docs/persona.md`, notices what
that person would notice, and commits the single best finding to the plan as a
briefing.

It ends at `briefing.md`. `/roadmap`, `/brainstorm`, `/writespec` and
`/implement-feature` are the user's to run — do not run them, and do not offer
to.

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

**Then check it isn't already on the plan.** Read `specs/features.md`:

- It duplicates a shipped or planned feature (numbered, or a lettered
  candidate) → pick your next-best finding instead, and say in the report which
  feature already covers the first one.
- It matches one of the auto-generated candidate ideas at the bottom → that is
  fine, and is exactly the promotion those rows exist for. `/create-feature`
  retires the row; note it.

State the choice in one sentence before writing anything, along with the finding
it comes from and what you passed over.

## 5. Hand it to `/create-feature`

Invoke the `create-feature` skill and let it do the mechanical work — allocating
the next free number, the bullet house style, the confirmation, the row in
`specs/features.md`, the report.

Two things are different from a normal run, and you supply both:

- **The briefing content comes from you, not from an interview.** You already
  have it; there is nothing to ask the user. Hand over the bullets as the seed
  so `/create-feature` skips its own question.
- **A number, not a letter.** The user asked for the next free number.

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

`/create-feature` shows the bullets and the folder name and waits for
confirmation. Let it. Adjust and re-confirm rather than arguing for your idea —
the user knows the plan better than the persona does.

## 6. Report back

- **How you looked** — browser or fallback, which states you reached, and what
  you could not observe.
- **The review** — the three headings from §3, in the persona's voice, tight.
- **The choice** — the one feature, the finding behind it, and what you passed
  over and why.
- Whatever `/create-feature` reports: the folder, the bullets, the row.

Then stop. Point at `/roadmap feature-N` as the next step and leave it to the
user — they said they would run it themselves.
