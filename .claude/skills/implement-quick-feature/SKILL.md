---
name: implement-quick-feature
description: Build a quick ticket that `/quick-feature` has already analyzed — re-check the size test against the real files, write the test then the code in the lead, gate it with the `verifier` over lint, tests and build, and record what was built in `specs/quick/N-slug.md`. Refuses to run on a ticket with no `## Notes` or with unticked `## Open questions`, and suggests `/create-feature` if the change stops being small mid-build, leaving that call to the user. Use whenever the user runs `/implement-quick-feature`, or asks to build, implement or ship a quick ticket.
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
The notes were written from a reading; the code is the thing. This is the
lead's judgement and stays there — it needs the whole change in view, which is
also why §4 keeps the build here.

**Escalating mid-build is allowed and expected.** If the third file you open
tells you this is bigger than the ticket says, stop, write what you found into
the ticket under `## Notes`, leave the working tree as it is, and say so. That
is the escalation path working, not a run that failed. Ask before continuing
anyway — a waiver is the user's to give, and it goes in the ticket in their
words, as `specs/quick/5-lick-variations.md` records one.

## 4. Build it in the lead

**No dispatch for the build.** A quick change is one to three files, and §3 has
already made you read all of them — handing them to an agent throws that reading
away and pays to have it done again. The fan-out machinery in
`/implement-feature` earns its coordination cost across epics that own disjoint
files; here there is no parallelism to buy, and every agent would need the
ticket re-explained to it to save nothing.

There is a second reason, and it is the one that bites. A quick ticket's worst
failure is discovering mid-build that the change is not small (§3). The lead
spots that by holding the whole change in view — two agents that each see one
slice of it cannot.

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

**`verifier`, for the gate in §6.** It buys the one thing the lead cannot have:
a reader that grades but cannot fix. You just wrote the code, which makes you
the worst judge of whether it meets the ticket. That property holds at any size,
and it costs one dispatch over checks you were running anyway. Its definition
carries the substitutions a ticket needs — the `## Done when` bullets in place
of a PRD's acceptance criteria.

**Not `architect`.** A tech spec for a two-file change is the chain again; if
the change wants one, it wants `/create-feature`.

**Not `test-writer` or `implementer`, by default.** They own units of a tech
spec, and here the lead writes both the test and the code — see §4. Their
definitions do carry a quick-ticket section, for the one case that earns it: a
**focused fix after the verifier's report**, scoped to the files it named. Reach
for that when the fix is mechanical and the lead's context has moved on, not to
build the ticket.

**A listening sign-off still doesn't stall the run** — if the change needs an
ear, say so in `## Built` and leave that bullet unverified rather than claiming
it was heard. The verifier grades it **partly**, which is correct.

## 6. Checks — the verifier is the gate

Dispatch the **`verifier`** with the ticket path and the file scope: what
`## Notes` named, plus anything the build actually changed. It runs the full
set —

```bash
npm run lint && npm test && npm run build
```

plus `npm run test:gen` when anything under `scripts/grooves/` changed — grades
each `## Done when` bullet done / partly / not done, and writes
`specs/quick/.verify/N.md`. Its report rows are labelled `D1`…`Dn` in the order
the ticket writes the bullets — `D` for `## Done when`, where an epic's rows
read `AC1`. `parseCitations` accepts both.

**Check the citations before relaying anything.** Run `scripts/citations.ts`
over the report — `parseCitations` on its markdown, then `checkCitations` on the
result with the repo root; `node --experimental-strip-types` can import it. A
citation that does not resolve is a failure of the report, not a passing grade:
name the bullet, the file and test it cited, and send it back to the verifier to
re-cite or re-grade.

Then fix until it comes back clean, exactly as `/implement-feature` §9 does:

1. **Fail** → fix it in the lead and verify again. A focused `implementer`
   scoped to the files the report named is the exception, not the reflex (§5).
2. **Pass with gaps** → green but a bullet is uncovered. Write the missing test
   and verify again. The exception is a bullet only a person can settle — a look
   at the page, an ear — which stays **partly** with the reason said out loud.
3. **Pass** → done.

Show what failed. Never report a green run you did not execute, and never weaken
or delete a test to get one. **If the same failure survives three rounds, stop
and report it** rather than looping.

**The verifier cannot fix and the lead does not grade.** That split is the whole
reason to dispatch it for a change this small: an agent that can fix a failing
test can talk itself into a green report, and by §6 you have written the code
and want it to be finished.

If the verifier's report says the diff outgrew the quick door, that is §3's
escalation arriving late — stop and ask, do not absorb it.

## 7. Record what was built

Append to the ticket:

```markdown
## Built
* `path` — what changed
* tests: <what was added, and where>
* checks: lint / test / build — <result>
* verifier: <pass | pass with gaps | fail> — <each `## Done when` bullet and what settles it>
```

The ticket is the record, and the `## Built` section is the lead's to write —
not the verifier's. Quick changes write no `.implement/` status file, and
`specs/quick/.verify/N.md` is gitignored scratch, the same as an epic's.

Then move the row in `specs/features.md`'s *Quick changes* table to ✅ **Done** —
only when the verifier came back **pass** and every `## Done when` bullet holds.
Untested is not done, same rule as `/implement-feature` §10. Anything short of that leaves
the row at 🛠 **Ready to build** and says why.

## 8. Report

The ticket path; the size test's verdict against the real files; the files
changed, one line each; the verifier's verdict and the check results; each
`## Done when` bullet and what settles it; and the row you moved. Then: the diff
is uncommitted in the working tree.
