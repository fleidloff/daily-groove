<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project guidelines

Read all three before writing code.

Architecture — feature slices, the design system, and keeping every feature removable:
@docs/architecture.md

Testing — what must be tested, and where the tests live:
@docs/testing.md

How a feature gets built — the five skills and the one order they run in
(`/create-feature` → `/roadmap` → `/brainstorm` → `/writespec` →
`/implement-feature`), what each reads and writes, why answering a document's
questions before moving on is the cheaper order, and `/quick-feature`, the one-ticket
path for a change too small to be worth all five:
@docs/skills.md

## Comments

**Code should explain itself, so avoid comments.** Don't narrate the code or the
change you just made. Leave a comment only for something genuinely non-obvious
(a workaround, a platform quirk, a ticket reference). Never write prose in a
comment.

## Changing what the grooves sound like

**[docs/music.md](docs/music.md)** — the musical model of the generator under
`scripts/grooves/`: the twelve scales and the three rules a new one must satisfy,
how a chord is derived from a scale, the six feels and every parameter they
declare, the rhythm pools and fixed placements, bass and comp voicing, what turns
a grid into a performance, the quality gate's seven thresholds, and the four things
that must never change because altering them re-renders the catalogue and
reassigns every past puzzle.

Read it when you touch `scripts/grooves/`, and not otherwise — it is a reference
for musical decisions, not a rule every change has to clear. It is linked rather
than `@`-imported for that reason: the three documents above load into every
session, and this one should load only when it is the subject.

## The skills may dispatch their own agents

Four of the five skills in [docs/skills.md](docs/skills.md) are built around
agents rather than around one assistant doing the work in sequence:
`/writespec` hands each PRD to an `architect`, `/implement-feature` fans out a
worker per unit and runs `/verify-epic`'s `verifier` at the end of every epic,
and `.claude/agents/` defines the five roles they draw from — `architect`,
`implementer`, `test-writer`, `verifier`, `musician`. A tech spec's tracks
declare a role each for exactly that reason.

**Running those skills is standing permission to dispatch the agents they
name.** Don't stop to ask. The parallelism is the design: the epics of a feature
own disjoint files so they can be built at once, and a session that runs them
one at a time is slower for no gain in safety — every agent's output still
arrives as a spec or a diff to review before anything is merged.

This is permission for the skills' own agents, not a general licence: spawning a
swarm for a question that one search would answer is still worse than searching.
And it says nothing about `/loop`, workflows or deep research — those stay
opt-in per request.
