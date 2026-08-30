---
name: create-feature
description: Start a new feature — allocate the next `specs/feature-X/` folder (a number for work on the plan, a letter for a prepared candidate), interview the user for the briefing, write `briefing.md` as one-idea-per-bullet, and register it in the right table of `specs/features.md`, retiring the matching candidate row if there is one. Use whenever the user runs `/create-feature`, or asks to start, add, kick off, or scaffold a new feature, briefing, feature folder, or candidate.
argument-hint: [feature-N | feature-X | what the feature is about]
---

# Create feature

Every downstream skill starts from `specs/feature-X/briefing.md` — `/roadmap`
refuses to run without one, and everything after it inherits whatever the
briefing got wrong. This skill produces that file, and nothing else. No roadmap,
no epics, no PRDs.

## 1. Allocate the label

A feature is labelled one of two ways, and `specs/features.md` explains why:

- **`feature-N`**, a number — on the plan. Being built, or committed to.
- **`feature-X`**, a letter — a prepared candidate. It has a briefing and
  nothing else; no commitment to build it. When one is picked up it is renamed
  to the next free number.

**Which one to allocate:**

- The argument names a target — `/create-feature feature-d`, `/create-feature d`,
  `/create-feature feature-6`, `/create-feature 6` → use exactly that. A bare
  letter or number is a target, not briefing content.
- The target is already taken → say so, show what is in it, and stop. Never
  write into an existing feature folder.
- No target named → allocate the next **number**. Committing to the plan is the
  common case, and §4 shows the user the target before anything is written, so a
  wrong guess costs one line to correct.

**Allocating a number:** take the highest existing number plus one. Never fill a
gap. A missing number means a feature was deleted, and reusing it makes old
links, branches and commit messages point at the wrong thing.

**Allocating a letter:** take the first free letter, gaps included. A letter is
a temporary handle that is renamed away on promotion — the repo has already
recycled several — so the permanence argument that governs numbers does not
apply. If every letter through Z is taken, say so rather than inventing a
scheme.

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

Show the bullets in the terminal, **name the folder you are about to create**,
and ask whether to write them or adjust. Cheap, and it catches both a misread
and a wrongly-guessed label before either propagates into a roadmap.

On confirmation, create `specs/feature-X/` and write `briefing.md`.

## 5. Register it in `specs/features.md`

The file holds two tables with the same four columns — `# | Feature | Status |
Summary` — and the label decides which one the row goes in. **Read the file
first**: match its column shape rather than the template here, since the table
may have gained a column since this was written.

**A numbered feature** → the main table, in ascending number order, at
📋 **Planned**:

`| [N](feature-N/) | <short name> | 📋 Planned | <one-sentence summary> |`

**A lettered candidate** → the *Prepared candidates* table, in ascending letter
order, at ✏️ **Briefed**:

`| [X](feature-X/) | <short name> | ✏️ Briefed | <one-sentence summary> |`

Status is set here and never advanced by this skill. `/writespec` moves a
feature to 🛠 Ready to implement and `/implement-feature` to 🔨 In progress or
✅ Done; a briefing is evidence of intent, not of progress.

The name is two or three words. The summary is one sentence describing what a
person can do afterwards that they couldn't before — derived from the briefing,
never longer than a line. The index is scannable or it is useless.

**Then check the auto-generated candidate ideas** at the bottom of the file. If
the new feature is the same idea as one of them, delete that row — it has been
taken up, and leaving it there means the list stops being a list of things
nobody is doing.

Judge by whether the briefing covers what the candidate proposed, not by whether
the wording matches. If a candidate is only partly covered, keep it and narrow
its summary to the part that remains; say so in the report.

**Promoting a lettered candidate to the plan is not this skill's job.** It
already has a briefing, so there is nothing here to write. Renaming the folder
to the next free number and moving its row between the two tables is a separate
edit — say so and stop rather than creating a duplicate under a number.

If `specs/features.md` doesn't exist, create it with both tables and the status
legend.

## 6. Report back

The folder and file created; whether it is a numbered feature or a lettered
candidate, and why that label; the bullets, one line each; which table the row
went into; and any candidate idea removed or narrowed.

Then the next step, which differs by label:

- **Numbered** → point at `/roadmap feature-N`. Don't run it.
- **Lettered** → point at nothing. A candidate is deliberately parked: it has a
  briefing and stops there until someone picks it up, at which point it is
  renamed to the next free number. Suggesting `/roadmap feature-X` would plan
  work nobody has committed to, which is the whole distinction the two labels
  exist to draw.
