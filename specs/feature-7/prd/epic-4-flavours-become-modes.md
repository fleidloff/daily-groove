# PRD — Epic 4: Flavours become modes

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The second chip row stops mixing three kinds of word. `Major` and `Minor` are
renamed to `Ionian` and `Aeolian` — the same seven pitches under the name a
modal vocabulary uses — and the four grooves that are not modes at all, two
`Blues` and two `Harmonic minor`, leave `catalogue.json` entirely. Six
replacements are minted first, taking the rotation from sixteen grooves to
eighteen: three in each of the six surviving modes. No existing groove's audio,
id or answer changes.

## Problem

The row is labelled "Flavour" and offers `Major`, `Minor`, `Harmonic minor`,
`Dorian`, `Phrygian`, `Lydian`, `Mixolydian` and `Blues`. A player who can hear
that a groove is Dorian cannot tell whether the answer is `Dorian` or `Minor`,
because on this list both are true and only one is scored. "Flavour" is not a
word musicians use, and the mixture it labels is not a set anyone can reason
about. One vocabulary, consistently applied, removes the ambiguity outright.

## Scope

Three steps, in a fixed order:

1. **Mint.** Add six replacement grooves via `grooves:add`, one in each
   surviving mode, before anything is removed.
2. **Rename.** `Major` → `Ionian` and `Minor` → `Aeolian`, in the generator's
   `scripts/grooves/theory/` and in the app's `lib/theory/music.ts`.
3. **Remove.** The two `Blues` and two `Harmonic minor` entries are deleted from
   `catalogue.json` and their mp3s from `public/grooves/`, and the manifest and
   lock are regenerated without them.

**Out of scope**
- **Locrian.** No groove carries it, and a half-diminished tonic is a poor thing
  to ask anyone to hear in four bars. The replacements spread across the modes
  that survive.
- **Simple mode's two-way collapse** to major and minor — Epic 5. This epic
  settles the vocabulary that collapse operates on.
- **Re-rendering, renumbering or re-answering any existing groove.** The freeze
  rule in `scripts/grooves/README.md` forbids it, and the mint-first ordering
  exists precisely so nothing has to.
- **A retirement flag or filter.** There is none. The four grooves leave
  `catalogue.json`, which is the generator's whole definition of a groove, so
  nothing downstream needs to know they ever existed. The rotation is the
  generated catalogue, with no predicate applied to it.
- **Keeping the removed audio.** The four mp3s are deleted along with their
  catalogue entries. `verifyLock` walks the lock's entries rather than the
  directory, so leaving them would have passed the build guard — but an asset
  nothing references is dead weight shipped to every visitor, and git history
  holds them if they are ever wanted back.
- **Micro-timing, swing and velocity.** Regenerating the catalogue for *feel* is
  feature-C, not this.
- **The rotation algorithm itself** — Epic 1. This epic changes what is in the
  rotation, not how the day's groove is drawn from it.

## Requirements

- **R1** — The guess card's second chip row is labelled with the word for what
  it holds — a mode — not "Flavour".
- **R2** — Every option offered in that row is a mode name.
- **R3** — `Major` is renamed `Ionian` and `Minor` is renamed `Aeolian`
  throughout the generator and the app. The pitches these describe do not
  change, because the two names describe the same scale.
- **R4** — The two `Blues` entries and the two `Harmonic minor` entries are
  removed from `catalogue.json`. The regenerated manifest does not contain them,
  so they are neither offered as the day's groove nor present in the option
  pool.
- **R5** — Six replacements are minted before the removal is applied, one in
  each surviving mode, so the rotation grows from sixteen to eighteen and never
  shrinks at any point in the sequence.
- **R5a** — Each of the six surviving modes is carried by exactly three grooves,
  so no mode is over-represented among the answers.
- **R5b** — The four removed grooves' mp3s are deleted from `public/grooves/`
  along with their catalogue, manifest and lock entries. Nothing unreferenced is
  left in the shipped bundle.
- **R6** — No surviving groove's `id`, audio file, `root` or scale content is
  changed, and no surviving groove is renumbered.
- **R6a** — No groove id is ever re-issued. The two `Harmonic minor` grooves are
  `groove-15` and `groove-16` — the highest ids in the catalogue — so removing
  them before minting would let `selectSeeds` hand those same ids to different
  audio. Minting first is what prevents it: the new grooves take `groove-17`
  through `groove-22`, and the high-water mark never regresses.
- **R7** — The rotation is the generated catalogue. No filter, flag or allowlist
  stands between `GROOVES` and the day's pick, and none is introduced — a groove
  that should not be played is a groove that is not in `catalogue.json`.
- **R8** — `Flavour` in `src/lib/groove.ts` stays a plain string. The pool is
  derived from the seed data at runtime, and narrowing the vocabulary does not
  make it a union.
- **R9** — The day's option row keeps its current shape: four options, seeded
  deterministically by the date, always including the correct one.
- **R10** — A stored `DailyResult` whose `grooveId` names a removed groove still
  loads and still counts toward the streak. Nothing resolves a `grooveId` back
  to a `Groove` — feature-6 deleted `resolveGroove.ts` with the archive — so an
  id with no matching entry is inert rather than broken.

## Behaviour details

**The vocabulary, before and after.**

| Today | After | Grooves | Fate |
| :-- | :-- | :-- | :-- |
| `Major` | `Ionian` | 2 | renamed |
| `Minor` | `Aeolian` | 2 | renamed |
| `Dorian` | `Dorian` | 2 | unchanged |
| `Phrygian` | `Phrygian` | 2 | unchanged |
| `Lydian` | `Lydian` | 2 | unchanged |
| `Mixolydian` | `Mixolydian` | 2 | unchanged |
| `Harmonic minor` | — | 2 | removed |
| `Blues` | — | 2 | removed |

Twelve grooves survive across six modes, two each. Six new grooves — one per
mode — take the rotation to eighteen, three per mode. The lap in Epic 1 is
therefore eighteen days long, and every mode is the answer exactly three times
in it.

**Why the rename is not a freeze violation.** The freeze rule says a groove's
id, audio and answers do not change. C major and C Ionian are the same seven
pitches, the same tonic and the same chords — the generator's `intervalsFor`
returns one interval set for both names. What changes is the string displayed
and matched against, not the musical fact it names. Nothing is re-rendered, and
`grooves.lock.json` still describes the audio it describes today.

**Why mint before remove.** Two reasons, and the second is the load-bearing one.

Removing four entries first would leave a twelve-day rotation until the mint
lands, and Epic 1's lap length would change twice in one feature — once down,
once up — reshuffling every player's sequence both times and spending two of
Epic 1's accepted one-off repeats instead of one. Minting first means the
rotation only ever grows: 16 → 22 → 18.

More importantly, `selectSeeds` allocates the next id from `highestNumber` — the
maximum already in the catalogue, never the count, precisely so ids are not
re-issued. `groove-15` and `groove-16` are the two `Harmonic minor` grooves. Cut
them first and the high-water mark drops to 14, so the very next mint issues
`groove-15` and `groove-16` again, to different audio, writing over the
filenames the deletion just freed. Minting first leaves the mark at 22 and the
hazard never arises.

**What the removal touches.** `catalogue.json` is hashed into
`grooves.lock.json` as `catalogueSha256`, precisely so an edited catalogue
cannot be committed against a stale manifest. Editing it therefore requires
`npm run grooves` to regenerate both the manifest and the lock — which the mint
already requires. The removed grooves' entries leave the lock with them; their
mp3s stay on disk and are simply no longer recorded.

## Acceptance criteria

- **AC1** (R1) — Given the guess card, when it renders, then the second chip
  row's label names a mode rather than a flavour.
- **AC2** (R2, R9) — Given any date, when the day's options are built, then all
  four are mode names, they include the day's answer, and the same date yields
  the same four in the same order.
- **AC3** (R3) — Given the generator's flavour list and the app's option pool,
  when each is inspected, then neither contains `Major` or `Minor`, and both
  contain `Ionian` and `Aeolian`.
- **AC4** (R3) — Given a groove previously answered `Major`, when its scale
  content is compared before and after the rename, then its pitches, tonic chord
  and progression are identical.
- **AC5** (R4) — Given `catalogue.json` and the generated manifest, when each is
  read, then neither contains the four removed ids, and neither `Blues` nor
  `Harmonic minor` appears among the options on any date.
- **AC6** (R5) — Given the rotation before and after this epic, when both are
  counted, then it grows from sixteen to eighteen and is never smaller than
  sixteen at any committed step.
- **AC6a** (R5a) — Given the rotation, when its grooves are grouped by mode,
  then each of the six modes holds exactly three.
- **AC7** (R6) — Given `scripts/grooves/grooves.lock.json` and the mp3s under
  `public/grooves/`, when the verification step runs, then every surviving
  pre-existing groove verifies unchanged.
- **AC7a** (R5b) — Given `public/grooves/`, when it is listed, then it holds one
  mp3 per groove in the lock and no others.
- **AC7b** (R6a) — Given the catalogue after this epic, when the highest groove
  number is read, then it is 22, and a subsequent `grooves:add` issues
  `groove-23`.
- **AC8** (R7) — Given the source tree, when it is searched for a retirement
  flag, allowlist or rotation filter, then none exists, and both the daily pick
  and the option pool read `GROOVES` directly.
- **AC9** (R8) — Given `src/lib/groove.ts`, when `Flavour` is inspected, then it
  is still `string`.
- **AC10** (R10) — Given a stored `DailyResult` whose `grooveId` names a removed
  groove, when the app loads, then it does not throw, and the streak still
  counts that day.
- **AC11** (R2) — Given `npm test` across `src/` and `scripts/grooves/`, when it
  runs, then the generator's harmony and validity suites pass for every
  surviving mode.

## Dependencies

Needs nothing to start, but it is the long pole of wave 1: step 1 is a
`grooves:add` run that must pass the gate and then be listened to, and no
amount of parallelism shortens that.

It shares two seams:

- With **Epic 1** — the rotation list (R7). Whichever merges second wires itself
  to the filter the first one left.
- With **Epic 3** — `components/puzzle/GuessCard.tsx`. This epic owns the second
  chip row's `label` and `options`; Epic 3 owns everything else in the card.
  Neither changes `ChipGroup`'s props.

It hands **Epic 5** the vocabulary its two-way collapse is defined over: six
modes, mapped by their third.

## Assumptions

- The chip row's label becomes `Mode`.
- `groove.scale` — the display string, e.g. `"C major"` — is regenerated to read
  `"C ionian"` for consistency. Nothing currently renders it, so this is
  housekeeping rather than a visible change.
- Stored `DailyResult.answer` values naming `Major` or `Blues` are not migrated.
  The streak reads only `solved` and `date`, and the answer shown on screen is
  derived from the groove rather than from the record.
- The replacements are minted with the existing templates and the existing gate.
  Choosing their seeds is the generator's business at mint time.
- The mp3 deletion is a plain `git rm` in the same commit as the catalogue edit,
  so the two cannot drift apart in review.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune
a past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-08-30

**Q1. Where does the retirement live?**
Answer: **C) Remove the four entries from `catalogue.json`, keeping the mp3s on
disk** — the generator stops knowing about them entirely, so no flag, filter or
seam is needed anywhere downstream.
Applied to: Summary, Scope, Out of scope, R4, R7, R10, AC5, AC8, AC10,
Behaviour details, Assumptions — and Epic 1, whose shared-seam dependency this
answer removes outright

**Q2. How many replacements, and how balanced?**
Answer: **A) Mint six, three per mode across all six** — the briefing's
"whatever amount" makes the number free, and an even spread means no mode is
over-represented in the answer distribution.
Applied to: Summary, Scope, R5, R5a, AC6, AC6a, Behaviour details

### Cycle 2 — 2026-08-30

**Q3. What happens to the four unreferenced mp3s?**
Answer: **B) Delete them** — an asset nothing references is dead weight shipped
to every visitor, and git history holds them if they are ever wanted back.
Applied to: Out of scope, Scope step 3, R5b, AC7a, Assumptions — reversing the
cycle-1 statement that the mp3s would stay on disk
