# Tech spec — Epic 5: The catalogue is re-cut

PRD: [../prd/epic-5-the-catalogue-is-re-cut.md](../prd/epic-5-the-catalogue-is-re-cut.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Almost all of this epic is one command run twice and a large binary diff. The
engineering is the guard around it: a committed fixture of the current harmony,
written and passing *before* anything is re-rendered, so the re-cut has something
to be checked against that was not derived from it.

That ordering is the whole design. A fixture generated after the render is a copy
of the output it is meant to be checking — a test that cannot fail — so Track A
lands in wave 1, in parallel with Epics 1 through 4, while the cajon audio is
still in the tree. Everything else waits for those epics, because a render that
happens before they finish is a render that has to happen again.

One field needs naming up front. The generated module carries thirteen fields per
groove, and `headDelaySeconds` is measured from the audio — it will change, and
it is not a harmony field. The fixture pins the eight the PRD lists and
deliberately leaves that one out.

## Architecture

```
Wave 1                          Wave 3
┌───────────────────────────┐   ┌──────────────────────────────────┐
│ Track A                   │   │ npm run grooves  → 30 mp3        │
│ harmony.fixture.json      │──▶│ npm run notes    → 12 note mp3   │
│ written from the CURRENT  │   │ both manifests rewritten          │
│ manifest, test green now  │   │ grooves.lock.json rewritten       │
└───────────────────────────┘   │ Track A's test still green   ◀────┘
                                └──────────────────────────────────┘
```

The lock records `catalogueSha256`, `manifestSha256`, thirty groove entries,
twelve note entries, `notesManifestSha256` and `packSha256`. Because
`packSha256` ties every artifact to the pack that produced it, the notes are not
optional collateral: re-rendering the grooves and not the notes leaves a lock
that is internally consistent and lying.

`lock.ts` imports nothing that renders — `lock.test.ts` asserts this by reading
the source against an explicit allowlist, because `grooves:verify` runs in
`prebuild` on a machine with no ffmpeg and no `samples/`. Nothing in this epic
may add to that allowlist, and the fixture check must therefore live in a test
file rather than inside the verify path.

## Contracts

### The harmony fixture

```jsonc
// scripts/grooves/harmony.fixture.json
{
  "note": "Written from the pre-feature-13 manifest. Feature-13 changes what a
           groove is played on, not what it is; this is the evidence.",
  "grooves": {
    "groove-01": {
      "bpm": 98, "bars": 4, "loopBars": 16,
      "root": "C", "flavour": "dorian",
      "scale": "C dorian", "chord": "Cm7",
      "progression": "Cm7–F7–Gm7"
    }
    // ... all thirty
  }
}
```

Eight fields per groove. **`id` and `uuid` are checked separately** against
`catalogue.json`, and **`headDelaySeconds` and `audioSrc` are excluded** — the
first is measured from the audio and is expected to change, the second is a path.

### What the re-cut may and may not change

| Changes | Does not change |
| :-- | :-- |
| `public/grooves/*.mp3` | `scripts/grooves/catalogue.json` |
| `public/grooves/note-*.mp3` | `src/lib/hash.ts` |
| both manifests' audio-derived fields | the eight harmony fields |
| `grooves.lock.json` | any id or uuid |
| | anything else under `src/` |

## Tracks

### Track A — the harmony guard

- **Goal** — a committed fixture and a test that passes against today's
  catalogue and would fail if any harmony field moved.
- **Owns** — `scripts/grooves/harmony.fixture.json`,
  `scripts/grooves/harmony.test.ts`.
- **Depends on** — nothing. Wave 1, parallel with every other epic.
- **Done when** — the test passes against the current, un-re-rendered manifest.

### Track B — the re-cut

- **Goal** — thirty grooves, twelve notes, two manifests and a lock, all
  agreeing.
- **Owns** — `public/grooves/**`,
  `src/features/daily-groove/data/grooves.generated.ts`, the notes manifest,
  `scripts/grooves/grooves.lock.json`.
- **Depends on** — Epics 2, 3 and 4 complete, and Track A committed.
- **Done when** — `verifyLock` is clean and Track A's test still passes.

### Track C — the guards that must not have moved

- **Goal** — the renderless build guard, the file-set agreement, and the app.
- **Owns** — assertions in `scripts/grooves/lock.test.ts` and
  `scripts/grooves/docs.test.ts`.
- **Depends on** — Track B.
- **Done when** — its cases pass and `npm run build` completes with no ffmpeg.

## Execution waves

- **Wave 1:** Track A — and it must be committed before wave 3 renders anything.
- **Wave 2:** Epics 1–4 finish. Nothing in this epic runs.
- **Wave 3:** Track B, then Track C.

## Implementation

### Track A (wave 1) — the harmony guard

#### Step A1 — the fixture is written from today's manifest

Covers: R5, R5a, R5c, AC4a

- **Test first** — `scripts/grooves/harmony.test.ts`: read
  `harmony.fixture.json` and the current generated module; for all thirty
  grooves assert the eight fields are equal. Run it: fails with
  `Cannot find module './harmony.fixture.json'`.
- **Implement** — generate the fixture *from the current committed manifest* with
  a one-off script, inspect the diff, and commit it. Do not hand-write thirty
  entries; do read them before committing.
- **Green when** — the test passes against the tree as it is, with the cajon
  audio still in place. That is the proof the fixture describes the catalogue as
  it *is* rather than as it became.
- **Refactor** — none.

#### Step A2 — a moved field fails by name

Covers: R5b, AC4

- **Test first** — `harmony.test.ts`: a case that takes the fixture, mutates one
  groove's `flavour` in memory, runs the comparison, and asserts the reported
  failure names the groove id, the field, the expected value and the actual one.
  Run it: fails if the comparison throws a bare `expected true to be false`.
- **Implement** — compare field by field and build a message per mismatch:
  `groove-14 flavour: expected "aeolian", got "dorian"`.
- **Green when** — the message contains all four parts.
- **Refactor** — none.

#### Step A3 — ids and uuids are checked against the catalogue, not the fixture

Covers: R3, R3a, AC2

- **Test first** — `harmony.test.ts`: assert the manifest's `{ id, uuid }` pairs
  equal `catalogue.json`'s, for all thirty, and that the fixture covers exactly
  those thirty ids — no extra, none missing. Run it: passes.
- **Implement** — nothing. Checking uuids against the catalogue rather than the
  fixture is deliberate: the catalogue is the input, and a uuid that drifted from
  it is a mint that should never have happened.
- **Green when** — green.
- **Refactor** — none.

#### Step A4 — `headDelaySeconds` is excluded on purpose

Covers: R5a

- **Test first** — `harmony.test.ts`: assert the fixture's per-groove keys are
  exactly the eight named fields — so `headDelaySeconds` and `audioSrc` cannot be
  added later by someone assuming completeness is the goal. Run it: fails if the
  generator script in A1 dumped every field.
- **Implement** — trim the fixture to eight keys and comment why in the
  fixture's `note`.
- **Green when** — the key set is exactly eight.
- **Refactor** — none.

### Track B (wave 3) — the re-cut

#### Step B1 — the render is deterministic before it is trusted

Covers: R4, AC3

- **Test first** — `scripts/grooves/cli.test.ts`: render the catalogue to a temp
  directory twice and assert every output file is byte-identical between the two
  runs. Run it: this case may already exist in spirit; if so, extend it to the
  notes as well.
- **Implement** — nothing, unless it fails — in which case something in Epics
  1–4 introduced a non-deterministic draw, and that is a bug in the epic that
  introduced it, not something to paper over here.
- **Green when** — both runs match.
- **Refactor** — none.

#### Step B2 — re-render everything

Covers: R1, R2, R6, AC1, AC5

- **Test first** — `scripts/grooves/notes.test.ts`: assert each of the twelve
  rendered notes sounds the chromatic root its filename names, measured rather
  than read off the name. Run it against the freshly rendered files.
- **Implement** — `npm run grooves` then `npm run notes`. Commit thirty MP3s,
  twelve note files, both manifests and the regenerated
  `grooves.generated.ts`.
- **Green when** — thirty groove files and twelve note files exist, and the
  pitch assertions pass.
- **Refactor** — none.

#### Step B3 — the harmony did not move

Covers: R5, AC4

- **Test first** — Track A's `harmony.test.ts`, unchanged, run against the new
  manifest.
- **Implement** — nothing. If it fails, the failure names the groove and the
  field, and the fix belongs in whichever epic moved it — not in the fixture.
  **Editing the fixture to match a new value is the one thing this epic must
  never do.**
- **Green when** — all thirty match on all eight fields.
- **Refactor** — none.

#### Step B4 — the lock agrees with what was committed

Covers: R7, R8, AC6

- **Test first** — `scripts/grooves/lock.test.ts`: assert `verifyLock` returns
  an empty failure array against the committed artifacts, and that the lock
  holds `packSha256`, `notesManifestSha256`, thirty groove entries and twelve
  note entries. Run it: fails on stale hashes before the lock is rewritten.
- **Implement** — rewrite `grooves.lock.json` via the CLI's own lock-writing
  path — `buildLock` then `writeLock` — not by hand.
- **Green when** — `verifyLock` is clean and all four shape assertions pass.
- **Refactor** — none.

#### Step B5 — one commit, verifiable at both ends

Covers: R10a, R10b, AC13

- **Test first** — a review check, not a unit test: the artifacts, both
  manifests, the generated module and the lock are in **one** commit. Track A's
  fixture is in an earlier, separate commit.
- **Implement** — stage them together. A split leaves an intermediate commit
  whose `grooves:verify` fails and whose tree nobody can bisect through.
- **Green when** — `npm run grooves:verify` passes on the re-cut commit, and on
  its parent against the old artifacts.
- **Refactor** — none.

### Track C (wave 3) — the guards

#### Step C1 — the build guard still renders nothing

Covers: R9, R10, AC7, AC8

- **Test first** — `lock.test.ts`'s existing allowlist case, unchanged: assert
  every import in `lock.ts` is on the allowlist and that the allowlist itself is
  the same list. Run it: passes, and fails if anything in this epic reached for a
  renderer from inside the guard.
- **Implement** — nothing. Keep the harmony check in `harmony.test.ts`, outside
  the verify path, for exactly this reason.
- **Green when** — green, and `npm run build` completes on a tree with
  `samples/` moved aside and no ffmpeg on `PATH`.
- **Refactor** — none.

#### Step C2 — no file is orphaned in either direction

Covers: R14, AC11

- **Test first** — `lock.test.ts`: collect the `.mp3` basenames under
  `public/grooves/` and the ids in the lock; assert the two sets correspond
  exactly, for grooves and notes alike. Run it: fails if a renamed or removed
  groove left a file behind.
- **Implement** — delete any orphan.
- **Green when** — the sets are equal.
- **Refactor** — none.

#### Step C3 — `src/` changed in exactly one file

Covers: out of scope, AC12

- **Test first** — a review check: `git diff --name-only -- src/` lists only
  `src/features/daily-groove/data/grooves.generated.ts`.
- **Implement** — nothing. The app reads the manifest and plays the files;
  neither shape changed.
- **Green when** — the diff is one file.
- **Refactor** — none.

#### Step C4 — the freeze rule is still absent and `hash.ts` still frozen

Covers: Assumptions

- **Test first** — `docs.test.ts`'s existing cases, unchanged: the generator
  README states no freeze rule, and `docs/coding-guidelines.md` still declares
  `src/lib/hash.ts` frozen on the date-mapping justification. Run it: passes.
- **Implement** — nothing. Re-rendering is a normal operation; this epic is the
  largest exercise of that so far and a good moment for the guard to hold.
- **Green when** — green.
- **Refactor** — none.

## Integration and verification

- **Step I1 — full suite.** `npm test`, `npx tsc --noEmit`, `npm run lint`,
  `npm run build`. The build exercises `grooves:verify` through `prebuild`, and
  this is the first point in the whole feature where it is expected to pass —
  Epics 1–4 each leave it failing on lock staleness by design.
- **Step I2 — the app, by hand.** Open it: today's groove plays the new kit and
  poses the same puzzle. Tap a root chip: a clean reference note. Open a share
  URL captured *before* the re-cut: same groove, same correct answer grades
  correct. Capture that URL before starting wave 3 — after the re-cut there is
  nothing to compare against.
- **Step I3 — the listening sign-off, across all thirty.** This is the first time
  the whole catalogue is audible together, and cross-catalogue balance is only
  really judgeable here. A finding at this point is a template gain to revisit in
  Epic 2, then a re-render — which is cheap, because the render is deterministic
  and the fixture guards the harmony.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | B2 |
| R2 | B2 |
| R3, R3a | A3 |
| R4 | B1 |
| R5 | A1, B3 |
| R5a | A1, A4 |
| R5b | A2 |
| R5c | A1 |
| R6 | B2 |
| R7 | B4 |
| R8 | B4 |
| R9 | C1 |
| R10 | C1, I1 |
| R10a, R10b | B5 |
| R11 | I2 |
| R12 | I2 |
| R13 | I2 |
| R14 | C2 |
| AC1 | B2 |
| AC2 | A3 |
| AC3 | B1 |
| AC4 | A2, B3 |
| AC4a | A1 |
| AC5 | B2 |
| AC6 | B4 |
| AC7 | C1 |
| AC8 | C1, I1 |
| AC9 | I2 |
| AC10 | I2 |
| AC11 | C2 |
| AC12 | C3 |
| AC13 | B5 |

## Assumptions

- The fixture lives at `scripts/grooves/harmony.fixture.json`, beside the
  catalogue it describes, rather than under a test directory. It is data about
  the catalogue, and the generator's other data — `catalogue.json`,
  `grooves.lock.json` — lives there too.
- `harmony.test.ts` reads the generated module rather than re-deriving harmony
  from `{ template, seed }`. Deriving it would test the generator against itself;
  the point is a snapshot taken before the change.
- The share-link check in I2 is manual. Feature-12 is still in progress, so
  automating it here would couple this epic to a moving surface.
- The re-cut is roughly 24 MB of binary churn, as the current `public/grooves/`
  is. Large, but not a new category of diff for this repo.
- `npm run notes` writes the notes manifest and the twelve files; if it turns out
  to need a flag to overwrite existing output, that is a CLI detail to discover
  in B2, not a design question.

## Decision log

### Cycle 1 — 2026-09-01

No architectural questions open at drafting. The PRD settled the fixture's form
and the single-commit shape. The calls this spec makes alone — excluding
`headDelaySeconds` and `audioSrc` from the fixture, checking uuids against the
catalogue rather than the fixture, keeping the harmony check outside the
renderless verify path — are recorded as assumptions, and the last of them is
enforced by `lock.test.ts`'s existing allowlist rather than by convention.
