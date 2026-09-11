---
name: vibe-with-docs
description: Design a feature in chat, one question at a time, and write the answers down as you go — allocates `specs/tmp/N-title/`, fills `spec.md` with what the change is and what done means, then `tech-spec.md` with how it gets built. Asks in the conversation rather than in the document, and keeps asking until it is 90% confident. Writes no code; `/implement-vibe-with-docs N` builds it. Use whenever the user runs `/vibe-with-docs`, or asks to think a feature through in chat, design something conversationally, or spec a change without running the five-step chain.
argument-hint: [what to build]
---

# Vibe with docs

A third door, beside the five-step chain and the quick ticket. The chain asks
its questions *inside* the document and needs a run per step; this one asks them
in the conversation and writes the answers down as they land.

**The trade is deliberate.** The chain's in-document questions buy a record you
can re-read weeks later and a stopping point between steps. Talking buys speed
and follow-ups — a question whose answer opens two more gets both asked in the
same minute instead of the next run. What this skill refuses to trade away is
the writing down: **every answer goes into the file before the next question is
asked.** A conversation nobody wrote down is the thing this door is not.

## 0. No code, and never commit

No `git add`, no `git commit`, no branch, no stash. And **no source edits** — not
a test, not a one-line fix, not a spike. This skill writes exactly two files,
both under `specs/tmp/N-title/`. Reading the tree is the job; writing to it is
not.

`/implement-vibe-with-docs N` builds it, and is the only thing that does.

## 1. Start in the conversation, immediately

No interview ceremony, no "shall I begin". Take whatever the user gave —
`/vibe-with-docs a jam mode`, or a bare `/vibe-with-docs` — and:

1. Allocate the folder (§2).
2. Write what you already know into `spec.md`.
3. Ask the first question.

A bare invocation with no subject is the one case where you ask before writing:
"what are we building?", then allocate.

**One question per message. Never a list.** A batch asks the user to hold four
threads at once, and the second answer usually changes the third question.

## 2. Allocate the folder

```
specs/tmp/<N>-<kebab-title>/
├── spec.md        § 3 — what changes, and what done means
└── tech-spec.md   § 6 — how it gets built
```

`N` is one higher than the largest number in **either** `specs/tmp/` or the
*Vibed changes* table in [specs/features.md](../../../specs/features.md). The
folder is deleted when the change ships, so the table is what remembers the
number — take it from both or you will reuse one.

**`specs/tmp/` is committed like any other spec folder** — a change defined over
several sessions has to survive a machine, and a half-finished spec is worth
reviewing. What it is not is permanent: §8 of `/implement-vibe-with-docs` turns
what is worth keeping into an ADR, a docs change and an archive row, and §9 then
deletes the folder, so the deletion arrives as part of the same diff as the
feature.

Set the terminal title as soon as the number exists:
`.claude/scripts/title.sh "V4) speccing the jam mode"`.

## 3. `spec.md` — what we are building

Create it on the first turn, with whatever the user's opening line already
settles. It grows through the conversation; it is never written all at once at
the end.

```markdown
# V<N>. <Title>

Started <YYYY-MM-DD> · `/vibe-with-docs`
**Phase:** spec | tech spec | ready to build — `/implement-vibe-with-docs <N>`

## What

* one idea per bullet, in the user's own words where they said it

## Done when

* one bullet per thing that has to be true, each one testable or explicitly
  marked as needing an ear or a look

## Decided

* **<the question>** — <the answer>, because <the reason they gave>

## Open

* <anything parked deliberately, and what it is waiting on>
```

**`## Decided` is the load-bearing section.** It is where the chain's question
log went. Write the answer *and* the reason: a decision without its reason is
the thing nobody can revisit six weeks later.

## 4. The question loop

Keep asking until you are **90% confident you could build the right thing
without guessing**. That is the bar — not "the user seems done", not "there is
enough to start".

After every answer:

1. Write it into `spec.md` — `## What`, `## Done when` or `## Decided`,
   whichever it belongs in.
2. Ask the next question, or say the spec is settled and move to §6.

**What is worth a question:**

- two readings of the ask that would produce different work
- a `## Done when` bullet you cannot write because you do not know what done is
- a scope edge — is *this* in or out
- a decision the user would want to make themselves: what the player sees, what
  the app says, what happens in the unhappy case

**What is not:**

- anything the tree answers. Read the file.
- anything `docs/architecture.md`, `docs/coding-guidelines.md`,
  `docs/testing.md` or `docs/adr/adrs.md` already decides — those are settled,
  and re-asking them invites an answer that contradicts a record.
- implementation. It has its own phase, and asking early anchors the design to
  the first shape you thought of.

**Recommend, don't survey.** Where you have a view, ask the question and say
which way you would go and why. Three options with no opinion is work handed
back.

**Dispatch `sam` when the question is the player's**, per
[AGENTS.md](../../../AGENTS.md) — what they would do, what would lose them,
what they would not understand. Its answer goes in `## Decided` in its own
voice. Don't dispatch it for anything the code decides; it will tell you "no
persona bearing" anyway.

## 5. Stopping is safe, and it is the normal case

**The user may stop after any answer, and the work must survive it.** This door
is asynchronous by design: a feature can be defined over a week, a few questions
at a time, in different sessions.

What that requires of you:

- **Nothing lives only in the conversation.** An answer you are holding in your
  head to write down "once the section is finished" is an answer that is lost if
  the user closes the tab. Write it, then ask.
- **Keep `**Phase:**` current** — the line at the top of `spec.md` is how a
  later session knows whether it is still shaping the product or already on the
  code. Change it when the phase changes, not at the end.
- **Write the question you are about to ask.** Before asking, the thing still
  open goes under `## Open` with what it is waiting on. If the answer arrives,
  move it to `## Decided`; if the user stops, the next session reads exactly
  where the conversation was.
- **No summary is owed at the end of a session.** `spec.md` is the summary. If
  the user stops mid-flight, say the folder path and what the next question was,
  in a line.

And the reason the build is a second skill: **the user decides when
implementation starts.** Never roll into it because the spec looks finished, and
never write code "to check the shape" — §0 means it.

## 6. `tech-spec.md` — how it gets built

Only once `spec.md` is settled, and say so before you start: the phase change is
the user's cue that the subject just moved from the product to the code.

Same loop, same rule — one question at a time, every answer written down before
the next one. Set `**Phase:**` to `tech spec`.

```markdown
# V<N>. <Title> — tech spec

## Contracts

* the types, signatures and storage keys the change adds or widens, written out
  in full — these are frozen, and every track builds against them

## Epics

One heading per epic when the change splits, otherwise one epic called the
change itself.

### Epic 1 — <name>

#### Track A — <name>

* **Role:** `test-writer` | `implementer` | `architect` | `musician`
* **Owns:** the files this track writes, and nothing another track writes
* **Needs to start:** a contract, or another track — name it

1. **red** — the test, and what it asserts
2. **green** — the smallest change that passes it
3. …

## Waves

* **Wave 1 (parallel):** Track A, Track B
* **Wave 2:** Track C — needs A's <thing>

## Checks

* which tiers run: `npm run lint`, `npm test`, `npm run build`, and
  `npm run test:gen` if anything under `scripts/grooves/` moves

## Risks

* what could re-render, reassign or break, and what holds it
```

### Design it to run in parallel

This is `/writespec` §4's method, applied by hand in the conversation instead of
by the `architect`. The whole of it holds:

- **Freeze the contracts first.** Work serialises because Track B needs
  something Track A has not built. Usually B needs only the *shape* — a type, a
  signature, a key. Write those out up front and both tracks build against them.
- **Tracks own disjoint files.** Two tracks writing one file is a merge
  conflict, not parallelism. List what each one owns, and where two overlap,
  merge them or put them in different waves.
- **Every track declares a role**, chosen by what its work *is*: a track whose
  product is tests takes `test-writer`, one writing code behind a frozen
  contract `implementer`, one deciding shape or decomposition `architect`, and
  **any track owning files under `scripts/grooves/` takes `musician`** — those
  are musical decisions and no other role is equipped to make them.
  `/implement-vibe-with-docs` reads this field to decide what to dispatch, so a
  track without one leaves it guessing.
- **State real dependencies only.** Ask what a track needs to *start* versus to
  *finish*. Most answers are a contract, and the contract already exists.
- **Every track ends verifiable on its own**, then an integration step joins
  them.

### Split into epics when it splits, and not otherwise

An epic here is a slice that ships something on its own and can be verified on
its own. Split when the change has two of those; keep one epic when it has one.

**Don't invent a split.** Two tracks that cannot name disjoint files are one
track, and one track in one epic is a perfectly good tech spec — it is what a
two-file change looks like. An invented second track costs a dispatch, a brief
and a merge to buy nothing.

**Ask the user before splitting**, in one question, when it is a real fork:
"this looks like two epics — the data and the UI — or one; which do you want?"
The answer goes in `## Decided`.

### What to ask, and what to read

**Read before you ask.** A question the tree answers — which file holds this,
what that hook returns, whether a helper exists — is a question you should have
searched. Ask about forks the code cannot settle: where a boundary should fall,
whether a thing gets a door, what a test should pin, whether the split is worth
it.

**Name the module for every file**, from the six in
[docs/architecture.md](../../../docs/architecture.md). Two modules is
comfortable; more than three is the signal that this wanted the chain, and
saying so is §7.

**The frozen things are not negotiable.** Before writing a step that touches
`scripts/grooves/`, read [docs/music.md](../../../docs/music.md) — and if the
change reaches `src/lib/hash.ts`, `MUSIC_LABEL`'s draw order, a template's
`flavours` or a groove's `uuid`, stop and say what it would re-release. Dispatch
`musician` for the musical decisions; it decides and writes no generator file.

## 7. When this is the wrong door

Run the quick door's four questions from
[docs/skills.md](../../../docs/skills.md) against the files `tech-spec.md`
names: five bullets or fewer, at most two of the six modules, nothing frozen in
`docs/music.md` touched, one `git revert` to roll back.

Failing them is a **suggestion**, not a gate. Say which question failed and what
it costs, once, then carry on unless the user moves the work. A waiver goes in
`spec.md` under `## Decided`, in their words.

**Size is not the same question as parallelism here.** §6 gives this door epics,
tracks and waves, so "it needs several agents" is no longer a reason to send the
work to `/create-feature` — a three-track spec runs fine from this folder. What
the chain still buys that this does not:

- **a briefing, a roadmap and a PRD per epic** — three documents of requirements
  and acceptance criteria, written before any spec exists. This door has one
  `## Done when` list.
- **a `/verify-epic` pass per epic**, rather than one verifier run over the whole
  change at the end.
- **a durable record**, because `specs/features/feature-N/` stays and
  `specs/tmp/N-title/` is deleted.

So the honest version of the suggestion is about *uncertainty*, not size: a
change where the requirements are the risky part wants the chain. One where you
know what you want and the work is simply large is fine here.

## 8. Stop

When `tech-spec.md` is settled, stop. Don't write code, don't "just start the
first step".

Report: the folder path, the number, what `## What` says in one line, how many
`## Done when` bullets there are, the files `tech-spec.md` names, the size
test's verdict, and `/implement-vibe-with-docs <N>` as the next command.

## Re-running it

`/vibe-with-docs 4` on an existing folder resumes: read both files, say where
the conversation left off, and carry on from the first thing still open. Don't
re-ask what `## Decided` already answers.

`/vibe-with-docs` bare, with folders in `specs/tmp/`, lists them with their
phase — spec open, tech spec open, ready to build — and asks which.
