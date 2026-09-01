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
`/implement-feature`), what each reads and writes, and why answering a
document's questions before moving on is the cheaper order:
@docs/skills.md

## Changing what the grooves sound like

**[docs/music.md](docs/music.md)** — the musical model of the generator under
`scripts/grooves/`: the twelve scales and the three rules a new one must satisfy,
how a chord is derived from a scale, the six feels and every parameter they
declare, the rhythm pools and fixed placements, bass and comp voicing, what turns
a grid into a performance, the quality gate's six thresholds, and the four things
that must never change because altering them re-renders the catalogue and
reassigns every past puzzle.

Read it when you touch `scripts/grooves/`, and not otherwise — it is a reference
for musical decisions, not a rule every change has to clear. It is linked rather
than `@`-imported for that reason: the three documents above load into every
session, and this one should load only when it is the subject.
