# PRD — Epic 2: Real instruments

Feature: [briefing.md](../briefing.md) · [roadmap.md](../roadmap.md)

## Summary

The sample pack stops being a set of stand-ins. The whole drum kit is replaced,
preferably from a single source, an electric bass replaces the FM piano, and an
electric piano replaces the clavisynth — so the band sounds like it is in one
room rather than assembled from seven separately recorded instruments. Where
VCSL holds no kit recorded together, the best instrument per voice is taken and
Epic 4's shared room does the gluing. Everything comes from
VCSL, the CC0 library already shipped, accepting its closest instrument where it
holds no ideal one. Every template's pan balance is re-tuned to the new sources,
and its levels are rebased onto the corrected dynamics scaling Epic 3 lands. No
groove's answer, id or structure changes.

## Problem

`samples/README.md` names what is actually in the pack: `kick` is a cajon bass
tone, `rim` is a woodblock, `bass` is a TX81Z FM Piano and `comp` is a TX81Z
Clavisynth. Every timing and arrangement improvement in this feature is applied
on top of those, and there is a ceiling above which none of it helps: an FM
piano playing a bass line over a cajon reads as a sample-library demo however
well it is played. This is the largest single change to how a groove sounds, so
it lands in wave 1 — everything downstream should be tuned against the final
band rather than re-tuned after it.

## Scope

- Replace every voice: the whole drum kit from one source, an electric bass,
  and an electric piano.
- Declare the new sources in `pack.json` with un-normalised velocity layers and
  round-robins, record every file in `provenance.json`, and grow
  `pack.test.ts`'s stocking assertions.
- Re-tune `pan` in all four templates, and rebase `gain` onto the values Epic 3
  sets for the corrected dynamics scaling.
- Re-render and commit the catalogue.

**Out of scope**
- **Toms and a crash.** They come from the same kit chosen here, but they exist
  to serve fills, so they are minted in Epic 5 against this epic's choice.
- **Per-voice EQ, compression or saturation.** Choosing better sources is not
  mixing them; `mix.ts` stays a summing bus plus Epic 4's reverb send.
- **Any change to what is played.** Same events, same rhythms, same answers —
  different instruments.
- **The pitched-voice register bounds.** `bass` still covers sounding MIDI
  22–50 and `comp` 46–86. A replacement that cannot fill those is the wrong
  replacement, not a reason to move the bounds.
- **Loosening the 4-semitone sampling interval.** See R6.
- **Sources outside VCSL.** Everything comes from the CC0 library already
  shipped, so there is one licence to track and one provenance format. Where
  VCSL holds no ideal instrument for a voice, its closest is accepted.

## Requirements

- **R1** — The `kick` voice is a bass drum, not a cajon.
- **R2** — The `rim` voice is a cross-stick, not a woodblock.
- **R3** — The `bass` voice is an electric bass.
- **R4** — The `comp` voice is an electric piano.
- **R5** — Every drum voice — `kick`, `snare`, `hatClosed`, `hatOpen` and `rim`
  — is replaced. The existing snare and hi-hats are genuine drum samples, but
  they were recorded as separate instruments from each other, which is part of
  why the kit does not sit in one space.
- **R5b** — Where VCSL holds a kit whose voices were recorded together, all five
  come from it. Where it does not, the best instrument for each voice is taken
  and the voices are made to cohere by Epic 4's shared room rather than by their
  source.
- **R5a** — Every sample comes from VCSL. Where VCSL holds no ideal instrument
  for a voice, its closest is used rather than a source from outside the
  library.
- **R6** — Both pitched voices are sampled at intervals of no more than four
  semitones across their declared register, so the renderer never shifts a
  sample by more than two — the bound under which the linear resampler is
  transparent.
- **R7** — `bass` covers sounding MIDI 22–50 and `comp` covers sounding MIDI
  46–86, with no gaps.
- **R8** — Every pitched sample's declared `midi` is its *sounding* pitch,
  established by measurement rather than read off the filename.
- **R9** — Velocity layers are not normalised. The level difference between a
  soft and a hard hit is carried by the samples themselves.
- **R10** — Every percussive voice declares at least two velocity layers, and
  every layer at least two round-robin alternates.
- **R11** — Every file in `samples/` has an entry in `provenance.json` naming
  its original VCSL path, and `samples/LICENSE.txt` remains the single licence
  covering the whole pack.
- **R12** — Every sample is mono, 44.1 kHz, FLAC, trimmed and faded, as the
  existing pipeline requires.
- **R13** — Each template's `pan` values are set for the new sources, and its
  `gain` values are rebased onto the ones Epic 3 sets for the corrected dynamics
  scaling rather than onto today's. A groove's overall loudness after mastering
  is comparable to what it is today, and no voice is inaudible or dominant
  relative to its role in the feel.
- **R14** — No groove's `id`, `bpm`, `root`, `flavour`, `scale`, `chord` or
  `progression` changes.
- **R15** — Every groove still passes the quality gate: peak, silence, seam,
  harmony and density.
- **R16** — `samples/README.md` describes the pack that is actually shipped: the
  voice-mapping table, the note spacing, and the procedure for establishing a
  sampled note's sounding pitch by measurement.
- **R17** — Nothing in `samples/` is served to the browser or enters the client
  bundle. It remains a generation-time asset.

## Behaviour details

**What is actually wrong with the pack today.** Half of it is already real, and
being precise about which half keeps this epic from being bigger than it needs
to be.

| Voice | Today | Verdict |
| :-- | :-- | :-- |
| `kick` | Cajon, bass tone | Replace — it is not a bass drum |
| `snare` | Snare Drum, Modern 1 | Replace — real, but from its own recording |
| `hatClosed` | Hi-Hat Cymbal, closed | Replace — real, but from its own recording |
| `hatOpen` | Hi-Hat Cymbal, open/loose | Replace — real, but from its own recording |
| `rim` | Woodblock | Replace — a cross-stick is a snare, not a block |
| `bass` | TX81Z FM Piano | Replace with an electric bass |
| `comp` | TX81Z Clavisynth | Replace with an electric piano |

Two of these are stand-ins for instruments they are not; the snare and hats are
genuine, and are replaced anyway. Keeping them would be a saving of work and a
cost in coherence: they are three separate VCSL instruments, recorded apart from
each other and from whatever kick arrives, and the complaint the feature exists
to answer is as much about seven samples from seven rooms as about any one of
them.

**The Clavisynth lesson outlives the Clavisynth.** VCSL's
`Clavisynth_C2_vl2.wav` sounds at C4, not C2 — there is no spectral energy at
all at the named frequency. That was caught by measuring, and had it been
assumed, every comp chord would have been two octaves out and the game
unplayable. The warning in `samples/README.md` goes when the sample does; the
*procedure* stays and is restated for whatever replaces it. R8 is that
procedure as a requirement.

**Why the layers must stay un-normalised.** The level difference between an `mp`
and an `fff` sample is the dynamic information. Epic 3 changes how that
information is used — today it is applied twice, once by layer choice and once
by an amplitude multiply — but it can only do that if the samples still carry
it. Normalising the new pack on the way in would erase what Epic 3 is being
built to read.

**Why the levels are rebased rather than set fresh.** Epic 3 fixes the doubled
dynamics and re-tunes `gain` to suit the corrected scaling, keeping the fix and
the levels it implies in one change. This epic then swaps the samples underneath
those levels, so its `gain` work starts from Epic 3's values rather than from
today's — which means this epic merges after Epic 3, or rebases onto it. `pan`
is unaffected by either and stays this epic's alone.

**When VCSL has no single kit.** Sourcing five drum voices from one recording is
the direct route to coherence, and staying inside VCSL is a fixed constraint —
so if the library holds no kit recorded together, coherence is what gives, not
the licence boundary. The fallback is the best instrument per voice, glued by
the single shared room Epic 4 adds. That is not a consolation prize: a shared
early-reflection and tail treatment is exactly the mechanism that makes
separately recorded sources sit in one space, and Epic 4 is adding it anyway.

The practical consequence is on the sign-off rather than on the work. This epic
can be built and merged on its own, but if the per-voice fallback is taken, its
*coherence* cannot be judged until Epic 4's room is in the path — so that
listening pass waits for Epic 4 and the two are signed off together.

**Repo weight.** `samples/` is committed but never served. A denser pack — more
notes, more layers, more alternates — is bought at the cost of every clone.
Audition with that in mind rather than taking every alternate on offer; R10 is a
floor, not a target.

## Acceptance criteria

- **AC1** (R1–R4) — Given `samples/README.md`'s voice-mapping table, when it is
  read, then `kick` names a bass drum, `rim` a cross-stick, `bass` an electric
  bass and `comp` an electric piano.
- **AC1a** (R5, R5b) — Given `provenance.json`, when the five drum voices'
  entries are read, then either all five name the same source kit, or the
  per-voice choice is recorded as deliberate and the coherence sign-off is taken
  with Epic 4's room in the path.
- **AC1b** (R5a) — Given `provenance.json`, when every entry is read, then every
  original path is a VCSL path.
- **AC2** (R6, R7) — Given the declared pack, when each pitched voice's sampled
  notes are listed, then they span the declared register with no gap wider than
  four semitones, and `pack.test.ts` asserts it.
- **AC3** (R8) — Given at least one sampled note per octave of each pitched
  voice, when its fundamental is measured, then it matches the declared `midi`
  within a semitone.
- **AC4** (R9) — Given any percussive voice, when the peak levels of its
  velocity layers are compared, then they differ — a pack whose layers measure
  the same has been normalised and fails.
- **AC5** (R10) — Given every percussive voice, when its declaration is read,
  then it has at least two layers and every layer at least two alternates.
- **AC6** (R11) — Given `samples/`, when its files are listed, then every one
  has a `provenance.json` entry, and `LICENSE.txt` is the only licence file.
- **AC7** (R12) — Given every file in `samples/`, when it is decoded, then it is
  mono 44.1 kHz FLAC.
- **AC8** (R13, R15) — Given the re-rendered catalogue, when the gate runs, then
  every groove passes peak, silence, seam, harmony and density; and given the
  template files, when their `gain` values are compared with Epic 3's, then this
  epic's are derived from them rather than from the pre-Epic-3 values.
- **AC9** (R14) — Given the manifest before and after, when they are diffed,
  then only `headDelaySeconds` differs; Epic 1's answer-pinning test passes
  unchanged.
- **AC10** (R16) — Given `samples/README.md`, when it is read, then it describes
  the shipped pack, and no instrument it names is absent from `pack.json`.
- **AC11** (R17) — Given the built client bundle and `public/`, when they are
  searched, then no file from `samples/` appears in either.
- **AC12** (R13) — Demo: the same seeds before and after, played back to back.
  The answers are identical, the tempos are identical, and the band is
  different.

## Dependencies

Can start immediately, but **merges after Epic 3** — its `gain` values are
rebased onto the ones Epic 3 sets for the corrected dynamics scaling. It shares
`templates/*.ts` with Epics 1 and 3 under a field contract: **this epic owns
`pan`, and has the last word on `gain` by rebasing**; Epic 3 owns `humanize`,
`density` and the first pass at `gain`; Epic 1 owns `passes`. `tempoRange`,
`swing`, `voices` and `flavours` belong to nobody until Epic 6.

It hands **Epic 5** the kit its toms must be drawn from, and it hands **Epic 3**
a pack whose layers carry usable dynamics.

If the per-voice fallback is taken, it **leans on Epic 4's room** for the
coherence R5b asks for. That is not a blocking dependency — this epic ships
without it — but the coherence listening pass is taken after Epic 4 merges.

It changes `SamplePack`'s data, not its interface. Epic 3 changes the interface
(adding the layer's nominal velocity to `get()`'s return); the two are
compatible because this epic only adds declarations.

## Assumptions

- Choosing the specific instruments is an audition decision made while doing the
  work, not one this document fixes in advance. The requirements constrain the
  *kind* of instrument and its coverage, not its name.
- An electric bass suits three of the four templates — funk, shuffle and bright
  straight-eighths — and `straight-funk`'s own doc comment describes the style
  the pack was assembled for. Half-time gets the same instrument rather than a
  second one.
- The existing FLAC preparation pipeline — trim, fade, downmix, encode — is
  reused as-is.
- `pack.ts`'s velocity-layer selection and round-robin behaviour are unchanged
  here. Epic 3 changes how the chosen sample is scaled.
- Old sample files are deleted rather than left in place. Git history holds them
  if a comparison is ever wanted.
- Whether VCSL holds a single coherent kit is settled by auditioning, not
  assumed either way in advance.

## Question log

Answered questions, kept for traceability. The requirements above are the source
of truth — this records how they got there. Append-only: never rewrite or prune
a past cycle, or the record stops being trustworthy.

### Cycle 1 — 2026-08-31

**Q1. Do the snare and hi-hats get replaced too?**
Answer: **A) Replace the whole kit from one source** — the fault is as much
seven samples from seven rooms as any one stand-in, so coherence is worth the
extra work.
Applied to: Summary, Scope, R5, AC1a, Behaviour details

**Q2. Electric bass or upright?**
Answer: **A) Electric bass** — three of the four templates are funk, shuffle and
bright straight-eighths, and the pack was assembled for that style.
Applied to: Summary, R3, AC1, Assumptions

**Q3. What if VCSL has no suitable instrument for a slot?**
Answer: **B) Stay VCSL-only and accept the closest instrument it has** — one
library, one licence, one provenance format.
Applied to: Summary, Out of scope, R5a, R11, AC1b, AC6 — replacing the cycle-1
assumption that a second source could be brought in

### Cycle 2 — 2026-08-31

**Q4. What wins if VCSL has no single coherent drum kit?**
Answer: **A) Coherence gives — take the best VCSL instrument per voice and glue
them with Epic 4's shared room** — staying inside VCSL is the decided
constraint, and Epic 4 adds exactly the mechanism that makes separately recorded
sources sit together.
Applied to: Summary, R5, R5b, AC1a, Behaviour details, Dependencies,
Assumptions — softening the cycle-1 requirement that all five drum voices come
from one source kit
