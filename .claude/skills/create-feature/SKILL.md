---
name: create-feature
description: Start a new feature — allocate the next `specs/feature-N/` folder, interview the user for the briefing, write `briefing.md` as one-idea-per-bullet, and register the feature in `specs/features.md`, retiring the matching candidate row if there is one. Use whenever the user runs `/create-feature`, or asks to start, add, kick off, or scaffold a new feature, briefing, or feature folder.
argument-hint: [what the feature is about]
---

# Create feature

Every downstream skill starts from `specs/feature-N/briefing.md` — `/roadmap`
refuses to run without one, and everything after it inherits whatever the
briefing got wrong. This skill produces that file, and nothing else. No roadmap,
no epics, no PRDs.

## 1. Allocate the number

List `specs/feature-*/` and take **the highest existing number plus one**. Never
fill a gap: a missing number means a feature was deleted, and reusing it makes
old links, branches and commit messages point at the wrong thing.

Don't create the folder yet. An empty `feature-8/` left behind by an abandoned
run is worse than no folder, and the interview may not finish.

## 2. Get the briefing content

**Invoked with arguments** (`/create-feature dark mode toggle`) → that's the
seed. Ask only what's still missing.

**Invoked bare** → ask what the feature is.

Ask in the terminal, in plain prose, as one open question. Don't use a
multiple-choice prompt to collect the content itself — the briefing is the
user's own framing of the problem, and options you invented would replace it
with yours. Multiple choice is fine later for a genuine fork you can't resolve.

Ask once, in one message. Something like: what should this feature do, and is
there anything that's explicitly out of scope or already decided? Then stop and
wait. A briefing is a handful of bullets; an interrogation to fill it is
disproportionate and the user will tell you what matters unprompted.

If the answer is thin but coherent, that's fine — write it. Existing briefings
in this repo run to four or five lines. If it's genuinely ambiguous about what
is being built, ask one follow-up, not a list.

## 3. Write the bullets

Match the house style — look at `specs/feature-*/briefing.md` before writing:
`*` bullets, short fragments, imperative, no headings, no prose paragraphs, no
preamble.

**One core idea per bullet.** Split a sentence when it joins two things that
could be decided separately:

> "remove the bpm number and make the play button larger"
> → two bullets.

A qualifier that only exists to pin down the same idea stays attached:

> "add light / dark mode toggle (that is also persisted)"
> → one bullet — persistence is part of the toggle, not a separate decision.

**Write down what the user said, not what you'd have said.** A briefing is
intent, not specification. Keep their words and their level of detail. Do not
add scope they didn't mention, do not resolve ambiguity they left open — the
`/roadmap` and `/brainstorm` cycles exist to ask about exactly that, and an
invented bullet arrives looking like a decision the user made.

Constraints, non-goals and "we already decided X" belong in the list as their
own bullets — they are the most valuable lines in the file.

## 4. Confirm, then write

Show the bullets in the terminal and ask whether to write them or adjust.
Cheap, and it catches a misread before it propagates into a roadmap.

On confirmation, create `specs/feature-N/` and write `briefing.md`.

## 5. Register it in `specs/features.md`

Add a row to the main table, in feature-number order:

`| [N](feature-N/) | <short name> | <one-sentence summary> |`

The name is two or three words. The summary is one sentence describing what a
person can do afterwards that they couldn't before — derived from the briefing,
never longer than a line. The index is scannable or it is useless.

**Then check the candidate section.** If the new feature is the same idea as one
of the auto-generated candidates, delete that candidate row — it has been
promoted, and leaving it there means the list stops being a list of things not
yet being done.

Judge by whether the briefing covers what the candidate proposed, not by whether
the wording matches. If a candidate is only partly covered, keep it and narrow
its summary to the part that remains; say so in the report.

If `specs/features.md` doesn't exist, create it with the main table only.

## 6. Report back

The folder and file created, the bullets in one line each, the row added, and
any candidate removed or narrowed. Point at `/roadmap feature-N` as the next
step — but don't run it.
