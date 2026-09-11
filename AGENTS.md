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
questions before moving on is the cheaper order, and the quick door
(`/quick-feature` → `/implement-quick-feature`), the one-ticket path for a
change too small to be worth all five:
@docs/skills.md

## Comments

**Code should explain itself, so avoid comments.** Don't narrate the code or the
change you just made. Leave a comment only for something genuinely non-obvious
(a workaround, a platform quirk, a ticket reference). Never write prose in a
comment.

## The terminal title is yours to write

`.claude/settings.json` sets `CLAUDE_CODE_DISABLE_TERMINAL_TITLE`, so Claude
Code writes no title of its own in this repo. Its hooks own the glyph and you
supply the words after it. Three states, and the hooks tell them apart without
being asked:

| Glyph | State | What writes it |
| :-- | :-- | :-- |
| `◐` | a turn is running | `UserPromptSubmit`, and every `--agent-start` |
| `✳` | blocked on you — a permission prompt, or an idle nudge | `Notification` |
| `✔` | the turn finished and needs nothing from the terminal | `Stop` |

`✔` survives the idle nudge that follows it, so a finished turn does not decay
into `✳` a minute later. The next prompt clears it. **`✔` means it is safe to
close the tab.** A question still unticked in a spec does not change the glyph:
that is the file's move, not the terminal's, and it waits.

A dispatched agent counts as running. `PreToolUse` on the agent tool and
`SubagentStop` keep a token per live agent under `~/.claude/title-state/`, so a
turn that ends while its agents are still working keeps `◐`, remembers which end
state it owed, and pays it — `✔` or `✳` — when the last one reports back.

```bash
.claude/scripts/title.sh "F8) writing GrooveHeader tests"
.claude/scripts/title.sh "Q4) moving StreakBadge"
.claude/scripts/title.sh "reading the lint zones"
```

- Whenever you know which feature, quick ticket or vibed change the session is
  on, its number goes first: `F<N>)` for `specs/features/feature-N/`, `Q<N>)`
  for `specs/quick/N-slug.md`, `V<N>)` for `specs/tmp/N-title/`. A candidate
  keeps its letter — `FA)`.
- Set it as soon as the number is known — the skill's argument (`/brainstorm
  feature-8`), the ticket you just allocated, the spec folder you are reading —
  and keep the prefix on every title after that until the session moves on.
- No number in play, and the title is still the task: three to five words, what
  you are doing now.
- **In doubt, write `claude`.** A tab that says `claude` and carries the right
  glyph is honest; three invented words about work you are not sure you are
  doing are not. It is also the fallback the script paints when nothing has been
  set — a fresh session reads `✳ claude`, never the folder name.
- The text sticks until you replace it, so replace it when the task changes.
  Nothing else will.
- Applies to every step of the chain in [docs/skills.md](docs/skills.md), and to
  `/quick-feature`, `/implement-quick-feature`, `/vibe-with-docs`,
  `/implement-vibe-with-docs`, `/verify-epic` and `/prototype`.
- **Only the main session sets it.** Dispatched agents never do; several of them
  run at once and would overwrite each other.

## Nothing is committed until the row says Done

**Never run `git commit`, `git add`, `git push`, or create a branch or stash on
your own initiative.** Every change stays in the working tree so it can be read
as one diff.

The one thing that changes that is the **Status** column in
[specs/features.md](specs/features.md) — or, for a vibed change, the presence of
its row in *Vibed changes* at all. A feature or a quick ticket is committed
only once its row reads ✅ **Done** — and the row reaches ✅ only when every
acceptance criterion is verified, not when the work feels finished. So the order
is always: build → verify → mark the row → *then* the commit is the user's to
ask for.

- **A row at 🔨 In progress means do not commit**, however green the suite is.
- **`/implement-feature` never commits**, and its §0 says so; this generalises
  that rule to every path, including `/implement-quick-feature`,
  `/implement-vibe-with-docs`, a fix made by hand, and anything an agent did.
- **Getting to ✅ is work, not paperwork.** An acceptance criterion graded
  *partly* keeps the row off ✅, so closing it — writing the missing test,
  committing an assertion that only lived in scratch — is what unblocks the
  commit. Say what is standing in the way rather than asking to commit anyway.
- **A vibed change has one more thing to finish**, and it is not paperwork
  either: `/implement-vibe-with-docs` §8 writes the ADRs and updates the
  documents the change made untrue *before* it deletes
  `specs/tmp/N-title/`. The archive row and the ADRs are all that survives the
  deletion, so skipping that step loses the reasoning rather than deferring
  it.
- If a commit is genuinely needed mid-flight to make progress, **stop and ask**.

## Why the app is like this

**[docs/adr/adrs.md](docs/adr/adrs.md)** — one architecture decision record per
decision that would be expensive to reverse, oldest first: browser-only
progress, pre-rendered MP3s, a listening sign-off as the bar for how a groove
sounds, what is frozen and what may always re-render, the six modules, the
narrowing hint, one string table. Superseded ones are kept, so the chain that
got to today is readable — four decisions have already been replaced by a later
number.

Read it when you are about to change something the app has settled, or when a
constraint makes no sense and you want to know what it is holding up. **A new
record is the answer only for a decision the code cannot state itself** — the
import graph lives in [docs/architecture.md](docs/architecture.md), the rules in
[docs/coding-guidelines.md](docs/coding-guidelines.md), and the musical model in
[docs/music.md](docs/music.md). Copy `docs/adr/0000-template.md`, take the next
four-digit number, and add the row to `adrs.md`. Linked rather than
`@`-imported, for the same reason as the document below.

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
and `.claude/agents/` defines the six roles they draw from — `architect`,
`implementer`, `test-writer`, `verifier`, `musician`, `sam`. A tech spec's tracks
declare a role each for exactly that reason.

The quick door builds in the lead and dispatches once, at the end:
`/implement-quick-feature` gates itself with the `verifier`, which grades the
ticket's `## Done when` bullets in place of a PRD's acceptance criteria. That
one dispatch buys the property the lead cannot have — a reader that grades but
cannot fix. Fanning the *build* out over a two-file change buys nothing, and
costs the one view of the whole change that catches a ticket which is no longer
small.

The third door dispatches like the chain, having decided like the quick one.
`/vibe-with-docs` writes no code and dispatches only `sam`, for a question that
turns on the player — but its `tech-spec.md` declares tracks, roles and waves,
so `/implement-vibe-with-docs` fans a worker out per track exactly as
`/implement-feature` does, and builds in the lead only when the spec is a single
track. Either way the same `verifier` gates it, graded against `spec.md`'s
`## Done when` bullets.

`sam` is the odd one out, because it builds nothing. It *is* the player in
[docs/persona.md](docs/persona.md), and `/roadmap`, `/brainstorm`, `/prototype`
`/create-feature-for-persona` and `/vibe-with-docs` dispatch it whenever a
decision turns on what
that player would do rather than on what the code needs. The answer comes back
in first person, quoting the line of the persona it rests on, so a product call
is made in the player's voice instead of by whoever is holding the keyboard —
and it answers "no persona bearing" for the questions that aren't its business.

**Running those skills is standing permission to dispatch the agents they
name.** Don't stop to ask. The parallelism is the design: the epics of a feature
own disjoint files so they can be built at once, and a session that runs them
one at a time is slower for no gain in safety — every agent's output still
arrives as a spec or a diff to review before anything is merged.

This is permission for the skills' own agents, not a general licence: spawning a
swarm for a question that one search would answer is still worse than searching.
And it says nothing about `/loop`, workflows or deep research — those stay
opt-in per request.
