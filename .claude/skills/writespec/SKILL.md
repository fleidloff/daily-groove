---
name: WriteSpec
description: Turn each PRD in a feature into an epic technical specification with exact TDD implementation steps. Reads `specs/feature-X/prd/*.md` and writes one spec per PRD to `specs/feature-X/tech-spec/`, decomposed into parallel tracks behind frozen contracts, with every step written red-green-refactor. Major architectural decisions become tickable questions at the end, asked in cycles until all are settled. Use whenever the user runs `/writespec`, or asks for a technical spec, implementation plan, or engineering breakdown of a PRD or epic.
argument-hint: [feature-X] [epic-N]
---

# WriteSpec

Turn a PRD into a specification a developer can execute step by step, in TDD
order, with as much of the work running in parallel as the dependencies allow.

The PRD says what and why. This says how, in what order, and how you know each
step worked.

## 1. Resolve the target

- `/writespec feature-3` → every PRD in `specs/feature-3/prd/`.
- `/writespec feature-3 epic-2` → just that epic's PRD.
- Bare `/writespec` → list the folders under `specs/` and ask which one.

Accept loose input: `3`, `feature 3`, `specs/feature-3` all resolve to
`specs/feature-3`.

**One spec per PRD file**, same basename so they pair up:
`prd/epic-2-streaks.md` → `tech-spec/epic-2-streaks.md`.

## 2. Read the inputs

**The PRD is required.** No PRD, no spec — say so and point at
`/brainstorm <feature> <epic>`.

**A PRD with unanswered open questions is not ready.** Specifying against
unsettled requirements produces steps that get thrown away. Say which questions
are open and let the user decide whether to answer them first.

Read `roadmap.md` for the epic's dependencies and parallel-wave position, and
the project's conventions — `AGENTS.md`, `docs/architecture.md`,
`docs/testing.md`. Steps must place files where this repo expects them and test
them the way this repo tests. A spec that contradicts the architecture doc is
worse than no spec.

**Check the test runner exists.** TDD steps are fiction if `npm test` doesn't
run. If nothing is configured, make setting it up Step 0 of the first spec, and
say so in your report.

## 3. Pick the mode per PRD

- **No spec yet** → write one (§4–6), ending with the first round of
  architectural questions.
- **Spec with answered questions** → run the reconcile cycle (§7).
- **Spec with nothing answered** → don't rewrite it. Summarize what's open and
  stop.

Never overwrite a spec wholesale; reconciling edits in place.

## 4. Design for parallel execution

Sequential specs waste people. Decompose so several developers — or several
agents — can work at once without colliding.

**Freeze the contracts first.** The reason work serializes is that Track B needs
something Track A hasn't built yet. Usually B needs only the *shape*: a type, a
route, a payload, a function signature. Write those into a `Contracts` section
up front and treat them as fixed. Now B builds against the contract while A
implements behind it, and they meet at integration.

**Split into tracks that own disjoint files.** Two tracks editing the same file
is a merge conflict, not parallelism, so list the files each track owns and keep
them from overlapping. A natural split follows the architecture: data/logic in
`lib/`, UI components, the route that composes them.

**State real dependencies only.** Ask what a track needs to *start* versus to
*finish*. Most "dependencies" are on a contract, and the contract already
exists. Anything still genuinely blocked goes into a later wave.

**Every track ends verifiable on its own** — its own tests pass without the
other tracks being done. Then an integration step joins them.

Express the result as waves: `Wave 1 (parallel): Track A, Track B`.

## 5. Write steps in TDD order

Each step is one red-green-refactor turn, small enough to finish in one sitting
and traceable to what it satisfies:

```markdown
#### Step A2 — Reject an entry for a future date

Covers: R4, AC3

- **Test first** — `src/features/entries/lib/validate.test.ts`: assert that
  `validate({ day: tomorrow })` returns an error. Run it: fails with
  "validate is not a function".
- **Implement** — `src/features/entries/lib/validate.ts`: add `validate(input)`
  returning `{ ok: false, error }` when `day` is after today.
- **Green when** — that assertion passes and the rest of the suite stays green.
- **Refactor** — none. / Extract the date comparison once Step A3 needs it too.
```

**Name the expected failure.** "Run it: fails with X" is what proves the test
actually exercises the new behaviour — a test that passes before you write the
code is testing nothing, and this is the cheapest place to catch that.

Every requirement and acceptance criterion in the PRD must be covered by at
least one step. Check that before you finish; a gap here is a feature that
silently doesn't get built.

Write exact paths, exact function and type names, exact assertions. A step that
says "add validation logic" has moved the thinking to the person doing the work,
which is the thing the spec exists to prevent.

## 6. Ask about architecture

A decision belongs at the end of the spec as a question when it is **expensive
to reverse or constrains other steps**: persistence and schema, state
management, API and module boundaries, auth model, server vs client rendering,
sync strategy, a dependency with real lock-in.

Not questions: file naming, helper structure, which date library, anything you
can decide and note as an assumption. Those clutter the list and train the user
to skim it.

Format — up to four options, tickable, exactly one recommended:

```markdown
### Q1. Where do entries persist?

- [ ] A) SQLite via Prisma on the Vercel Postgres adapter *(recommended — the roadmap puts sharing in Epic 3, which needs a real server-side store, and switching later means rewriting every data access path)*
- [ ] B) Vercel KV, keyed by user and day
- [ ] C) localStorage only, deferring the server to Epic 3
- [ ] D) Postgres direct with raw SQL, no ORM
```

Ground the recommendation in the PRD, roadmap, or the repo's conventions and say
which. Four real options, not three straw men. State the cost of reversal — that
is what makes a decision architectural, and it's the information the user needs
most.

Write the spec even with questions open, marking any step that a pending answer
would change. Never re-ask something already in the decision log.

## 7. The reconcile cycle

When answers come back — ticked in the file or given in chat:

**a. Apply each answer as decided design.** Update `Architecture`, `Contracts`,
and every affected step so they read as settled fact, with real names and paths.
No "per Q1" anywhere; a reader shouldn't be able to tell which parts came from
questions.

**b. Rewrite the steps the decision touched.** An architectural answer usually
invalidates steps, not just adds to them. Say plainly which ones changed, and
re-check that requirement coverage still holds.

**c. Move the answered questions to `## Decision log`** under the current cycle,
recording the question, the choice, why, and what it changed. Append-only —
never rewrite a past cycle.

**d. Ask again** if the answer opened new architectural questions, as the next
cycle's round.

**e. Stop when every major decision is settled.** Delete the empty `Open
questions` section and say the spec is ready to execute.

**Edge cases.** Partial ticks → apply what's answered. The user wrote their own
option → that's the answer. An answer contradicts a logged decision → surface
the conflict rather than silently taking the newer one.

## 8. Write it out

Follow [references/tech-spec-template.md](references/tech-spec-template.md).

## 9. Mark the feature ready to implement

`specs/features.md` carries a **Status** column. A feature reaches
🛠 **Ready to implement** when there is nothing left to decide before building:

- **Every PRD in `specs/<feature>/prd/` has a matching tech spec**, and
- **no spec has open architectural questions**, and
- **no PRD has open questions either** — an unsettled requirement invalidates
  the steps written against it, whatever state the spec is in.

All three hold → set the status to 🛠 Ready to implement. Any one fails → leave
the row as it is and say in your report exactly what is still outstanding.

A run narrowed to one epic (`/writespec feature-8 epic-2`) usually leaves the
other epics unspecced, so it usually changes nothing. Check the whole feature
before setting the status, not just the epic you ran.

The point of the status is that `/implement-feature` can start immediately. Set
it early — while questions are open or an epic has no spec — and the next person
to read the index is misled into dispatching agents against requirements that
are still moving. Leave the summary text alone; specs record how, not what.

## 10. Report back

Per epic: the file written, the tracks and which run in parallel, requirement
coverage (every R and AC hit by a step), decisions folded in and what they
changed, and the count of architectural questions still open.

Then, for the feature as a whole: whether it is now 🛠 Ready to implement in
`specs/features.md`, or what is still blocking that.

**Then the next step:**

- **Every epic specced and no questions open** → point at
  `/implement-feature <feature>`. Don't run it.
- **Otherwise** → name what is missing: an epic with no spec, or an
  architectural question still to tick. `/implement-feature` dispatches parallel
  agents, so it is the most expensive place in the chain to discover that the
  requirements were still moving.

`docs/skills.md` has the full chain.
