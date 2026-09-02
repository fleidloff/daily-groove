# Tech spec — Epic 3: The count stops when the root lands

PRD: [../prd/epic-3-the-count-stops-when-the-root-lands.md](../prd/epic-3-the-count-stops-when-the-root-lands.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

One selector gains one input. `shouldShowNudge` in
`lib/presentation/feedback.ts` already decides the count line from
`eliminatedCount` and `solved`; it takes a third boolean, `rootConfirmed`, and
returns `false` when it is set. `GroovePuzzle` passes
`confirmed.roots.length > 0` from the `confirmedHalves` memo it already computes
for the chip rows (R3). `NudgeBox` and `GuessCard` are untouched — they already
render whatever `showNudge` hands them.

## Contract

```ts
export function shouldShowNudge(
  eliminatedCount: number,
  solved: boolean,
  rootConfirmed: boolean,
): boolean
```

Returns `!solved && !rootConfirmed && eliminatedCount > 0`.

## Track A — Selector and wiring (`implementer`)

- **A1 (red)** — `feedback.test.ts`: `shouldShowNudge(2, false, true)` and
  `(4, false, true)` are `false`. Existing cases gain a `false` third argument.
- **A2 (green)** — Add the parameter; wire `confirmed.roots.length > 0` in
  `GroovePuzzle.tsx`, moving the `confirmed` memo above `showNudge`.
- **A3 (red → green)** — `GroovePuzzle.guessing.test.tsx`: two misses on wrong
  roots show the count; a third guess on the right root removes it and keeps the
  coaching line (AC1); a fourth miss keeps it gone (AC2); a right-root first
  guess followed by a miss never shows it (AC3).
- **A4** — Existing tests that guessed `C` to reach the count line switch to
  wrong roots, so they keep asserting what they asserted (AC4).

## Requirement coverage

| Req | Where |
| :-- | :-- |
| R1 | A1, A3 |
| R2 | A3 |
| R3 | A2 |
| R4 | A3 (coaching line asserted present), A4 |
