---
name: implement-feature
description: Implement every epic in a feature by dispatching parallel agents against its specs. Reads `specs/feature-X/prd/` and `specs/feature-X/tech-spec/`, splits the work into units that own disjoint files, and runs each through analyze → write tests → implement → run tests → fix until green. Ends each epic with a full `/verify-epic` QA pass and fixes until it comes back clean, then reports every AC done / partly / not done. Pass `--teams` to run the units as Claude Code agent teammates instead of subagents. Use whenever the user runs `/implement-feature`, or asks to build, implement, or execute the epics of a feature from its specs.
argument-hint: [feature-X] [--teams]
---

# Implement feature

Execute every epic in a feature from its specs, in parallel where the files
allow it, and report honestly on what the acceptance criteria say versus what
actually got built.

## 0. Never commit

**This skill does not touch git.** No `git add`, no `git commit`, no branch, no
stash, no revert — not in the lead, not in a worker, not at the end of a wave,
not for the status row. Every change this run makes stays in the working tree.

The user reviews the diff in their editor and commits it themselves; a run that
commits as it goes takes that reading away and buries the run's own changes in
history the user did not write. Where a step below would once have committed,
it now just leaves the edit in place.

If a step genuinely needs a commit to proceed, stop and ask — don't commit and
mention it afterwards.

## 1. Resolve target and flags

- `/implement-feature feature-3` → every epic with a PRD in `specs/feature-3/`.
- `/implement-feature feature-3 --teams` → same, run as agent teammates (§6).
- Bare `/implement-feature` → list the folders under `specs/` and ask.

`--teams` may appear anywhere in the arguments. Anything else that looks like an
epic (`epic-2`) narrows the run to that epic.

## 2. Gather the work

For each epic in `specs/<feature>/prd/`:

- **The PRD** is the source of the acceptance criteria you report against. Every
  epic needs one.
- **The tech spec** (`specs/<feature>/tech-spec/<same-basename>.md`) is the
  implementation plan: contracts, tracks, file ownership, TDD steps. Use it
  when it exists — it was written to be parallelized, so don't re-derive it.
- **No tech spec?** Say so. Offer `/writespec <feature>` first, since a spec
  produces better parallel decomposition than improvising from a PRD. If the
  user wants to proceed anyway, derive units yourself and say you did.
- **A PRD with open questions is not ready to build.** Report it and skip that
  epic unless the user overrides.

Read `roadmap.md` for cross-epic dependencies, plus `AGENTS.md` and `docs/` so
workers place and test files the way this repo expects.

## 3. Preflight before dispatching anything

Parallel work amplifies whatever is already broken, so check first:

- **A test runner exists and passes.** The whole flow is "until all tests pass";
  without a runner that's unfalsifiable. If none is configured, set one up
  first, in the lead, before any parallel work — every worker depends on it.
- **The suite is green now.** Record the baseline. Pre-existing failures
  otherwise get attributed to whichever worker touches that area next.
- **The working tree is clean**, or the user has said they're fine with the
  changes mixing in.

## 4. Plan the schedule

Build a list of **units**. A unit is the smallest chunk one agent can own end to
end: a track from a tech spec, or a whole epic when it's small.

Two levels of parallelism, and you want both:

- **Across epics** — epics the roadmap marks independent run at the same time.
- **Within an epic** — tracks that own disjoint files run at the same time.

**The scheduling rule is file ownership.** Two agents editing one file is a lost
edit, not parallelism. List the files each unit writes; where two units overlap,
either merge them into one unit or put them in different waves. If overlap is
unavoidable, merge the units — a worktree split would need commits to merge back
(§0), so it is the user's call, not yours.

**Contracts go first.** If a tech spec has a `Contracts` section, write those
types and signatures in the lead, before dispatch. Every worker then builds
against a real file instead of a description. This one step removes most of the
coordination cost.

Order the rest into waves by real dependency. Aim for 3–5 concurrent workers:
past that, coordination overhead grows faster than throughput.

## 5. Dispatch (default: subagents)

First mark the feature 🔨 In progress in `specs/features.md` (§10) — a run that
dies after this point still leaves an honest row.

Spawn one agent per unit in the current wave, in a single message so they run
concurrently. Give each the brief in
[references/worker-brief.md](references/worker-brief.md) — teammates and
subagents alike start with no knowledge of this conversation, so the brief must
name every file to read, the files it owns, the test command, and its
definition of done.

**Every worker writes a status file** to
`specs/<feature>/.implement/<unit>.md` before finishing, in the format the brief
specifies. Don't rely on the returned message alone: it's the only artifact that
survives a worker dying mid-run, and in teams mode you don't get the output back
at all (§6). Add `.implement/` to `.gitignore` if it isn't there.

## 6. Teams mode (`--teams`)

Read [references/teams-mode.md](references/teams-mode.md) before dispatching —
agent teams behave differently enough from subagents to break a flow written for
subagents.

The short version: agent teams are **experimental and off by default**, enabled
by the `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` environment variable — there is
no key or token. Check for it before doing anything else. If it's unset, say how
to turn it on and offer to run in subagent mode instead; don't silently
downgrade, and don't edit their settings without asking.

## 7. The worker loop

Every unit, in either mode, runs the same five steps:

1. **Analyze** the spec for its unit — requirements, ACs, steps, contracts.
2. **Write the tests first**, from the spec, and run them to confirm they fail
   for the right reason. A test that passes before the code exists is testing
   nothing.
3. **Implement** until those tests pass.
4. **Verify light** — run only its own tests, scoped to the files it owns.
5. **Fix and repeat** until those pass.

**Workers run their own tests and nothing else.** Not the full suite, not
integration, not e2e. Ten workers each running the whole suite is the same work
done ten times, and a worker that fails on someone else's half-finished code
starts debugging a file it doesn't own. Breadth is the QA gate's job (§9);
depth on its own unit is the worker's.

A worker that can't get green does not quietly stop: it reports what fails and
why. A false "done" costs more than a clear failure, because the next wave gets
built on top of it.

## 8. Wave gate — cheap checks only

Workers prove their own unit and stop there, so the lead checks that the units
still fit together. Keep this gate fast; it runs after every wave:

- **Type check.** Catches almost all cross-unit breakage from parallel edits —
  a changed signature, a contract drifted — in seconds.
- **The unit tests of the units that just ran**, together in one pass.
- Nothing else. No integration tier, no e2e, no full-repo suite. Those belong to
  the QA gate, and running them per wave means paying for the slowest tier once
  per wave to learn what one run at the end tells you.

Fix what this catches before starting the next wave — compounding breakage
across waves is expensive to unpick, which is why the gate exists at all
rather than deferring everything to §9.

## 9. QA gate — `/verify-epic` per epic

When an epic's last wave is done, run **`/verify-epic <epic> <feature>`**. This
is the only place the full picture gets checked: every tier, type check, lint,
build, and — the part no test run gives you — each acceptance criterion traced
to a test that actually asserts it.

Then fix until it comes back clean:

1. Run `/verify-epic` for the epic.
2. **Fail** → fix the failures, in the lead or by dispatching focused workers
   scoped to the failing files, and go back to 1.
3. **Pass with gaps** → the suite is green but ACs are uncovered. Write the
   missing tests, then go back to 1. An untested AC is not implemented; nothing
   will tell you when it breaks.
4. **Pass** → the epic is done. Move to the next epic.

Two rules for the fix loop, because this is where an agent under pressure to
finish starts cheating:

- **Never weaken or delete a test to make the gate pass.** The gate is the only
  thing standing between "the run ended" and "the epic works".
- **If the same failure survives three rounds, stop and report it.** Looping on
  a failure you don't understand burns tokens and usually means the spec, not
  the code, is wrong. Say what you tried.

Verification stays in `/verify-epic` and repair stays here, deliberately: a
verifier that can also fix is a verifier that can talk itself into a green
report.

## 10. Keep the status column true

`specs/features.md` carries a **Status** column running 📋 Planned → 🛠 Ready to
implement → 🔨 In progress → ✅ Done. The column has one job: to tell the next
reader what is actually built. It is wrong as often as it is stale, so it is
edited twice in a run, not once.

**The row must never be left behind reality.** A row still reading 🛠 Ready to
implement over a feature whose code shipped weeks ago is the same failure as a
premature ✅ — both send the next person to the wrong place. If you notice, at
any point in a run, that a row disagrees with the tree, say so and correct it,
whether or not it is the feature you were asked to build.

### When the run starts

Before dispatching the first wave, set every feature you are about to build to
🔨 **In progress**. Leave the edit uncommitted like everything else (§0).

This is not bookkeeping. A run can die mid-wave, be interrupted, or be held at a
precondition, and every one of those paths skips the end-of-run edit below. A
row moved at the start degrades to "someone was working on this" — which is
true and useful. A row left untouched degrades to "nobody has started", which is
false and sends the next person to re-implement finished work.

Skip this only when the run is held before any unit is dispatched. Then nothing
was started, and the row should keep saying so.

### When the run ends

Move the row using the verified results — never the sense that the run went
well.

- **Every epic in the feature passed `/verify-epic` clean, and every AC is
  marked Done** → set the status to ✅ Done.
- **Some epics done, others not started or not clean** → 🔨 In progress.
- **A single AC is Partly or Not done** → the feature is not Done. Leave it
  🔨 In progress and say so in the report.
- **The run was abandoned, blocked or held** → say which in the report, and
  leave the row at whatever the truth is. An abandoned run still owes the column
  an accurate value.

Run narrowed to one epic (`/implement-feature feature-8 epic-2`)? Only the
epics you ran can change status. The rest of the feature is untouched, so unless
this was the last outstanding epic the row stays 🔨 In progress.

Untested is not done. An AC with no passing test behind it may well work, but
nothing will tell you when it stops — and a ✅ that means "probably" makes the
whole index worthless for planning. That is the one thing this column is for.

Leave the summary text alone. Implementation reports status, not scope; a
briefing that turned out to describe something different is a conversation to
have, not a row to quietly rewrite.

## 11. Report

Write the run report to `specs/<feature>/.implement/report.md` and summarize it
in chat, using
[references/report-template.md](references/report-template.md).

Its acceptance-criteria table comes from the `/verify-epic` reports at
`specs/<feature>/.verify/` — those are the verified results, so don't restate
them from memory or re-grade them more kindly. Every AC from every PRD, marked:

- **Done** — implemented and covered by a passing test. Name the test.
- **Partly** — implemented but untested, or tested but incomplete. Say which
  part is missing.
- **Not done** — no implementation, or the work failed. Say why.

Only ever mark Done what a passing test actually demonstrates. This table is the
deliverable of the whole run; an inflated one makes every later decision worse,
and the user cannot tell without redoing the work themselves.

Close by stating the feature's status in `specs/features.md` and whether this
run changed it.
