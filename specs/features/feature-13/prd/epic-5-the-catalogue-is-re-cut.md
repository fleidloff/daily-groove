# PRD — Epic 5: The catalogue is re-cut

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

Everything before this epic changes what a render *would* sound like; the browser
still plays the cajon. This epic re-renders all thirty grooves and all twelve
reference notes from the new pack, rewrites the lock, and proves the harmony did
not move — every groove keeps its id, its uuid, its tempo and its chords, and
only the recording changes. It is the moment the app becomes the new kit.

## Problem

The app serves committed MP3s. `src/features/daily-groove/data/grooves.generated.ts`
and the files under `public/grooves/` are the product of a render that happened
once, and `grooves.lock.json` records a SHA-256 for each of them plus one for the
pack they were rendered from. So a new pack invalidates every committed artifact
at once — the thirty grooves *and* the twelve reference notes that feature-10's
root chips play, which are single `comp` events rendered from the same pack.

The risk in re-cutting is that something moves that must not. Feature-12 gives
every groove a uuid and a share link that opens it on any day; the puzzle behind
a shared link has to stay the same puzzle. And the briefing's hardest constraint
is one line: harmonically it should stay exactly the same.

## Scope

- Re-rendering the thirty grooves (`npm run grooves`) and the twelve reference
  notes (`npm run notes`).
- Rewriting `grooves.lock.json` in full.
- A test proving the manifest's harmonic fields are unchanged.
- Keeping `grooves:verify` renderless, so `prebuild` still works with no ffmpeg
  and no samples.

**Out of scope**
- **Any change to `src/`.** The app reads the manifest and plays the files, and
  neither shape changes. The generated data module is regenerated, not
  restructured.
- **Minting new grooves.** The catalogue stays at thirty across the same six
  templates. `grooves:add` is not run.
- **Changing how a groove sounds.** Every such decision belongs to Epics 1–4;
  this epic renders what they decided and changes nothing itself.
- **The MP3 encoding settings.** Bitrate, channels and sample rate are what they
  are.

## Requirements

### The re-render

- **R1** — All thirty grooves are re-rendered from the new pack and committed,
  together with their manifest.
- **R2** — All twelve reference notes are re-rendered and committed, together
  with their manifest. They are not optional collateral: they are rendered from
  the same pack, and the lock's `packSha256` is what makes that explicit.
- **R3** — Every groove keeps its `id` and its `uuid`. A link shared before the
  re-cut opens the same groove, with the same answer, played by a different band.
- **R3a** — `catalogue.json` is unchanged. It is the input to the render, not an
  output of it, and its `{ id, uuid, template, seed }` rows are what make two
  runs agree.
- **R4** — The render is deterministic. Running `npm run grooves` twice from the
  same tree produces byte-identical output both times.

### The harmony does not move

- **R5** — For all thirty grooves, the new manifest's `root`, `flavour`, `scale`,
  `chord`, `progression`, `bpm`, `bars` and `loopBars` are identical to the
  current ones.
- **R5a** — The fixture is a committed JSON file holding those eight fields for
  all thirty grooves, written from the *current* manifest and committed before
  anything is re-rendered. It is the briefing's load-bearing constraint and the
  only thing standing between a re-cut and a silently re-tuned catalogue.
- **R5c** — Because it is written first, the test passes the moment it lands and
  keeps passing through the re-cut. A fixture generated from the new manifest
  would be a copy of the output it is meant to be checking, which is a test that
  cannot fail.
- **R5b** — A groove whose harmony moved fails by name, reporting the groove, the
  field, the old value and the new one.
- **R6** — The twelve reference notes still sound the twelve chromatic roots, at
  the same pitches, in the same order.

### The lock

- **R7** — `grooves.lock.json` is rewritten in full: `catalogueSha256`,
  `manifestSha256`, all thirty groove entries with their SHA-256 and byte count,
  all twelve note entries, `notesManifestSha256` and `packSha256`.
- **R8** — `verifyLock` passes against the freshly committed artifacts, with no
  entry missing, stale or orphaned.
- **R9** — `lock.ts` still imports nothing that renders. `lock.test.ts` asserts
  this by reading the source against an explicit allowlist, because the guard
  runs on a build machine with no ffmpeg and no sample pack. Nothing in this
  epic may add to that allowlist.
- **R10** — `npm run build` passes, exercising `grooves:verify` through
  `prebuild` on artifacts alone.

### Committing it

- **R10a** — The artifacts, both manifests, the generated data module and the
  lock are committed together, in one commit. The lock is only true about the
  artifacts it was written from, so a split leaves an intermediate commit whose
  `grooves:verify` fails and whose tree nobody can bisect through.
- **R10b** — The harmony fixture is the exception and is committed earlier, on
  its own, while the current audio is still in the tree. That is what R5c
  requires.

### The app plays it

- **R11** — Today's groove plays the new kit, with no change to the puzzle it
  poses.
- **R12** — A share link created before the re-cut still resolves, still opens
  the same groove, and still grades the same answer.
- **R13** — A root chip plays its reference note, unchanged in function.
- **R14** — No committed audio file is left behind. A groove or note file present
  in `public/` but absent from the lock, or the reverse, is a failure.

## Behaviour details

**Why the notes have to be re-cut with the grooves.** The lock's `packSha256`
ties every committed artifact to the pack that produced it, which is what catches
the staleness case the per-file hashes cannot see: someone changes the pack,
re-renders the grooves, forgets the notes, and commits. Groove hashes and
manifest hashes then agree with each other while the notes disagree with the pack
they claim to come from. Re-rendering both in one change is the only state in
which the lock is telling the truth.

**The order inside the epic.** The harmony test is written *before* the
re-render, against the current manifest, so it starts out passing and stays
passing. Written afterwards it would be a fixture copied from the output it is
supposed to be checking, which is a test that cannot fail.

## Acceptance criteria

- **AC1** (R1, R2) — Given a clean tree, when `npm run grooves` and `npm run
  notes` are run, then thirty groove files, a groove manifest, twelve note files
  and a notes manifest are produced.
- **AC2** (R3, R3a) — Given the new manifest, when its ids and uuids are compared
  with `catalogue.json`, then all thirty match, and `catalogue.json` is unchanged
  from before the epic.
- **AC3** (R4) — Given the same tree, when the catalogue is rendered twice, then
  every output file is byte-identical between the two runs.
- **AC4** (R5, R5a, R5b) — Given the committed fixture of current harmonic
  values, when the new manifest is checked against it, then all thirty grooves
  match on every one of the eight fields; and given a deliberately altered value,
  the check fails naming the groove, the field and both values.
- **AC4a** (R5a, R5c) — Given the fixture committed before any re-render, when
  the test suite runs against the *current* manifest, then it passes — proving
  the fixture describes the catalogue as it is rather than as it became.
- **AC5** (R6) — Given the twelve re-rendered notes, when each is measured for
  pitch, then each sounds the chromatic root its id names.
- **AC6** (R7, R8) — Given the committed artifacts, when `verifyLock` runs, then
  it reports no failures, and the lock holds `packSha256`,
  `notesManifestSha256`, thirty groove entries and twelve note entries.
- **AC7** (R9) — Given `lock.ts`, when its imports are read, then every one is on
  the allowlist and the allowlist is unchanged.
- **AC8** (R10) — Given a machine with no ffmpeg and no `samples/` directory,
  when `npm run build` runs, then `grooves:verify` passes and the build
  completes.
- **AC9** (R11, R13) — Given the app in a browser, when the day's groove is
  played and a root chip tapped, then both sound and the puzzle behaves as
  before.
- **AC10** (R12) — Given a share URL captured before the re-cut, when it is
  opened after, then it resolves to the same groove and the same correct answer
  grades as correct.
- **AC11** (R14) — Given the files under `public/grooves/` and the lock, when
  the two sets of names are compared, then they are equal.
- **AC12** (out of scope) — Given `src/`, when compared before and after this
  epic, then the only changed file is the generated data module.
- **AC13** (R10a) — Given the re-cut commit, when its tree is checked out, then
  `npm run grooves:verify` passes; and given the commit before it, the tree still
  verifies against the old artifacts.

## Dependencies

**Needs to start:** Epics 2, 3 and 4 complete. Every decision that changes what a
render sounds like has to land before the render that ships, or this epic runs
twice and the second run is the real one.

The harmony fixture (R5a) is the exception and can be written first, against the
current manifest, in parallel with any of the earlier epics.

**Hands to:** nothing. This is the last epic in the feature.

## Assumptions

- Re-rendering is a normal operation. The freeze rule feature-9 removed is not
  coming back, and `docs.test.ts` guards the README against it returning.
- `src/lib/hash.ts` stays frozen on the justification that survives: changing it
  reassigns every past date a different puzzle. This epic changes audio, not the
  date mapping, and does not touch it.
- The thirty MP3s are roughly the size they are now — about 24 MB under
  `public/grooves/` — so the re-cut is a large diff of binary files but not a new
  category of one.
- The listening sign-off happens here as well as per epic: this is the first time
  all thirty are audible together, and cross-catalogue balance is only really
  judgeable at that point.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there.

### Cycle 1 — 2026-09-01

**Q1. What form does the harmony fixture take?**
Answer: **A) A committed JSON fixture of the eight harmonic fields for all thirty
grooves, checked in before the re-render and asserted after** — a fixture written
from today's manifest is the only version that cannot be copied from the output
it checks.
Applied to: R5a, R5c, R10b, AC4, AC4a

**Q2. How is the re-cut committed?**
Answer: **A) One commit containing the artifacts, the manifests and the lock
together** — the lock is only true about the artifacts it was written from, so
splitting them leaves an intermediate commit whose `grooves:verify` fails.
Applied to: R10a, R10b, AC13
