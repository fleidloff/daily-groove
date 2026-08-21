# Technical specification template

Copy this structure. `Contracts`, `Tracks`, and `Implementation` carry the
weight — they're what makes the work parallelizable and executable. Drop
anything that would be filler for the epic at hand.

`Decision log` and `Open questions` are maintained by the reconcile cycle. Keep
them last, in that order.

---

# Tech spec — Epic <N>: <epic name>

PRD: [../prd/epic-<N>-<slug>.md](../prd/epic-<N>-<slug>.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Three to five sentences on the shape of the implementation: the pieces, how they
fit, and why this way. Enough for a reviewer to disagree with the design before
reading 40 steps built on it.

## Architecture

The resulting design, as settled fact — including decisions that came from
answered questions. A diagram if one earns its place; skip it if prose is
clearer.

## Contracts

Frozen interfaces shared across tracks. These exist so tracks don't wait on each
other: a track builds against the contract while another implements behind it.
Changing one mid-flight breaks parallel work, so get them right here.

```ts
// src/features/<feature>/types.ts
export type Entry = {
  id: string
  day: string   // ISO date
  note: string
}
```

- `POST /api/entries` → `201 { id }` · `422 { error }`
- `getEntries(userId): Promise<Entry[]>`

## Tracks

### Track A — <name>

- **Goal** — what exists when this track is done.
- **Owns** — `src/features/<feature>/lib/**` (no other track writes here)
- **Depends on** — the `Entry` contract only
- **Parallel with** — Track B
- **Done when** — its own tests pass, without B or C existing.

### Track B — <name>

...

## Execution waves

- **Wave 1 (parallel):** Track A, Track B
- **Wave 2:** Track C — needs A's route registered
- **Wave 3:** Integration

## Implementation

Steps grouped by track, each one red-green-refactor and traceable to the PRD.

### Track A — <name>

#### Step A1 — <behaviour in plain words>

Covers: R1, AC1

- **Test first** — `<exact test path>`: assert <exact assertion>. Run it: fails
  with <expected failure message>.
- **Implement** — `<exact source path>`: <exact function/type and what it does>.
- **Green when** — <the assertion passes>, suite stays green.
- **Refactor** — <what to clean, or "none">.

#### Step A2 — ...

### Track B — <name>

...

## Integration and verification

The step where tracks meet, and how the epic is proven end to end:

- Wire-up steps, in TDD form like the rest.
- The demo path from the PRD, run manually: click here, see this.
- Full suite green; coverage of every R and AC accounted for.

## Requirement coverage

A quick table so nothing is silently skipped.

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, A2 |
| R2 | B1 |
| AC1 | A1 |

## Assumptions

Lower-stakes technical calls made without asking, so a reviewer can challenge
them. Anything here that turns out to be expensive to reverse becomes a question
next cycle.

## Decision log

Settled architectural decisions. The sections above are the source of truth —
this records how they got there, and what each one cost. Append-only: never
rewrite or prune a past cycle.

### Cycle 1 — <YYYY-MM-DD>

**Q1. Where do entries persist?**
Decision: **A) Postgres via Prisma** — Epic 3 needs a server-side store for
sharing, and switching later would rewrite every data access path.
Changed: Contracts (`getEntries` is now async), Track A steps A1–A4, new Step A0
for the schema migration.

## Open questions

The current round. Tick one option per question (`- [x]`), or write your own,
then re-run `/writespec <feature> <epic>` — the answer gets applied to the
design and steps, moved into the log, and replaced by whatever it opens up.

Remove this section once every major decision is settled.

### Q2. <question>

- [ ] A) <option> *(recommended — <grounding in the PRD, roadmap, or repo conventions; and what reversing it would cost>)*
- [ ] B) <option>
- [ ] C) <option>
- [ ] D) <option>
