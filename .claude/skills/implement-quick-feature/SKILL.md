---
name: implement-quick-feature
description: Build a quick ticket that `/quick-feature` has already analyzed — re-check the size test against the real files, write the test then the code in the lead, run lint, tests and build, and record what was built in `specs/quick/N-slug.md`. Refuses to run on a ticket with no `## Notes` or with unticked `## Open questions`, and escalates to `/create-feature` if the change stops being small mid-build. Use whenever the user runs `/implement-quick-feature`, or asks to build, implement or ship a quick ticket.
argument-hint: [N]
---

# Quick — implement

The building half of the quick door. `/quick-feature N` decided what changes,
which files it touches and what was left open; this skill turns that into a
diff.

**What this path drops is the planning, never the checks.** For a small change
the risk is not "wrong feature", it is "landed in the wrong place" — and the
lint zones in `docs/coding-guidelines.md`, the structure tests and
`docs/testing.md`'s standard are what catch that. They are the substitute for
the spec, so §6 is not optional.

## 0. Never commit

Like `/implement-feature`: no `git add`, no `git commit`, no branch, no stash.
Everything this run changes stays in the working tree for the user to read and
commit themselves.

## 1. Resolve the ticket

- `/implement-quick-feature 7` → `specs/quick/7-*.md`.
- Bare → list `specs/quick/` with each ticket's status and ask which. Don't
  guess at the most recent one.
- No such ticket → say so and point at `/create-quick-feature`.

## 2. Refuse unless it was analyzed

Three gates, in this order. Each one stops the run — report which failed and
what to run, and change nothing.

| Ticket state | What it means | Say |
| :-- | :-- | :-- |
| no `## Notes` | never analyzed | run `/quick-feature N` first |
| `## Open questions` has an unticked question | analyzed, not settled | name each open question, then run `/quick-feature N` once they are ticked |
| answers ticked but no `## Answered` section | the answers were never folded in | run `/quick-feature N` to reconcile them |

A question counts as answered when one of its options is ticked (`- [x]`), or
when the question is explicitly marked answered by an `## Answered` section
naming it. `_None._` under `## Open questions` is a settled ticket, not a
missing one.

**Don't answer an open question yourself, and don't build the recommended
option "since it was obviously the right one".** The recommendation is an
argument the user has not accepted yet. The gate exists because a ticket built
against an unanswered question is a decision nobody made, arriving as a diff.

## 3. Re-run the size test

`/quick-feature` §2's four questions, now against the files you actually open.
The notes were written from a reading; the code is the thing.

**Escalating mid-build is allowed and expected.** If the third file you open
tells you this is bigger than the ticket says, stop, write what you found into
the ticket under `## Notes`, leave the working tree as it is, and say so. That
is the escalation path working, not a run that failed. Ask before continuing
anyway — a waiver is the user's to give, and it goes in the ticket in their
words, as `specs/quick/5-lick-variations.md` records one.

## 4. Build it in the lead

No dispatch. A quick change is one to three files, and the fan-out machinery in
`/implement-feature` earns its coordination cost across epics that own disjoint
files — here every agent would need the ticket re-explained to it, to save
nothing.

Test first, then the code: `docs/testing.md` applies unchanged, and a quick
change is not an untested change. Every `## Done when` bullet that a test can
settle gets one. Run the ticket's own tests as you go; §6 is the gate, not the
loop.

Build what the ticket says, under the option that was ticked. A better idea that
turns up mid-build is a note in the report or a second ticket, not a silent
substitution — the user reviewed `## Notes`, and the diff should be the thing
they reviewed.

## 5. Agents

**`musician`, for any ticket touching `scripts/grooves/`.** Dispatch it to
decide the musical parameters and state the reasoning, then apply that yourself
— the same two-turn shape as `/implement-feature` §5, without the waves. It is
worth the dispatch here because `docs/music.md` is deliberately not loaded into
a normal session, so the musical judgement is exactly the part a session that
hasn't read it gets wrong.

**Not `architect`.** A tech spec for a two-file change is the chain again; if
the change wants one, it wants `/create-feature`.

**Not `verifier`.** It grades acceptance criteria against a PRD, and a quick
ticket has none. The `## Done when` bullets plus §6 are the gate.

**Not `test-writer` or `implementer`.** They own units of a tech spec. Here the
lead writes both the test and the code.

**A listening sign-off still doesn't stall the run** — if the change needs an
ear, say so in `## Built` and leave that bullet unverified rather than claiming
it was heard.

## 6. Checks

```bash
npm run lint && npm test && npm run build
```

Plus `npm run test:gen` when anything under `scripts/grooves/` changed.

Show what failed. Never report a green run you did not execute, and never weaken
or delete a test to get one.

Then walk the `## Done when` bullets one by one and say which test or which look
at the page settles each. A bullet nothing settles is not done, and saying so is
the report's job.

## 7. Record what was built

Append to the ticket:

```markdown
## Built
* `path` — what changed
* tests: <what was added, and where>
* checks: lint / test / build — <result>
```

The ticket is the record. Quick changes write no `.implement/` or `.verify/`
report.

Then move the row in `specs/features.md`'s *Quick changes* table to ✅ **Done** —
only when §6 came back green and every `## Done when` bullet holds. Untested is
not done, same rule as `/implement-feature` §10. Anything short of that leaves
the row at 🛠 **Ready to build** and says why.

## 8. Report

The ticket path; the size test's verdict against the real files; the files
changed, one line each; the check results; each `## Done when` bullet and what
settles it; and the row you moved. Then: the diff is uncommitted in the working
tree.
