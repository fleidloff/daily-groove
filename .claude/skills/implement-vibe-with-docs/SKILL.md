---
name: implement-vibe-with-docs
description: Build a change that `/vibe-with-docs` has specced in `specs/tmp/N-title/` — write the contracts, run its tracks in waves (or build it in the lead when there is one), gate it with the `verifier` against `spec.md`'s `## Done when` bullets, then turn what is worth keeping into ADRs and docs changes, add the archive row to `specs/features.md`, and delete the temporary folder. Refuses a folder with no `tech-spec.md` or with anything still open. Use whenever the user runs `/implement-vibe-with-docs`, or asks to build, implement or ship a vibed change.
argument-hint: [N]
---

# Vibe with docs — implement

The building half of the third door. `/vibe-with-docs N` settled what changes
and how; this skill turns that into a diff, and then turns the temporary
documents into the permanent record before deleting them.

**The last part is the point.** The folder goes away in §8, so anything worth
keeping has to be moved somewhere that is read: an ADR, a document under
`docs/`, and one row in the archive. A run that builds the code and skips §8
leaves the reasoning in a folder it is about to delete.

## 0. Never commit

No `git add`, no `git commit`, no branch, no stash. Everything this run changes
stays in the working tree for the user to read and commit themselves — the folder
deletion in §9 included.

## 1. Resolve the folder

- `/implement-vibe-with-docs 4` → `specs/tmp/4-*/`.
- Bare → list `specs/tmp/` with each folder's phase and ask which. Don't guess
  at the most recent one.
- No such folder → say so and point at `/vibe-with-docs`.

## 2. Refuse unless it was specced

Three gates, in this order. Each stops the run — say which failed and what to
run, and change nothing.

| Folder state | What it means | Say |
| :-- | :-- | :-- |
| no `tech-spec.md` | the implementation was never talked through | run `/vibe-with-docs N` |
| `spec.md` has bullets under `## Open` | specced, not settled | name each one, then run `/vibe-with-docs N` |
| `## Done when` is empty or missing | there is nothing to grade against | run `/vibe-with-docs N` |

**Don't answer an open question yourself**, and don't build the option you would
have picked. An `## Open` bullet built anyway is a decision nobody made,
arriving as a diff.

A bullet under `## Open` that names what it is waiting on and says it is
*deliberately* parked out of scope is settled, not open. The test is whether the
build needs it.

## 3. Re-run the size test

`/vibe-with-docs` §7's four questions, now against the files you actually open.
The tech spec was written from a reading; the code is the thing.

**Escalating mid-build is allowed and expected.** If the third file tells you
this is bigger than the spec says, stop, write what you found into `spec.md`
under `## Decided`, leave the tree as it is, and say so. Ask before continuing —
a waiver is the user's to give, and it goes in `spec.md` in their words.

## 4. Plan the schedule

`tech-spec.md` declares epics, tracks, roles and waves (`/vibe-with-docs` §6).
Read them and build the list of **units** — a unit is the smallest chunk one
agent can own end to end: a track, or a whole epic when it is small.

**Contracts go first, in the lead.** If `tech-spec.md` has a `## Contracts`
section, write those types and signatures before dispatching anything. Every
worker then builds against a real file instead of a description, which removes
most of the coordination cost.

**The scheduling rule is file ownership.** Two agents writing one file is a lost
edit, not parallelism. Take the `Owns` list from each track; where two overlap,
merge the units or put them in different waves. If the overlap is unavoidable,
merge them — a worktree split would need commits to merge back (§0), so that is
the user's call, not yours.

**One track means build it in the lead.** A single-track spec is the common
case for this door, and dispatching one agent for it buys nothing: it throws
away the reading §3 just made you do and pays to have it done again. Follow the
steps yourself, red then green.

**Two or more tracks means dispatch them**, one agent per unit in the current
wave, in a single message so they run concurrently. Aim for 3–5 concurrent
workers; past that, coordination costs more than it buys.

Mark nothing in `specs/features.md` yet — this door writes its row once, at the
end (§7c).

## 5. Dispatch by the role the track declares

**Read each unit's `Role` field and dispatch that agent type.** The role was
decided in the conversation, where the reasoning was — do not infer it from the
files the unit owns. Give each worker a brief naming the files to read
(`spec.md`, `tech-spec.md`), the files it owns, its steps, the test command and
its definition of done. Workers start with no knowledge of the conversation, so
anything only said in chat and not written into the two documents does not reach
them — which is `/vibe-with-docs` §5's rule doing its job.

**When a track declares no role**, fall back to `implementer`, except for a
track owning files under `scripts/grooves/`, which takes the musician-then-
implementer pair below. Say in the report where you had to fall back.

### A generator unit takes two turns

A unit owning files under `scripts/grooves/` is the one exception to one agent
per unit:

1. **The `musician` runs first.** It decides the parameters and states the
   reasoning, and writes no file under `scripts/grooves/`.
2. **The lead passes that reasoning to an `implementer`**, which makes the
   change.

It stays one unit and occupies two turns; the other units in the wave run
alongside both. Worth the dispatch even on a single-track spec, because
`docs/music.md` is deliberately not loaded into a normal session, so the musical
judgement is exactly what a session that has not read it gets wrong.

### The roles this door does not use

**Not `architect`.** `tech-spec.md` is the spec, written in the conversation
with the user. If the change wants a second one, it wanted `/create-feature`.

**Not `test-writer` and `implementer` on a single-track spec** — the lead writes
both the test and the code there (§4). On a multi-track spec they are the normal
dispatch, exactly as in `/implement-feature`.

**`sam` is available throughout**, for a question the build turns up that only
the player can settle. Its answer goes into `spec.md` under `## Decided` before
the code that depends on it.

**`verifier` is the gate in §7**, whatever the track count. It buys the one
thing the lead cannot have: a reader that grades but cannot fix. You wrote or
merged the code, which makes you the worst judge of whether it meets the spec.

## 6. Build it

Follow `tech-spec.md`'s steps in order, red then green — in the lead, or in the
workers, per §4 and §5. `docs/testing.md` applies unchanged: every `## Done when`
bullet a test can settle gets one, and the tests go where that document says.
Run them as you go — §7 is the gate, not the loop.

Build what the spec says, under what `## Decided` decided. A better idea that
turns up mid-build is a note in the report or a second folder, not a silent
substitution: the user read that spec, and the diff should be the thing they
read.

**Between waves, run the suite in the lead** before starting the next one.
Parallel work amplifies whatever is already broken, and a wave that starts on a
red tree hands every worker someone else's failure.

## 7. Checks — the verifier is the gate

Dispatch the **`verifier`** with `spec.md`'s path and the file scope: what
`tech-spec.md` named, plus anything the build actually changed. It runs the full
set —

```bash
npm run lint && npm test && npm run build
```

plus `npm run test:gen` when anything under `scripts/grooves/` changed — and
grades each `## Done when` bullet done / partly / not done. Its rows are
labelled `D1`…`Dn` in the order `spec.md` writes the bullets, the same as a
quick ticket's.

**Check the citations before relaying anything.** Run `scripts/citations.ts`
over the report — `parseCitations` on its markdown, then `checkCitations` with
the repo root. A citation that does not resolve is a failure of the report, not
a passing grade: name the bullet, the file and the test it cited, and send it
back to re-cite or re-grade.

Then fix until it comes back clean:

1. **Fail** → fix in the lead and verify again.
2. **Pass with gaps** → green, but a bullet is uncovered. Write the missing test
   and verify again. The exception is a bullet only a person can settle — a look
   at the page, an ear — which stays **partly** with the reason said out loud.
3. **Pass** → done.

Show what failed. Never report a green run you did not execute, and never weaken
or delete a test to get one. **If the same failure survives three rounds, stop
and report it** rather than looping.

## 8. Turn the temporary documents into the permanent record

**This section is not optional, and it runs before §9 deletes anything.** Do all
four, and say in the report what each one came to — including "nothing".

### 8a. ADRs

Read `spec.md`'s `## Decided` and `tech-spec.md`'s `## Contracts` and
`## Risks`, and ask of each entry: **would reversing this cost real rework, and
does it constrain work that has not happened yet?** Every yes becomes a record
in `docs/adr/`, per the rules in [docs/adr/adrs.md](../../../docs/adr/adrs.md):
copy `0000-template.md`, take the next four-digit number, write it, and add the
row.

- A decision that supersedes an existing ADR says which number it replaces, and
  the old one is edited to ⛔ **Superseded by** — never deleted.
- A parameter chosen inside a rule an ADR already states is not a new ADR.
- Most changes produce none, and "no ADR-worthy decision in this one" is a
  normal outcome. Say it rather than inventing one.

### 8b. The documents under `docs/`

Anything the change made untrue is now a lie in a document that loads into every
session. Check each against the diff and update what moved:

| If the change touched… | Re-read |
| :-- | :-- |
| an import boundary, a module's files, a folder's door | `docs/architecture.md` — the module map describes the tree, and a drifted map is worse than none |
| a rule a linter or structure test now enforces | `docs/coding-guidelines.md` |
| where tests go, or what must be tested | `docs/testing.md` |
| `scripts/grooves/`, a template, a voice, the gate | `docs/music.md` |
| a skill, an agent, or the order they run in | `docs/skills.md`, `AGENTS.md` |
| what the player sees or is told | `docs/persona.md`, if it changes what Sam would say |

### 8c. The archive row

Add a row to the *Vibed changes* table in
[specs/features.md](../../../specs/features.md):

```markdown
| <N> | <Title> | <YYYY-MM-DD> | <what shipped, in one or two sentences, and any ADR it produced> |
```

The folder is about to disappear, so the summary is the only description of this
change that survives. Write it for someone who will read it in three months with
no other context, and name the ADR numbers it produced.

### 8d. Only then, is it done

The row is the equivalent of ✅ **Done**, and
[AGENTS.md](../../../AGENTS.md)'s rule holds: it goes in only when the verifier
came back **pass** and every `## Done when` bullet holds. Anything short of that
means **§9 does not run** — leave the folder where it is, say what is standing
in the way, and stop.

## 9. Delete the folder

`rm -rf specs/tmp/<N>-<title>/`, once §8 is complete and only then.

Say in the report that you deleted it, and what now holds its content: the ADR
numbers, the documents you changed, the archive row. The folder is tracked, so
the deletion is part of the diff the user reviews and `git revert` brings it
back — but ask before deleting if anything in it is not yet reflected in §8's
output.

## 10. Report

The folder and number; the size test's verdict against the real files; the files
changed, one line each; the verifier's verdict and the check results; each
`## Done when` bullet and what settles it; the ADRs written; the documents
updated; the archive row; and that the folder is deleted. Then: the diff is
uncommitted in the working tree.
