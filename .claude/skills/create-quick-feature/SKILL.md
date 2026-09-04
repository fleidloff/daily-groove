---
name: create-quick-feature
description: Start a quick change — allocate the next `specs/quick/NNN-slug.md` ticket, interview the user for what changes and what done means, write only the `## What` and `## Done when` sections as one-idea-per-bullet, and register the row in the Quick changes table of `specs/features.md`. Runs no analysis and no build; `/quick-feature NNN` does that. Use whenever the user runs `/create-quick-feature`, or asks to open, write, add or scaffold a quick ticket without building it yet.
argument-hint: [NNN | what the change is about]
---

# Create quick feature

`/quick-feature NNN` expects a hand-written ticket — `## What` and `## Done
when`, nothing else — and fills in the rest itself. This skill writes that
ticket, and nothing else. No `## Notes`, no `## Open questions`, no size test,
no code. It is to `/quick-feature` what `/create-feature` is to `/roadmap`: the
user's intent, recorded before anyone reads the tree against it.

## 1. Allocate the number

`specs/quick/NNN-slug.md` — three digits, highest existing plus one, never
filling a gap. A missing number means a ticket was deleted, and reusing it makes
old links and commit messages point at the wrong thing. Create `specs/quick/` if
it isn't there.

- The argument is a bare number — `/create-quick-feature 007`,
  `/create-quick-feature 7` → use exactly that, zero-padded. A bare number is a
  target, not ticket content.
- The target is already taken → say so, show what is in it, and stop. Never
  write into an existing ticket.
- The target fills a gap → say so and use the next free number instead, unless
  the user insists.
- No target named → next free number.

The slug is the title in kebab-case. Don't create the file yet — the interview
may not finish.

## 2. Get the content

**Invoked with prose** (`/create-quick-feature hide the bpm on mobile`) → that's
the seed. Ask only what's still missing, which is usually the done-when.

**Invoked bare** → ask what the change is.

Ask in the terminal, in plain prose, as one open question covering both halves:
what should change, and how would you tell it's done? Then stop and wait. Don't
use a multiple-choice prompt to collect the content — the ticket is the user's
framing, and options you invented would replace it with yours.

If the answer is thin but coherent, write it. `specs/quick/001-*.md` runs to
seven `## What` bullets and four `## Done when` bullets, and most tickets will
be shorter. If it's genuinely ambiguous what is being changed, ask one
follow-up, not a list.

**One thing to notice, not to test.** The size test is `/quick-feature` §2's
job, with the files open. But if the answer is plainly a feature — several
screens, a new mode of play, anything under `scripts/grooves/` that re-renders
the catalogue — say so before writing anything and point at `/create-feature`.
A ticket that will fail the size test on its first run is a ticket nobody
needed.

## 3. Write the bullets

Match the house style — read `specs/quick/*.md` before writing: `*` bullets,
short fragments, no prose paragraphs, no preamble.

**`## What` — one core idea per bullet.** Split a sentence when it joins two
things that could be decided separately; keep a qualifier attached when it only
pins down the same idea. Same rule as `/create-feature` §3.

**`## Done when` — bullets a test or a look at the page can settle.** "Solving a
puzzle shows X", "the line renders nothing when Y", "`foo.test.ts` covers Z".
Not "it works" and not "it feels right". If the user gave no done-when, derive
it from their own `## What` bullets — one observable outcome per bullet — and
show it as derived so they can strike it. If a bullet can't be settled by a
test or by looking at the page, say so rather than writing it.

**Write down what the user said, not what you'd have said.** Keep their words
and their level of detail. Do not add scope they didn't mention, do not resolve
ambiguity they left open — `/quick-feature`'s analyze phase turns exactly that
into `## Open questions`, and an invented bullet arrives looking like a decision
the user made.

Constraints and "we already decided X" belong in `## What` as their own
bullets.

## 4. Confirm, then write

Show both sections in the terminal, **name the path you are about to create**,
and ask whether to write them or adjust. Cheap, and it catches a misread before
it becomes a wrong `## Notes`.

On confirmation, write the ticket:

```markdown
# NNN — Title

## What

* one idea per bullet

## Done when

* bullets a test or a look at the page can settle
```

Only those two sections. `## Open questions` and `## Notes` are
`/quick-feature`'s, written on its analyze run; adding empty ones here makes the
ticket look analyzed when it isn't.

## 5. Register it in `specs/features.md`

The Quick changes table — third table, after *Prepared candidates* and before
the candidate ideas list, columns `# | Change | Status | Summary`. **Read the
file first** and match its column shape. Create the table with its heading and
legend if it isn't there yet, as `/quick-feature` §10 describes.

Add the row in ascending number order, at 📝 **Drafted**:

`| [NNN](quick/NNN-slug.md) | <short name> | 📝 Drafted | <one-sentence summary> |`

Status is set here and never advanced by this skill. `/quick-feature` moves it
to ❓ Questions open or ✅ Done.

The name is two or three words. The summary is one sentence describing what a
person can do or see afterwards that they couldn't before — derived from the
ticket, never longer than a line.

**Then check the candidate ideas** at the bottom of the file. If the ticket is
the same idea as one of them, delete that row. Judge by whether the ticket
covers what the idea proposed, not by the wording. Partly covered → keep the row
and narrow its summary to what remains, and say so in the report.

## 6. Report back

The ticket path; the bullets, one line each; the row written; any candidate
idea removed or narrowed. Then the next step: `/quick-feature NNN`, which
analyzes the ticket and asks anything blocking inside it. Don't run it.
