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
