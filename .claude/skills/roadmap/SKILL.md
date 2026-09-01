---
name: roadmap
description: Turn a feature briefing into a phased, epic-based roadmap. Reads `specs/feature-X/briefing.md` and writes `specs/feature-X/roadmap.md`, split into epics that each ship visible progress, are independently buildable and validatable, and are ordered for maximum parallelism. Use this whenever the user runs `/roadmap`, mentions a feature-X folder or a briefing, or asks to plan, phase, break down, or sequence a feature into epics, milestones, or waves of work — even if they don't say the word "roadmap".
argument-hint: [feature-X]
---

# Roadmap

Turn a feature briefing into a roadmap of epics that can actually be executed:
each one visible, independently validatable, and scheduled to run in parallel
where the dependencies allow it.

## 1. Resolve the feature

The skill runs for exactly one feature.

- Invoked as `/roadmap feature-3` → the target is `specs/feature-3/`.
- Invoked bare (`/roadmap`) → list the folders under `specs/` and ask which one.
  Don't guess, even when only one exists — confirming costs one line and
  prevents writing a roadmap into the wrong folder.
- Accept loose input: `3`, `feature 3`, and `specs/feature-3` all mean
  `specs/feature-3`. If it doesn't resolve to a real folder, show what's
  available and ask.

## 2. Read the inputs

**`specs/<feature>/briefing.md` is required.** Stop and tell the user if it is
missing or empty — a roadmap invented without a briefing looks authoritative
and is worthless, which is worse than no roadmap. Ask them to fill it in.

**If `roadmap.md` already exists, do not overwrite it.** Read it instead:

- Its open questions have ticked answers → fold them into the roadmap, remove
  the answered questions, and note what changed.
- Nothing has been answered → say it already exists, summarize it, and ask
  whether to regenerate from scratch or refine it.

**Read `docs/persona.md`.** It names the one player the app is built for, and
at this stage it does more work than anywhere else in the chain: epic boundaries
and ordering are decisions about *what reaches the player first*, and that is a
question about them rather than about the code. An epic ordered by what is
easiest to build is a roadmap optimised for the person writing it.

Its **Not the persona** section is a scoping tool. An epic that only serves the
trained musician, the absolute beginner or the theory student is not
automatically wrong — but it is a different bet from the rest of the feature,
and saying so is what stops it drifting to the front of the plan unexamined.

**Read the project's conventions** if they exist — `AGENTS.md`, `CLAUDE.md`,
`docs/architecture.md`, `docs/testing.md`. Epics should land as the repo
expects them to (feature slices, colocated tests, whatever the project says),
so the roadmap doesn't quietly contradict the codebase's own rules.

## 3. Shape the epics

An epic is a slice of the feature that a team could pick up, finish, and prove
works — without the rest of the roadmap existing yet.

**Every epic ships something the persona can see.** This is the constraint that
matters most, and "the persona" is the sharp half of it: `docs/persona.md` names
who is looking. *Visible when done* written as "the settings are persisted" is
about the system; written as "Sam can flip to simple mode and it is still there
tomorrow" it is about the player, and only the second can be judged by anyone
but its author. "Set up the database", "build the API layer", "add auth
scaffolding" are not epics — they're tasks hiding inside one. Infrastructure
never gets its own epic; it rides along inside the first epic that needs it,
and that epic is still named and judged by what becomes visible.

The reason is practical: infrastructure-only phases produce weeks with nothing
to look at, no way to tell whether the work is on track, and no early signal
that the design is wrong. Vertical slices surface that on day three instead of
week six.

So make Epic 1 the thinnest end-to-end path that renders something real — a
walking skeleton. Then each later epic thickens it along one dimension.

**How many.** Whatever the briefing actually justifies. One epic is a fine
answer for a small feature. Typically 2–6. If you're past 7, you're probably
slicing tasks rather than epics — or the briefing describes several features
and you should say so.

**Dependencies.** For each epic, ask what it truly needs to *start* versus what
it needs to be *complete*. Most apparent dependencies are on an agreed contract
— a route, a type, a payload shape — not on finished code. Pin the contract in
the earlier epic and the later one can proceed in parallel against it. Real
dependencies stay; invented ones cost you parallelism.

When two epics both need the same groundwork, put it in whichever ships first
and let the other depend on it. Don't hoist it into a shared prerequisite epic
— that's the infrastructure-epic trap wearing a different hat.

**Then check your work.** Read back the epic list and test each one:

1. Can I describe what's visibly different when this is done, in a sentence
   about the persona rather than about the system? If the answer is about
   internals, restructure it — merge it into the epic that makes it visible, or
   turn it inside out so the user-facing part leads.
2. Could someone validate this without the later epics existing?
3. Is this blocked for a real reason, or just because I listed it second?
4. Would the persona notice the epics in this order? Ordering by what is
   cheapest to build is the default a roadmap exists to argue with — and where
   an epic genuinely serves someone `docs/persona.md` rules out, say so rather
   than letting it sit unlabelled among the others.

Restructuring at this point is normal, not a sign of a bad first pass.

## 4. Write the roadmap

Write to `specs/<feature>/roadmap.md` using this structure:

````markdown
# Roadmap — <Feature Name>

Source: [briefing.md](briefing.md)

## Overview

Two to four sentences: what gets built, and the order the value arrives in.

## Epics

### Epic 1 — <name describing the visible outcome>

**Visible when done:** what a person can see or do that they couldn't before.
**Depends on:** none
**Parallel with:** Epic 2

**Scope**
- ...

**Out of scope**
- what a reader would reasonably assume is here but isn't, and which epic has it

**Validation**
- the demo path: click here, see this
- the tests that prove it, per the project's testing rules

### Epic 2 — ...

## Dependency map

```mermaid
graph LR
  E1[Epic 1 — name] --> E3[Epic 3 — name]
  E2[Epic 2 — name] --> E3
```

## Execution waves

- **Wave 1 (parallel):** Epic 1, Epic 2
- **Wave 2:** Epic 3 — needs the contract from Epic 1

## Assumptions

Anything you decided that the briefing didn't settle. Keep these honest — they
are the roadmap's load-bearing guesses.

## Open questions
````

Omit `Assumptions` or `Open questions` if genuinely empty. Keep the prose
tight; this is a document someone will act on, not a proposal to sell.

## 5. Update the feature index

`specs/features.md` is the one-page index of every feature — one table row each,
a single sentence of summary. Keep it in step with the roadmap you just wrote.

- **No row for this feature yet** → add one, in feature-number order:
  `| [N](feature-N/) | <short name> | <one-sentence summary> |`
- **Row exists** → rewrite the summary if the roadmap sharpened, widened, or
  narrowed what the feature actually is. If it still reads true, leave it alone.
- **No `specs/features.md` at all** → create it with the same table shape.

The summary describes the feature's outcome in one sentence — what a person can
do afterwards that they couldn't before. Not the epic list, not the phasing;
that's what the roadmap is for. Keep it to a line so the index stays scannable.

## 6. Ask what you don't know

Write down every question where you are less than ~90% confident and where the
answer would change the roadmap's shape — epic boundaries, ordering, scope,
what "done" means. Skip trivia and anything you can decide sensibly yourself;
those become `Assumptions` instead. A roadmap with fifteen questions is
abdicating, one that quietly guesses on the big fork is worse.

Ask them in the document, at the end, as tickable options:

```markdown
## Open questions

Tick one option per question (`- [x]`), then tell me — I'll fold the answers in
and update the roadmap.

### Q1. Can an entry be edited after the day it belongs to has ended?

- [ ] A) Editable forever *(recommended — no lockout logic, simplest to ship)*
- [ ] B) Editable for 24 hours, then locked
- [ ] C) Never editable once saved
- [ ] D) Editable, with a visible edit history
```

**Ground the recommendation, and name what in.** Work down this order and say
which rung you landed on, so the user can argue with the evidence rather than
with your taste:

1. **The briefing** — what the user actually asked for.
2. **`docs/persona.md`** — what serves the player. Quote the line you are
   leaning on ("one thing per day, not a curriculum", "being asked what they
   don't yet know") rather than gesturing at the persona in general.
3. **The engineering reason** — when both are genuinely silent. Say that they
   are; it is honest and still useful.

The example above lands on rung 3, and says so by giving a build reason and no
other. That is fine when it is true — and misleading when the persona had
something to say and you did not look.

**Shape the options around the persona, not only the recommendation.** A
roadmap's questions decide what the player meets first, so the option set is
where that gets framed. At least one option should follow from what the persona
wants; where the fork has one, at least one from what loses them.

> Wrong: A) build the generator first · B) build the UI first · C) both behind a
> flag · D) spike it
> Right: A) the groove plays on day one, guessing comes second *(recommended —
> "the groove plays first"; a page that cannot make a sound is not a thin slice
> of this app, it is a different app)* · B) the guessing flow first, against a
> placeholder tone · C) both, if the two can be validated apart

**Don't manufacture persona reasoning where there is none.** Plenty of roadmap
questions — a licence bar, a file format, which library supplies a sample — have
no bearing on the player at all, and dressing them in persona language teaches
the user to skim the part that matters. Say "no persona bearing; the reason is
engineering" and give it.

Up to four options, each a real and distinct choice — not three straw men
around the one you want. Mark your recommendation and say in one clause why.
When none of the four fits, the user will write their own; that's expected.

Write the roadmap even when questions remain. State the assumption you proceeded
under so the document stands on its own, and let the answers refine it.

## 7. Report back

Tell the user the path you wrote, the epic names in wave order, whether you
added or updated the `specs/features.md` row, and the count of open questions —
pointing them at the bottom of the file to answer.

**Then point at `/brainstorm <feature>` as the next step, and don't run it.**

Not `/writespec`. A roadmap names the epics and says what each makes visible; it
carries no requirements and no acceptance criteria, and `/writespec` reads
`prd/*.md` and nothing else. Skipping the PRD cycle means specifying against
requirements nobody wrote down. `docs/skills.md` has the full chain.

If questions are still open, say that answering them first is the cheaper order
— `/brainstorm` inherits the roadmap's shape, so a shape decided later is a
round of PRDs rewritten.
