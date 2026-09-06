---
name: quick-feature
description: Analyze a one-page quick ticket in `specs/quick/N-slug.md` — run the size test, write `## Notes` naming the files it will touch and the assumptions taken, and ask anything blocking as tickable options inside the ticket, folding the answers in on each re-run until nothing is open. Writes no code; `/implement-quick-feature N` builds it. Escalates to `/create-feature` the moment it stops being small. Use whenever the user runs `/quick-feature`, asks to analyze or scope a quick ticket, says they've answered a ticket's questions, or describes a small change that needs thinking through before it is built.
argument-hint: [what to change | N]
---

# Quick — analyze

One ticket, one change, no chain. `/create-feature` → `/roadmap` →
`/brainstorm` → `/writespec` → `/implement-feature` buys insurance against
building the wrong thing, and for a change you can describe in five bullets that
insurance costs more than the accident it prevents.

**This skill is the thinking half of that door.** It reads the ticket against
the tree, decides whether the change is still small, names the files before any
code exists, and turns everything that would change the work into a question the
user can tick. `/implement-quick-feature N` is the other half.

## 0. Never commit, never build

No `git add`, no `git commit`, no branch, no stash.

And **no source edits.** This skill writes exactly one file: the ticket. Not a
test, not a one-line fix that "was obviously it", not a spike you meant to
revert. The point of two runs is that the user reads the notes while the change
is still free to be wrong; a diff sitting in the tree removes that. If the
analysis is only settled by opening a file, open it and read it — reading is the
job, writing is not.

## 1. Resolve the phase

| Invocation | Ticket state | Phase |
| :-- | :-- | :-- |
| `/quick-feature 7` | `## What` and `## Done when` written by hand, no `## Notes` yet | **Analyze** — write `## Notes` and `## Open questions`, then stop (§4, §5). |
| `/quick-feature 7` | questions ticked | **Reconcile** — fold the answers in and ask what they opened up (§6). |
| `/quick-feature 7` | questions unticked | Say what is open, stop. |
| `/quick-feature 7` | analyzed, nothing open | Say it is ready and point at `/implement-quick-feature 7`. Don't re-analyze. |
| `/quick-feature <prose>` | none yet | **Draft** the whole ticket from the prose, then analyze it in the same run. |
| bare `/quick-feature` | — | List `specs/quick/` with each ticket's status and ask which. |

**The hand-written ticket is the normal way in.** The user opens
`specs/quick/N-slug.md`, writes `## What` and `## Done when`, and runs
`/quick-feature N`. Analysis and build are separate runs on purpose: the notes
name the files before any code exists, which is the cheapest moment to catch a
wrong module.

Repeat until settled, the way `/brainstorm` does:

```
/quick-feature 7  →  tick the answers  →  /quick-feature 7  →  … until nothing is open  →  /implement-quick-feature 7
```

## 2. The size test

Every phase starts here, and §6 re-runs it — an answer can make a ticket stop
being small.

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

The verdict goes in `## Notes` in every run, including the runs where it passes.
It is what `/implement-quick-feature` re-checks against the files it actually
opens.

## 3. Allocate the number

`specs/quick/N-slug.md` — a plain number, no padding, highest existing plus one,
never filling a gap. The slug is the title in kebab-case. Create `specs/quick/`
if it isn't there.

Only the draft phase allocates here. `/create-quick-feature` and `/roadmap` §3
allocate too — the first from an interview, the second when it moves a one-epic
briefing to this path; both write `## What` and `## Done when` only, so their
tickets enter the table above as hand-written ones. A hand-written ticket
already has its number, and if the user picked one that collides or fills a gap,
say so and let them rename it — don't move their file.

## 4. Who writes which section

```markdown
# N — Title

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

So **do not rewrite either of the first two sections.** Not to tighten the
wording, not to split a bullet, not to add the thing they obviously forgot. If a
`## What` bullet is ambiguous it becomes a question (§5); if a `## Done when`
bullet can't be settled by a test or by looking at the page, say so in the
report and let the user fix it. Editing intent in place is how a ticket quietly
becomes yours, and the user has no way to see it happened.

The draft phase (`/quick-feature <prose>`) writes all four sections, because
there is no hand-written ticket to preserve — but the first two still follow
`/create-feature` §3: the user's framing and their level of detail, not yours.
Show the draft and let them adjust.

**`## Notes` names the expected files before any code exists.** It is the
cheapest way for the user to spot a wrong module while the change is still one
line to correct, and it is what §2's second question is checked against. It also
carries every assumption you took rather than asked, and the size-test verdict.

Notes worth writing, beyond the file list: the test that already covers this and
would have to change, the lint zone or structure test the change has to clear,
and anything in the tree that contradicts a `## What` bullet. Name the file each
time, so the user can check the claim rather than believe it.

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

Say what each option costs where it differs — the module it drags in, the test
it breaks, the size-test question it fails. An option that fails §2 is worth
listing with that consequence written into it rather than silently dropped; the
user decides whether the ticket moves to `/create-feature`.

## 6. The answer cycle

On a re-run with answers ticked:

- **Fold them in as decisions, not as new intent.** Append an
  `## Answered — Q1-B, Q2-A` section recording what was ticked and what follows
  from it. `## What` and `## Done when` still don't move.
- **Re-run §2 against the answer.** An option can pull in a third module, and
  the run where that becomes true is this one. Say it plainly and point at
  `/create-feature`; if the user waives it, record the waiver and their words in
  the ticket.
- **Update `## Notes`** — the file list, the assumptions and the verdict now all
  read against the chosen option, not against the recommendation.
- **Ask the follow-ups the answer opened**, under the same ceiling of two. An
  answer that opens nothing means the ticket is settled; say so rather than
  inventing a round.

Rewrite an answered question's options only to mark it answered — never to
change what was on offer after the fact.

## 7. Agents

None for the mechanics. The analysis is one session reading a handful of files,
and a dispatched agent would need the ticket re-explained to it to save nothing.

Two exceptions, both about judgement rather than work:

- **`sam`**, when a question turns on what the player would do rather than on
  what the code needs — the same use `/brainstorm` and `/roadmap` make of it.
  The answer comes back in first person and grounds the recommendation.
- **`musician`**, when a question about `scripts/grooves/` is musical.
  `docs/music.md` is deliberately not loaded into a normal session, so that
  judgement is exactly the part a session that hasn't read it gets wrong. Note
  that most generator tickets fail §2's third question anyway and belong in a
  feature.

Neither writes a file. The ticket stays yours.

## 8. Register it in `specs/features.md`

Two edits, both in that file.

**The Quick changes table** — the third table, after *Prepared candidates* and
before the candidate ideas list. Create it with its own heading and legend if it
isn't there yet. Columns `# | Change | Status | Summary`:

`| [7](quick/7-slug.md) | <short name> | 📝 Drafted | <one-sentence summary> |`

Status runs 📝 **Drafted** → ❓ **Questions open** → 🛠 **Ready to build** →
✅ **Done**. This skill moves a row to ❓ when it leaves questions open and to 🛠
when the analysis settles with none. **It never writes ✅** — that is
`/implement-quick-feature` §7, after the checks come back green.

**The candidate ideas list at the bottom** — if this ticket takes up one of
those ideas, delete its row, exactly as `/create-feature` §5 does. Judge by
whether the ticket covers what the idea proposed, not by the wording. Partly
covered → keep the row and narrow it to what remains, and say so in the report.

## 9. Report

The ticket path; the size test's verdict; the files the change is expected to
touch, one line each; the questions you asked or the answers you folded in; and
the row you wrote or moved.

Then the next step, and only one of them:

- questions open → point at the ticket, and at `/quick-feature N` again once
  they are ticked.
- size test failed → point at `/create-feature`.
- settled → point at `/implement-quick-feature N`. Don't run it.
