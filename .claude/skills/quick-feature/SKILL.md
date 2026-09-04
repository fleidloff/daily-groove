---
name: quick-feature
description: Build a small change from a one-page ticket instead of the five-step chain — allocate `specs/quick/NNN-slug.md`, write what changes and what done means, ask any blocking question in the ticket itself, then implement it directly and run the full pre-push checks. Escalates to `/create-feature` the moment it stops being small. Use whenever the user runs `/quick-feature`, or asks for a small change, a tweak, a one-liner, or says something is too small for a feature.
argument-hint: [what to change | NNN] [--go]
---

# Quick

One ticket, one change, no chain. `/create-feature` → `/roadmap` →
`/brainstorm` → `/writespec` → `/implement-feature` buys insurance against
building the wrong thing, and for a change you can describe in five bullets that
insurance costs more than the accident it prevents.

**What this path drops is the planning, never the checks.** For a small change
the risk is not "wrong feature", it is "landed in the wrong place" — and the
lint zones in `docs/coding-guidelines.md`, the structure tests and
`docs/testing.md`'s standard are what catch that. They are the substitute for
the spec, so §8 is not optional.

## 0. Never commit

Like `/implement-feature`: no `git add`, no `git commit`, no branch, no stash.
Everything this run changes stays in the working tree for the user to read and
commit themselves.

## 1. Resolve the phase

| Invocation | Ticket state | Phase |
| :-- | :-- | :-- |
| `/quick-feature 007` | `## What` and `## Done when` written by hand, no `## Notes` yet | **Analyze** — fill in `## Notes` and `## Open questions`, then stop (§4, §5). |
| `/quick-feature 007` | analyzed, no questions open | **Build** (§6). |
| `/quick-feature 007` | questions unticked | Say what is open, stop. |
| `/quick-feature <prose>` | none yet | **Draft** the whole ticket from the prose, then stop. |
| `/quick-feature <prose> --go` | none yet | Draft and build in one run, only if the draft ends with no questions. |
| bare `/quick-feature` | — | List `specs/quick/` with each ticket's status and ask which. |

**The hand-written ticket is the normal way in.** The user opens
`specs/quick/NNN-slug.md`, writes `## What` and `## Done when`, and runs
`/quick-feature NNN`. Analyze and build are two runs on purpose: the notes name the
files before any code exists, which is the cheapest moment to catch a wrong
module.

A ticket whose `## Open questions` still has unticked options is not buildable.
Say what is open, and stop.

## 2. The size test

Both phases start here, and the build phase re-runs it — a ticket that looked
small can stop being small the moment you open the files.

1. Can you name what changes, the files it touches, and what done means, in
   five bullets or fewer?
2. Does it touch at most **two** of the six modules in
   [architecture.md](../../../docs/architecture.md) — catalogue, theory, audio,
   puzzle, coaching, shell?
3. Does it leave the four frozen things in `docs/music.md` alone? Anything that
   re-renders the catalogue or reassigns past puzzles is never quick.
4. Is one `git revert` the whole rollback?

**Any "no" means hand it to `/create-feature` instead.** Say which question
failed and why, and stop. Don't negotiate the ticket down until it fits — a
change trimmed to pass this test is a feature being smuggled through the cheap
door, and the parts you trimmed come back as a second ticket nobody planned
against.

More than two open questions surviving one round is itself a failed test (§5).

**Escalating mid-build is allowed and expected.** If the third file you open
tells you this is bigger than the ticket says, stop, write what you found into
the ticket under `## Notes`, leave the working tree as it is, and say so. That
is the escalation path working, not a run that failed.

## 3. Allocate the number

`specs/quick/NNN-slug.md` — three digits, highest existing plus one, never
filling a gap. The slug is the title in kebab-case. Create `specs/quick/` if it
isn't there.

Only the draft phase allocates here. `/create-quick-feature` and `/roadmap` §3
allocate too — the first from an interview, the second when it moves a one-epic
briefing to this path; both write `## What` and `## Done when` only, so their
tickets enter the table above as hand-written ones. A hand-written ticket
already has its number, and if the user picked one that collides or fills a gap,
say so and let them rename it — don't move their file.

## 4. Who writes which section

```markdown
# NNN — Title

## What                          <- the user's
* one idea per bullet

## Done when                     <- the user's
* bullets a test or a look at the page can settle

## Open questions                <- yours
_None._

## Notes                         <- yours
* files this is expected to touch
* assumptions taken rather than asked
* size-test verdict
```

**`## What` and `## Done when` are the user's. `## Notes` and
`## Open questions` are yours.** That line is the whole division of labour:
intent from the person who wants the change, consequences from the session that
has read the tree.

So in the analyze phase, **do not rewrite either of the first two sections.**
Not to tighten the wording, not to split a bullet, not to add the thing they
obviously forgot. If a `## What` bullet is ambiguous it becomes a question (§5);
if a `## Done when` bullet can't be settled by a test or by looking at the page,
say so in the report and let the user fix it. Editing intent in place is how a
ticket quietly becomes yours, and the user has no way to see it happened.

The draft phase (`/quick-feature <prose>`) writes all four sections, because there is no
hand-written ticket to preserve — but the first two still follow
`/create-feature` §3: the user's framing and their level of detail, not yours.
Show the draft and let them adjust before building.

**`## Notes` names the expected files before any code exists.** It is the
cheapest way for the user to spot a wrong module while the change is still one
line to correct, and it is what §2's second question is checked against. It also
carries every assumption you took rather than asked, and the size-test verdict.

## 5. Open questions

Same mechanism as `/brainstorm` §4, because the answers belong beside the thing
they affect and not in a chat prompt that scrolls away. Up to four tickable
options, exactly one recommended, and say what the recommendation is grounded in
— the user's own words, `docs/persona.md`, or, when both are silent, the
engineering reason, named as such.

```markdown
### Q1. Where does the reference line sit in the solved box?

- [ ] A) Under the mode line, same muted style *(recommended — it reads as part of the same sentence about the mode)*
- [ ] B) Its own labelled column below the staff
- [ ] C) Beside the heading, on one row
```

**Only ask what would change the work.** Anything you can decide sensibly
becomes an assumption under `## Notes` instead. **Two questions is the
ceiling.** A third is the size test telling you this wants a PRD.

## 6. Build it in the lead

No dispatch. A quick change is one to three files, and the fan-out machinery in
`/implement-feature` earns its coordination cost across epics that own disjoint
files — here every agent would need the ticket re-explained to it, to save
nothing.

Test first, then the code: `docs/testing.md` applies unchanged, and a quick
change is not an untested change. Run the ticket's own tests as you go; §8 is
the gate, not the loop.

## 7. Agents

**`musician`, for any ticket touching `scripts/grooves/`.** Dispatch it to
decide the musical parameters and state the reasoning, then apply that yourself
— the same two-turn shape as `/implement-feature` §5, without the waves. It is
worth the dispatch here because `docs/music.md` is deliberately not loaded into
a normal session, so the musical judgement is exactly the part a session that
hasn't read it gets wrong. Note that most generator tickets fail §2's third
question anyway and belong in a feature.

**Not `architect`.** A tech spec for a two-file change is the chain again; if
the change wants one, it wants `/create-feature`.

**Not `verifier`.** It grades acceptance criteria against a PRD, and a quick
ticket has none. The `## Done when` bullets plus §8 are the gate.

**Not `test-writer` or `implementer`.** They own units of a tech spec. Here the
lead writes both the test and the code.

**A listening sign-off still doesn't stall the run** — if the change needs an
ear, say so in `## Built` and leave that bullet unverified rather than claiming
it was heard.

## 8. Checks

```bash
npm run lint && npm test && npm run build
```

Plus `npm run test:gen` when anything under `scripts/grooves/` changed.

Show what failed. Never report a green run you did not execute, and never weaken
or delete a test to get one.

## 9. Record what was built

Append to the ticket:

```markdown
## Built
* `path` — what changed
* tests: <what was added, and where>
* checks: lint / test / build — <result>
```

The ticket is the record. Quick changes write no `.implement/` or `.verify/`
report.

## 10. Register it in `specs/features.md`

Two edits, both in that file.

**The Quick changes table** — the third table, after *Prepared candidates* and
before the candidate ideas list. Create it with its own heading and legend if it
isn't there yet. Columns `# | Change | Status | Summary`:

`| [007](quick/007-slug.md) | <short name> | 📝 Drafted | <one-sentence summary> |`

Status runs 📝 **Drafted** → ❓ **Questions open** → ✅ **Done**. A row goes in
when the ticket is written, and moves to ✅ only when §8 came back green and
every `## Done when` bullet holds. Untested is not done — same rule as
`/implement-feature` §10.

**The candidate ideas list at the bottom** — if this ticket takes up one of
those ideas, delete its row, exactly as `/create-feature` §5 does. Judge by
whether the ticket covers what the idea proposed, not by the wording. Partly
covered → keep the row and narrow it to what remains, and say so in the report.

## 11. Report

The ticket path; the size test's verdict; the files changed, one line each; the
check results; and the row you wrote or moved. Then the next step — questions
open, point at the ticket; escalated, point at `/create-feature`; built, say the
diff is uncommitted in the working tree.
