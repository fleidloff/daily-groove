---
name: brainstorm
description: Turn a roadmap epic into a simple PRD through repeated question-and-reconcile cycles. Reads `specs/feature-X/roadmap.md`, writes one PRD per epic to `specs/feature-X/prd/`, ends each draft with tickable multiple-choice questions, and on the next run folds the answers into the requirements as direct statements, logs them, and asks again until no high-impact gaps remain. Use whenever the user runs `/brainstorm`, says they've answered a PRD's questions, or asks to write, flesh out, reconcile, or nail down a PRD, spec, or requirements for a feature or epic.
argument-hint: [feature-X] [epic-N]
---

# Brainstorm

Converge a roadmap epic into a PRD precise enough to build from, one
question-and-answer cycle at a time. The document is the workspace: questions
go in at the end, answers come back as requirements, and the cycle repeats
until nothing high-impact is unresolved.

## 1. Resolve the target

- `/brainstorm feature-3` → every epic in `specs/feature-3/`.
- `/brainstorm feature-3 epic-2` → just that epic.
- Bare `/brainstorm` → list the folders under `specs/` and ask which one.

Accept loose input: `3`, `feature 3`, `specs/feature-3` all resolve to
`specs/feature-3`. If it doesn't resolve, show what exists and ask.

## 2. Read the inputs

**`roadmap.md` is required** — it defines the epics. If it's missing, say so and
point the user at `/roadmap <feature>`. Read `briefing.md` too: it carries the
intent behind the roadmap's shorthand, and it's what grounds your
recommendations later.

Read the project's conventions (`AGENTS.md`, `docs/architecture.md`,
`docs/testing.md`) so acceptance criteria match how this repo validates work.

If the roadmap still has unanswered questions of its own, mention it — those
answers likely reshape the PRDs.

## 3. Pick the mode per epic

Decided by whether `specs/<feature>/prd/epic-<N>-*.md` exists:

- **No PRD** → draft one (§5), ending with the first round of questions (§4).
- **PRD with answered questions** → run the reconcile cycle (§6).
- **PRD with nothing answered** → don't rewrite it. Say it's waiting, summarize
  the open questions, and stop.

Never overwrite a PRD wholesale. Reconciling edits it in place, which is what
keeps the log and the user's ticks intact.

## 4. How to ask

Questions live at the end of the PRD under `## Open questions`, so the user
answers them next to the requirements they affect.

Each question gets **up to four options, tickable, exactly one recommended**:

```markdown
### Q3. Can an entry be edited after its day has ended?

- [ ] A) Editable indefinitely *(recommended — the briefing frames this as a low-pressure daily journal, and no epic in the roadmap depends on entries being immutable)*
- [ ] B) Editable for 24 hours, then locked
- [ ] C) Never editable once saved
- [ ] D) Editable, with a visible edit history
```

**Ground the recommendation in the briefing or the roadmap, and say which.** A
recommendation with no evidence behind it is just your preference wearing a
label, and the user can't tell the difference without rereading both documents.
Where briefing and roadmap are genuinely silent, say so and give the
engineering reason instead — that's honest and still useful.

Four real options, not three straw men around the one you want. The user will
write their own when none fit.

**Only ask what's high impact:** a gap is worth a question when getting it wrong
forces a requirement or acceptance criterion to be rewritten. Lower-stakes
unknowns — library choices, naming, file layout, anything you can decide
sensibly — become stated assumptions instead. A PRD with fifteen questions is
abdicating.

Never re-ask something already in the log.

## 5. Drafting a new PRD

One file per epic: `specs/<feature>/prd/epic-<N>-<slug>.md`, slug from the epic
name in the roadmap. Follow
[references/prd-template.md](references/prd-template.md).

Write the whole document even at low confidence — state the assumption you
proceeded under, and let the questions refine it. A concrete draft is far easier
to answer questions against than an empty one.

## 6. The reconcile cycle

This is the heart of the skill. When answers have come back — ticked in the
file, or given in chat:

**a. Fold each answer into the document as a direct statement.** The PRD must
read as decided fact. Never "as answered in Q3" or "the user chose B" — a reader
should not be able to tell which sentences originated as questions.

> Wrong: *Per Q3, entries stay editable.*
> Right: **R7** — An entry remains editable after its day has ended, with no
> time limit.

Land each answer everywhere it belongs. One answer usually touches several
sections: a rule in Requirements, its check in Acceptance criteria, sometimes a
line in Out of scope or a behaviour detail. Amend anything the answer
contradicts, including earlier requirements, and say plainly what changed.

**b. Remove the answered questions from `Open questions` and append them to
`## Question log`,** grouped under the cycle that produced them. The log is
append-only — never rewrite or prune past cycles. It records the question, the
chosen answer, a one-line reason, and which requirements it produced, so a
reader six weeks out can see how a requirement got there without the reasoning
cluttering the requirement itself.

**c. Re-assess and ask again.** Answers routinely open new gaps — that's the
cycle working, not a failure. Add any new high-impact questions as the next
cycle's round in `Open questions`.

**d. Stop when no high-impact gaps remain.** Delete the now-empty `Open
questions` section, record any remaining low-stakes unknowns under
`Assumptions`, and tell the user the PRD is settled.

**Edge cases.** Some questions ticked and others not → apply what's answered,
leave the rest in place. The user wrote their own answer instead of ticking →
that's the answer. Two options ticked → take both if they're compatible and note
it; otherwise ask which. An answer contradicts an earlier logged decision →
surface the conflict rather than silently preferring the newer one.

## 7. Keep the feature index current

`specs/features.md` holds one table row per feature with a single-sentence
summary. A reconcile cycle can change what the feature *is* — an answer that
cuts a capability, adds one, or redefines the core interaction.

After folding answers in, reread the feature's row:

- Still true → leave it. Most cycles change detail, not identity, and churning
  the index for every PRD edit makes it useless as a change signal.
- No longer true → rewrite the summary to match the settled PRDs.
- Row missing entirely → add one, in feature-number order:
  `| [N](feature-N/) | <short name> | <one-sentence summary> |`

Never expand the row into epic-level detail; the index stays one line per
feature.

## 8. Diagram only where it helps

A diagram earns its place when it shows something prose states clumsily — a
branching flow, a lifecycle, a multi-actor exchange, a set of relations. One
that restates a bulleted list is noise that now needs maintaining. Most simple
PRDs need zero or one. See [references/uml.md](references/uml.md) for choosing a
type and the Mermaid syntax.

## 9. Report back

Per epic: the file written or updated, the answers folded in and where they
landed, anything an answer contradicted and how you resolved it, and the count
of questions now open — or that the PRD is settled. Mention the
`specs/features.md` row only if you changed it.
