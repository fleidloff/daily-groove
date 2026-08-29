# Tech spec — Epic 4: One command adds grooves, and the build won't ship a broken one

PRD: [../prd/epic-4-one-command-adds-grooves.md](../prd/epic-4-one-command-adds-grooves.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Two commands and one file. `npm run grooves:add <n>` continues Epic 3's seed search from
where the catalogue left off, renders each candidate, puts it through a gate of
automated checks, and keeps only the ones that pass — writing the audio, the manifest
entry and a checksum. `npm run grooves:verify` reads the committed checksums and the
committed audio and compares them, with no ffmpeg and no sample pack in sight, and runs
as `prebuild`.

The gate is where this epic's real work is. It is four checks over an already-rendered
buffer, three of which already exist as assertions in Epics 2 and 3 — this epic lifts
them out of the test suite and into the pipeline, so they run on every groove ever
minted rather than only on the ones someone wrote a test for.

## Architecture

- **Minting reuses Epic 3's search.** `grooves:add` calls `selectSeeds(templates, {
  perTemplate, startSeed, existing })` with the committed catalogue as `existing`. There
  is one definition of an acceptable groove, and the initial sixteen and the ten-thousandth
  addition pass the same one.
- **The starting seed comes from the clock.** `addGrooves` derives `startSeed` from
  `Date.now()`, so two people minting against the same catalogue on the same day get
  *different* grooves and both sets can be kept — a merge brings in six grooves rather
  than a conflict over three. This is the one place in the whole pipeline that is not
  reproducible, and it is deliberately narrow: the chosen seed is written into
  `catalogue.json`, and from that moment the groove renders identically forever. Tests
  pass an explicit `startSeed` so they stay deterministic.
- **The gate runs after render, before write.** A candidate is rendered fully in memory,
  checked, and only then written to disk. A rejected candidate leaves no trace — no
  orphan mp3, no half-written manifest.
- **Checksums are the guard's evidence, for all three artifacts.** `grooves.lock.json`
  holds a `sha256` per groove *and* one for the generated manifest *and* one for
  `catalogue.json`, all written by the same run. The guard compares each against the file
  on disk. It never re-renders, so it needs no ffmpeg, no sample pack, and no audio code
  at all — which is what lets it run on any CI machine.
- **Why the catalogue is hashed too.** Hashing only the manifest catches a hand-edited
  manifest, but not the staleness case that matters most: someone appends to
  `catalogue.json`, forgets to regenerate, and commits. Manifest and lock still agree
  with each other, so the guard would pass while the two files disagree. Recording the
  catalogue's hash closes that, and still costs nothing but `crypto`.
- **The manifest is output, never input.** `catalogue.json` is the input;
  `grooves.generated.ts`, the mp3s and `grooves.lock.json` are outputs. The guard's job
  is to prove the outputs still match what the inputs produced.
- **The freeze is a rule about time, not a flag in a file.** From the merge of this
  feature's last epic — Epic 3, which lands after this one under the serialized wave
  order — a groove's id, audio and answers do not change. Until then the catalogue is
  re-rendered freely. What this epic enforces mechanically is the narrower guarantee
  that *minting* never disturbs an existing entry, and that is testable today.

## Contracts

No changes to Epic 1's frozen types. Three additions:

```ts
// scripts/grooves/gate.ts
export type GateFailure = { check: string; detail: string }
export function gateCandidate(args: {
  pcm: Pcm
  events: NoteEvent[]
  music: MusicMeta
  template: FeelTemplate
}): GateFailure | null          // null = passed

// scripts/grooves/lock.ts
export type LockEntry = { id: string; sha256: string; bytes: number }
export type Lock = {
  catalogueSha256: string
  manifestSha256: string
  grooves: LockEntry[]
}
export function readLock(path: string): Lock | null
export function writeLock(lock: Lock, path: string): void
export function verifyLock(
  lock: Lock,
  paths: { grooveDir: string; cataloguePath: string; manifestPath: string },
): GateFailure[]

// scripts/grooves/add.ts
export function addGrooves(
  n: number,
  opts?: { maxAttempts?: number; startSeed?: number },   // startSeed defaults to Date.now()
): GrooveSpec[]
```

```
scripts/grooves/grooves.lock.json      committed, one entry per groove
package.json:
  "grooves:add":    "node scripts/grooves/add-cli.ts"
  "grooves:verify": "node scripts/grooves/verify-cli.ts"
  "prebuild":       "npm run grooves:verify"
```

## Tracks

### Track A — The quality gate

- **Goal** — a rendered candidate is accepted or rejected with a named reason.
- **Owns** — `scripts/grooves/gate.ts`
- **Depends on** — the `Pcm`, `NoteEvent`, `MusicMeta` contracts, and Epic 2's
  `truePeak` and `SEAM_THRESHOLD`, and Epic 3's `isValidHarmony`. Its tests construct
  buffers by hand, so it does not wait on either.
- **Parallel with** — Tracks B, C
- **Done when** — each of the four checks rejects a purpose-built bad candidate and
  accepts a good one.

### Track B — Checksums and the build guard

- **Goal** — a lock file covering audio, manifest and catalogue, and a verifier that
  fails a build on any of the three going stale or broken.
- **Owns** — `scripts/grooves/lock.ts`, `scripts/grooves/verify-cli.ts`
- **Depends on** — nothing but Node's `fs` and `crypto`. This track imports no audio
  code, which is the point.
- **Parallel with** — Tracks A, C
- **Done when** — a missing, empty, or altered file each fail with the groove named.

### Track C — Minting

- **Goal** — `grooves:add <n>` extends the catalogue by exactly `n`.
- **Owns** — `scripts/grooves/add.ts`, `scripts/grooves/add-cli.ts`
- **Depends on** — Epic 3's `selectSeeds` contract and Track A's `gateCandidate`
  signature. It builds against both while they are implemented.
- **Parallel with** — Tracks A, B
- **Done when** — a run that hits rejections still produces exactly `n` grooves and
  touches no existing entry.

#### Step C7 — Two concurrent runs produce different grooves

Covers: R3

- **Test first** — same file: `addGrooves(2)` called twice with no `startSeed`, against
  two copies of the same catalogue and with a stubbed clock returning two different
  values, produces two disjoint sets of seeds. Run it: fails while the start seed is
  derived from the catalogue rather than the clock.
- **Implement** — `add.ts`: `startSeed = opts?.startSeed ?? Date.now()`, with the clock
  injectable for the test.
- **Green when** — the two sets share no seed. This is what lets two people mint at once
  and keep both batches.
- **Refactor** — none.

### Track D — Documentation

- **Goal** — someone can add a groove without reading the generator's source.
- **Owns** — `public/grooves/README.md`, `scripts/grooves/README.md`
- **Depends on** — nothing.
- **Parallel with** — Tracks A, B, C

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C, Track D
- **Wave 2:** Integration — the gate wired into minting, the lock wired into the build.

## Implementation

### Track A — The quality gate

#### Step A1 — A clipping or silent candidate is rejected

Covers: R5, R6, AC4

- **Test first** — `scripts/grooves/gate.test.ts`: a buffer with samples at 1.5 returns
  a failure whose `check` is `'peak'`; an all-zero buffer returns `'silence'`; a normal
  buffer returns `null`. Run it: fails, "gateCandidate is not a function".
- **Implement** — `gate.ts`: peak and silence checks over `pcm`, using Epic 2's
  `truePeak`.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step A2 — A discontinuous loop is rejected

Covers: R5, R6, AC4

- **Test first** — same file: a buffer whose first and last samples differ by more than
  `SEAM_THRESHOLD` returns `'seam'`; one that wraps cleanly passes. Run it: fails while
  the seam is unchecked.
- **Implement** — add the seam check.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step A3 — Invalid harmony is rejected

Covers: R5, R6, AC4

- **Test first** — same file: a candidate whose `music` and events disagree — a chord
  tone outside what the flavour permits — returns `'harmony'`; a valid one passes. Run
  it: fails while harmony is unchecked.
- **Implement** — call Epic 3's `isValidHarmony`.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step A4 — A too-sparse or too-dense groove is rejected

Covers: R5, R6, AC4

- **Test first** — same file: an event list with two events over 4 bars returns
  `'density'`; one with several hundred returns `'density'`; a normal one passes. The
  bounds come from the template. Run it: fails while density is unchecked.
- **Implement** — add `density` bounds to `FeelTemplate` and check events per bar
  against them.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step A5 — A failure names its check

Covers: R7, AC5

- **Test first** — same file: every failure returned has a non-empty `check` and a
  `detail` containing the measured value. Run it: fails if any check returns a bare
  boolean.
- **Implement** — populate `detail`.
- **Green when** — the assertion passes.
- **Refactor** — none.

### Track B — Checksums and the build guard

#### Step B1 — The lock file round-trips

Covers: R11

- **Test first** — `scripts/grooves/lock.test.ts`: `writeLock(lock, tmp)` then
  `readLock(tmp)` deep-equals `lock`, including both top-level hashes; `readLock` on a
  missing file returns `null`. Run it: fails, module missing.
- **Implement** — `lock.ts`: JSON read and write, `grooves` sorted by `id` for stable
  diffs.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step B2 — Verification catches every way a groove can be broken

Covers: R11, R12, AC8, AC9, AC10

- **Test first** — same file: against a temp groove directory, `verifyLock` returns
  `[]` when everything matches; one failure naming the groove when its file is deleted;
  one when the file is truncated to zero bytes; one when a byte is altered. Run it:
  fails, "verifyLock is not a function".
- **Implement** — `lock.ts`: for each entry, stat the file, compare size, hash with
  `crypto.createHash('sha256')`, and return a `GateFailure` per problem with the id in
  `detail`.
- **Green when** — all four assertions pass. The zero-byte case is the one that would
  have caught the placeholders this whole feature exists because of.
- **Refactor** — none.

#### Step B2b — A stale manifest or catalogue fails verification

Covers: R11, R12, AC8

- **Test first** — same file: against a fixture where audio, manifest and catalogue all
  match their hashes, `verifyLock` returns `[]`. Then append an entry to
  `catalogue.json` without regenerating — assert one failure whose `check` is
  `'catalogue-stale'`. Then edit a value in the generated manifest by hand — assert one
  failure whose `check` is `'manifest-stale'`. Run it: fails while only the audio is
  hashed.
- **Implement** — `lock.ts`: hash `cataloguePath` and `manifestPath` and compare against
  `catalogueSha256` and `manifestSha256`, with a `detail` naming the file and telling the
  reader to re-run `npm run grooves`.
- **Green when** — all three assertions pass. This is the check that catches the case the
  audio checksums cannot see: the inputs moved and the outputs did not.
- **Refactor** — none.

#### Step B3 — The verifier needs no audio toolchain

Covers: R13, AC11

- **Test first** — same file: `lock.ts` and `verify-cli.ts` import nothing from
  `voices`, `mix`, `encode`, `pack` or `wav` — assert by reading the source and matching
  imports. Run it: fails if the verifier reaches for the renderer.
- **Implement** — keep the verifier's imports to `fs`, `crypto` and `lock.ts`.
- **Green when** — the assertion passes. This is what makes the guard runnable on a CI
  machine with no ffmpeg.
- **Refactor** — none.

#### Step B4 — The CLI exits non-zero and says which groove

Covers: R12, AC8, AC9, AC10

- **Test first** — `scripts/grooves/verify-cli.test.ts`: running the verifier's exported
  `main()` against a broken fixture directory resolves to a non-zero code and a message
  containing the groove's id and the reason; against a fixture with a stale manifest, a
  non-zero code naming the manifest; against an intact one, zero. Run it: fails, module
  missing.
- **Implement** — `verify-cli.ts`: `main()` returning a code, plus a thin top-level
  invocation.
- **Green when** — both assertions pass.
- **Refactor** — none.

### Track C — Minting

#### Step C1 — Minting adds exactly `n` and touches nothing existing

Covers: R1, R2, R9, AC1, AC7

- **Test first** — `scripts/grooves/add.test.ts`: against a fixture catalogue of two,
  `addGrooves(3, { startSeed: 1000 })` returns three specs, the catalogue is five long,
  the first two entries are byte-identical to before, and three new mp3s and three new
  lock entries exist. Every test in this track passes an explicit `startSeed`, because
  the default draws from the clock. Run it: fails, "addGrooves is not a function".
- **Implement** — `add.ts`: read the catalogue, call `selectSeeds` with `existing` and a
  `startSeed` past the highest used, render each, gate it, and on success append to the
  catalogue, write the mp3, append the lock entry and rewrite the manifest.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step C2 — New ids and seeds never collide

Covers: R3, AC2

- **Test first** — same file: after two successive `addGrooves(3, { startSeed })` runs,
  all ids are unique, all seeds are unique, and no id was reused from a deleted entry.
  Then, with a `startSeed` deliberately set to one already in the catalogue, assert the
  search skips past it rather than minting a duplicate. Run it: fails if numbering
  restarts, if `existing` is not honoured, or if a colliding start seed is used as-is.
- **Implement** — number new ids from the highest existing `groove-NN`, never from the
  count; and advance past any seed already present in `existing`. The clock makes a
  collision unlikely, not impossible, and an unchecked collision would mint a duplicate
  groove under a new id.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step C3 — A batch spreads across templates

Covers: R4, AC3

- **Test first** — same file: `addGrooves(4)` against four templates produces specs
  naming more than one template. Run it: fails while minting takes the first template
  repeatedly.
- **Implement** — round-robin the template choice across the batch.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step C4 — Rejections are skipped automatically

Covers: R6, R7, AC5, AC13

- **Test first** — same file: with a gate stubbed to reject the first two candidates,
  `addGrooves(2)` still returns two specs, the rejected candidates left no file behind,
  and the reported log names the failed check for each rejection. Run it: fails while a
  rejection aborts or is written anyway.
- **Implement** — loop past rejections, writing nothing until the gate returns `null`.
- **Green when** — all three assertions pass.
- **Refactor** — none.

#### Step C5 — An impossible request fails loudly

Covers: R8, AC6

- **Test first** — same file: with the gate stubbed to reject everything,
  `addGrooves(1, { maxAttempts: 5 })` rejects with an error naming the attempt limit,
  and the catalogue, manifest, lock and groove directory are all unchanged. Run it:
  fails while the loop runs forever or silently adds fewer.
- **Implement** — bound the loop and throw; make every write happen after the batch
  fully succeeds, so a failure leaves nothing partial.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step C6 — Ids survive a removal

Covers: R10

- **Test first** — same file: removing the middle entry from a five-entry catalogue and
  running `addGrooves(1)` leaves the remaining four ids unchanged and gives the new
  groove an unused number. Run it: fails if ids are derived from position.
- **Implement** — derive the next number from the maximum ever used, recorded in the
  catalogue.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step C7 — Two concurrent runs produce different grooves

Covers: R3

- **Test first** — same file: `addGrooves(2)` called twice with no `startSeed`, against
  two copies of the same catalogue and with a stubbed clock returning two different
  values, produces two disjoint sets of seeds. Run it: fails while the start seed is
  derived from the catalogue rather than the clock.
- **Implement** — `add.ts`: `startSeed = opts?.startSeed ?? Date.now()`, with the clock
  injectable for the test.
- **Green when** — the two sets share no seed. This is what lets two people mint at once
  and keep both batches.
- **Refactor** — none.

### Track D — Documentation

#### Step D1 — The docs describe the real workflow

Covers: R14, AC12

- **Test first** — none; prose.
- **Implement** — `scripts/grooves/README.md`: the pipeline's four stages, how to add
  grooves, how to regenerate, what is committed (`catalogue.json`, the mp3s,
  `grooves.generated.ts`, `grooves.lock.json`, the sample pack), what is not, and the
  freeze rule. `public/grooves/README.md`: what these files are and that they are
  generated — replacing the placeholder story outright.
- **Green when** — a reader can follow it to add a groove without opening the source.
- **Refactor** — none.

### Wave 2 — Integration

#### Step I1 — `grooves:add` is wired to the real gate and catalogue

Covers: R1, R2, R5, AC1

- **Test first** — `scripts/grooves/add.test.ts`: `addGrooves` with no stubs, against a
  copy of the real catalogue, produces grooves that pass `gateCandidate` and appear in
  the regenerated manifest with all ten `Groove` fields populated. Run it: fails while
  the stubs are in place.
- **Implement** — remove the stubs; add `"grooves:add"` to `package.json`.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step I2 — `npm run grooves` writes the lock file too

Covers: R11

- **Test first** — `scripts/grooves/cli.test.ts`: after `generate`, the lock holds an
  entry for every catalogue entry with a matching `sha256`, plus a `catalogueSha256` and
  a `manifestSha256` that match the files on disk — and `verifyLock` over the fresh
  output returns `[]`. Run it: fails, `generate` writes no lock.
- **Implement** — call `writeLock` from `cli.ts` after the manifest is written, hashing
  all three artifacts; commit `grooves.lock.json` for the existing catalogue.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step I3 — The build refuses a broken catalogue

Covers: R11, R12, R13, AC8, AC9, AC10, AC11

- **Test first** — `scripts/grooves/verify-cli.test.ts`: with the real lock and a
  temporarily truncated mp3, `main()` returns non-zero naming that groove. Run it:
  fails until `prebuild` is wired.
- **Implement** — add `"prebuild": "npm run grooves:verify"` to `package.json`.
- **Green when** — the assertion passes, and `npm run build` succeeds on an intact tree.
- **Refactor** — none.

#### Step I4 — The demo path, by hand

Covers: R1, R2, R12, AC1, AC8

- `npm run grooves:add 3` → three new grooves appear; open the app and step the clock
  until one comes up; it plays.
- `npm run grooves` again → `git status` shows no change.
- Truncate one mp3 to zero bytes, run `npm run build` → it fails and names that groove.
  Restore it.
- Append a line to `catalogue.json` by hand and run `npm run build` → it fails saying the
  catalogue is stale and to re-run `npm run grooves`. Revert it.
- `npm test`, `npm run lint`, `npx tsc --noEmit` all green.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | C1, I1, I4 |
| R2 | C1, I1, I4 |
| R3 | C2, C7 |
| R4 | C3 |
| R5 | A1, A2, A3, A4, I1 |
| R6 | A1, A2, A3, A4, C4 |
| R7 | A5, C4 |
| R8 | C5 |
| R9 | C1 |
| R10 | C6 |
| R11 | B1, B2, B2b, I2, I3 |
| R12 | B2, B2b, B4, I3, I4 |
| R13 | B3, I3 |
| R14 | D1 |
| AC1 | C1, I1, I4 |
| AC2 | C2 |
| AC3 | C3 |
| AC4 | A1, A2, A3, A4 |
| AC5 | A5, C4 |
| AC6 | C5 |
| AC7 | C1 |
| AC8 | B2, B2b, B4, I3, I4 |
| AC9 | B2, B4, I3 |
| AC10 | B2, B4, I3 |
| AC11 | B3, I3 |
| AC12 | D1 |
| AC13 | C4 |

## Assumptions

- `grooves.lock.json` lives beside `catalogue.json` under `scripts/grooves/`, since it
  describes generator output rather than app data.
- The default attempt bound is ten times the requested count.
- The clock is injectable into `addGrooves` so its tests are deterministic; only the
  default path reads `Date.now()`.
- Seeds are 32-bit values derived from the clock reading, which is what `rngFor` already
  expects.
- `grooves:add` writes into the working tree and never touches git; committing is the
  operator's job.
- The density bounds are a new `FeelTemplate` field, additive to the type Epic 1 froze.
- The verifier compares hashes for the audio, the manifest and the catalogue. It never
  re-derives the manifest, because that would need the theory and events code and defeat
  the no-toolchain rule — a recorded hash of the input gives the same staleness signal
  for the price of one `crypto` call.
- Under the serialized wave order this epic merges before Epic 3, so its tests run
  against Epic 1's single-entry catalogue and Epic 3's sixteen entries arrive later.
  Nothing here depends on the catalogue's size.

## Decision log

### Cycle 1 — 2026-08-29

**Q2. Where does `grooves:add` get its randomness for template choice and seed order?**
Decision: **B) Seed the search from the wall clock**, so two concurrent runs diverge and
both sets can be kept — rather than the fully deterministic option, which would have
made simultaneous minting a merge conflict.
Changed: Architecture gains the clock-derived start seed and the scope of the exception;
`addGrooves` takes an optional `startSeed`; Steps C1 and C5 pass one explicitly so tests
stay deterministic; Step C2 gains a colliding-start-seed assertion; new Step C7 asserts
divergence. Epic 1's determinism rule was narrowed from "no `Date.now` under `scripts/`"
to "none in the render path", with this as the named exception.

### Cycle 2 — 2026-08-29

**Q1. Does the guard also verify that the manifest matches the catalogue?**
Decision: **A) Hash the generated manifest and record it in the lock**, so the guard
compares audio and manifest — keeping R13's no-toolchain rule intact. Delivering the
staleness guarantee that option promised also requires hashing `catalogue.json`, since a
hand-edited catalogue leaves manifest and lock agreeing with each other while disagreeing
with the input; the lock records all three.
Changed: `Lock` replaces the bare `LockEntry[]`, and `readLock`, `writeLock` and
`verifyLock` change signature; new Step B2b; Steps B1, B4, I2 and I4 updated.

---

**This spec is ready to execute.** Every architectural decision is settled.
