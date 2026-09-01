# Music

How a groove is made, and which decisions are musical rather than technical.

This is the reference for anyone — person or agent — changing what the grooves
*sound like*. [architecture.md](architecture.md) governs where code lives and
[coding-guidelines.md](coding-guidelines.md) how it is written; neither says
anything about music. This does, and nothing else in the repo does.

Everything here lives under `scripts/grooves/`. None of it ships to the browser:
the generator renders MP3s offline and commits them, so the app plays audio and
never makes it.

## The shape of a groove

A groove is **four bars of 4/4**, rendered as several identical-length passes of
that figure and looped seamlessly.

| | |
| :-- | :-- |
| Figure | 4 bars, 4/4 (`BARS_PER_PASS`, `BEATS_PER_BAR` in `events.ts`) |
| Passes | 2–4, declared per feel. Never 1 — one pass is a loop that repeats byte for byte, which is what passes exist to replace |
| Catalogue | 30 grooves: 6 feels × 5 seeds |
| Identity | `{ template, seed }` and nothing else |

**A groove is a backing track.** Drums, a bass and a comp — no lead. The player
is meant to be able to play over it, so nothing occupies the register a soloist
would (`BACKING_VOICES` in `events.ts`).

Determinism is the load-bearing property: the same `{ template, seed }` must
always render the same audio and the same words describing it. Every choice —
tempo, root, flavour, harmony, which rhythm variant — is drawn from a seeded
generator, never from the clock or `Math.random`.

## The twelve voices

`kick` · `snare` · `hatClosed` · `hatOpen` · `ride` · `rim` · `tomHigh` ·
`tomLow` · `bongoHigh` · `bongoLow` · `bass` · `comp`

Two toms and two bongos, not three and one: the library holds a high and a low
tom, and inventing a middle one by pitching a neighbour gives a detuned copy. A
bongo *is* two drums, and the interplay between them is the sound — a single
`bongo` voice would be a hand drum.

**The ride is the bow, struck with the stick tip** — not the bell, not a
crash-ride wash. It exists to carry a pulse. Before it the kit had exactly one
way of stating time, a closed hi-hat, so every feel marked its beat identically.
A feel that takes the ride hands it that job, and its hat drops to punctuation —
see *Rhythm* below.

Samples come from three libraries, one of which carries an obligation:
**MuldjordKit is CC-BY 4.0 and a rendered groove must credit "Drum samples
provided by DrumGizmo.org"**. The bongos (VCSL) and bass/comp (VSCO 2 CE) are
CC0. See `scripts/grooves/samples/README.md`.

## Scales: the twelve flavours

`FLAVOURS` and `INTERVALS` in `theory/scales.ts`.

| Flavour | Semitones | Third |
| :-- | :-- | :-- |
| ionian | 0 2 4 5 7 9 11 | major |
| aeolian | 0 2 3 5 7 8 10 | minor |
| dorian | 0 2 3 5 7 9 10 | minor |
| mixolydian | 0 2 4 5 7 9 10 | major |
| lydian | 0 2 4 6 7 9 11 | major |
| phrygian | 0 1 3 5 7 8 10 | minor |
| harmonic-minor | 0 2 3 5 7 8 11 | minor |
| blues | 0 3 5 6 7 10 | minor (6 notes) |
| melodic-minor | 0 2 3 5 7 9 11 | minor |
| lydian-dominant | 0 2 4 6 7 9 10 | major |
| phrygian-dominant | 0 1 4 5 7 8 10 | major |
| harmonic-major | 0 2 4 5 7 8 11 | major |

Three constraints govern this list, and a new flavour has to satisfy all three:

1. **Every scale must contain a perfect fifth.** Without one, `chordsForScale`
   finds no quality the scale wholly contains, `buildHarmony` throws, and the
   groove cannot state its own harmony. Locrian and the symmetric scales fail
   here, which is why they are absent.
2. **Six major thirds, six minor.** The app's simple mode grades by family, so
   an uneven split would make one answer the better blind guess — exactly the
   elimination strategy the wider pool defeats.
3. **The order is frozen.** A seed's flavour draw indexes into `FLAVOURS`, so
   reordering it re-renders the whole catalogue under unchanged entries. New
   flavours are appended, never interleaved.

`blues` is the awkward one by design: six notes, not seven, so anything that
assumes seven degrees has to cope.

## Harmony

`theory/harmony.ts`. Chords are voiced from `CHORD_OCTAVE = 4`.

**The derivation rule:** a chord on a scale degree is *the first quality in
`QUALITIES`, richest first, whose every interval the scale already contains*.
Stacking thirds by index would not survive the six-note blues scale; this does.
A degree carrying no nameable in-scale chord is simply absent, so a progression
can only draw on chords the scale actually supports.

`QUALITIES`, in priority order: `maj7` `m7` `7` `mMaj7` `m7♭5` `dim7` `maj7♯5`
`6` `m6` `7sus4` (triads) `` `m` `dim` `aug` `sus4` `sus2` `5`.

The table doubles as the parser's, so `chordNameFor` and `pitchClassesOf` are
inverses — the manifest can never name pitches the events do not play.

**Idioms** override derivation where the honest chord is not the derivable one.
`blues` is the only entry: its I, IV and V are dominant sevenths whose major
third the six-note scale does not hold, so they are stated. Deriving them would
give m7 and sus4 shapes — in the scale, but not a blues. Harmonic minor needs no
idiom: its raised seventh is a scale tone, so V7 and vii°7 fall out naturally.

**Progressions** start on the tonic and run 3–4 chords, never repeating the
previous degree back to back. `theory/validity.ts` then re-checks that the words
and the audio agree.

## The six feels

`templates/*.ts`. A feel fixes what a human decides; the seed fixes the rest.
Each feel owns exactly two flavours, disjoint across the set — so the mode is a
clue to the feel and vice versa.

| Feel | BPM | Subdiv | Swing | Flavours | Passes | Density/bar | Pulse |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `straight-funk` | 94–106 | 16 | 0.18 | dorian, mixolydian | 4 | 18–44 | hat |
| `swung-sixteenth` | 106–116 | 16 | 0.44 | phrygian-dominant, harmonic-major | 4 | 16–42 | ride |
| `shuffle` | 78–92 | 8 | 0.64 | blues, aeolian | 4 | 16–38 | ride |
| `half-time` | 68–80 | 16 | 0.28 | phrygian, harmonic-minor | 2 | 14–48 | ride |
| `bright-straight` | 116–132 | 8 | 0.06 | lydian, ionian | 4 | 17–40 | hat |
| `open-ballad` | 62–74 | 8 | 0.02 | melodic-minor, lydian-dominant | 2 | 8–30 | ride |

Four of the six ride. The two that do not are the two straight feels, where a
closed hat is the idiomatic timekeeper. `bright-straight` is the only feel with
bongos, and the only one besides `straight-funk` with a rim. Slow feels declare
fewer passes: four passes at 68 bpm is a 56-second file.

**Swing** is off-beat displacement: `0` straight, `1` lands on the next on-beat,
a triplet shuffle ≈ `0.67`. An off-beat is delayed by `swing × half a
subdivision`.

## Rhythm

Everything is written on a **sixteenth grid** (`PATTERN_RESOLUTION = 16`) and
resolved onto the feel's own subdivision by `gridSteps`, so an eighth-note feel
plays the same phrase at its own resolution.

**Drawn per seed** — the variable part:

| Pool | Options | Notes |
| :-- | :-- | :-- |
| `KICK_PATTERNS` | 5 | |
| `HAT_PATTERNS` | 3 | eighths, sixteenths, or a broken figure — when the hat keeps time |
| `HAT_PUNCTUATION_PATTERNS` | 3 | when a ride keeps time instead. Every step odd, 2–3 a bar |
| `RIDE_PATTERNS` | 3 | eighths, eighths over a quarter skeleton, and a swung-eighth figure |
| `BASS_PATTERNS` | 4 | |
| `SNARE_GHOST_PATTERNS` | 5 | every step odd — a ghost fills the space *between* backbeats |
| `BONGO_PATTERNS` | 4 | sparse, off the strong positions, always across both drums |
| `COMP_PATTERNS` | 4 | |

**Who keeps time.** A feel that declares `ride` hands the pulse to it and the hat
drops to `HAT_PUNCTUATION_PATTERNS` — off-sixteenths only, so the hat cannot mark
a position the ride is using. A hat playing every off-beat would still be marking
a subdivision, which is exactly what handing the time over is meant to stop. Ride
figures are denser than hat punctuation by construction, because on a ride feel
that voice *is* the pulse.

Accent cycles run over each voice's own hits and are deliberately coprime with
the bar so they never fall into lockstep: `HAT_ACCENTS` (4 entries),
`BONGO_ACCENTS` (4), `RIDE_ACCENTS` (3, and shallower — a wavering pulse is worse
than a flat one).

**Fixed per feel** — `DEFAULT_PLACEMENT`: snare on `[4, 12]`, open hat on `[14]`,
rim pickup on `[15]` in bars 1 and 3. A groove whose backbeat moves is a
different groove, not the same one in another key, so these are not drawn.
`PLACEMENTS` overrides per feel: `half-time` plays one snare on beat three
(`[8]`) — the wide backbeat that is the whole reason the table exists.

**Velocity by metric position** (`VELOCITIES`): `strong` on quarters, `medium` on
off-eighths, `weak` on off-sixteenths. The backbeat lands above every hat around
it; the hats' off-positions fall into ghost territory. Ghosts are struck at
`0.15–0.25`, well under the `0.5` threshold that separates a ghost from a
backbeat.

**Fills.** The last bar of the final pass plays a fill; on loops of three or more
passes the middle pass's last bar plays a thinned *variation* (the same phrase
with its toms removed). `DEFAULT_FILL` resolves on the snare, never a crash —
the downbeat after a fill *is* position zero of the file, so a crash there would
be heard at the top of every playback before any fill had played.

## Voicing

**Bass** — `BASS_BASE_MIDI = 24` (C1), deliberately below the instrument's floor
so roots that fit down there sit down there; only C, C♯, D and D♯ come up an
octave. Hard floor at `28` (the open low E of a four-string, true of upright and
electric alike) — the octave move is *skipped*, never clamped, because a note
pushed back up to the floor is a different note. Ceiling `48`, under the comp.

Three things a bass player does that an arpeggiator does not, drawn per note:
rest (`0.18`), repeat (`0.4`), octave lift (`0.32`). **The downbeat is exempt
from all three** — always the bar's root, in the base octave. It anchors the bar,
the comp's rootless voicing depends on it, and an approach note in the bar before
resolves onto it.

**Comp** — folded into a fixed window, MIDI `55–76`, so a groove in B does not
sit a major seventh above one in C. The ceiling keeps it out of the soloist's
register; the floor keeps it above the bass.

*Voice-leading* is the most audible thing in the arrangement. Each tone can sit
at one of two octaves in a 21-semitone window, so a seventh chord has sixteen
voicings; `voiceLead` walks all of them and keeps the one that moves least from
the previous chord, measured ascending voice by ascending voice. Ties leave the
independent fold in place, so the answer is a function of the pitches and not of
search order. Bar one has nothing to lead from, so it is the plain fold — which
is what keeps `music.chord` naming bar one's pitches exactly.

*Rootless when the bass has it:* a four-pitch-class chord drops its root if the
bass is sounding it. Two instruments on the same root is the doubling that makes
an arrangement sound stacked; the third and seventh name the chord. A triad
keeps its root — a triad minus its root is two notes.

*Spread and shape:* the chord is rolled over 5–15 ms, drawn once per groove —
enough that the notes do not begin on the same sample, not so much that it reads
as an arpeggio. Each voice below the top is 12% quieter than the one above, so
the top voice is the melody a listener follows.

## Feel: how the grid becomes a performance

`humanize.ts` — four pure functions applied in order, every deviation seeded.

- **Swing** displaces off-beats.
- **Humanize** nudges timing and velocity within `timingMs` / `velocity` bounds.
  Kick and bass share a timing walk, because a rhythm section locks together.
  Deviations are three summed uniform draws — concentrated near zero, so a large
  error is rare rather than as likely as a small one.
- **Lean** is different in kind: a constant signed offset per voice, in
  milliseconds. Negative pushes, positive lays back. This is what a listener
  hears as "behind the beat". Every feel declares its own — a shuffle and a
  half-time groove do not lay back by the same amount. The snare leans latest
  everywhere (5–15 ms); hats push.
- **Drift** lets the tempo breathe within a pass and return: late through the
  first half, early through the second, zero at both ends so the loop still
  closes.

Round-robin alternates are chosen so a pass never replays its predecessor's.

## Mix

Per-voice `gain` (dBFS) and `pan` (−1…+1) are declared per feel — the same voice
sits differently in a ballad than in a funk. A shared room reverb runs at
`ROOM_SEND = 0.18`.

Masters normalise **true peak onto `PEAK_CEILING = 0.891`** (≈ −1 dBFS). Because
peak is pinned, RMS is a function of crest factor: the loudness spread across the
catalogue is a *balance* question, not a master-trim one.

## The quality gate

`gate.ts`. A minted candidate enters the catalogue only if all six checks pass.
Every failure names the check *and* the value measured.

| Check | Rule |
| :-- | :-- |
| Loudness | RMS within **−29…−20 dBFS** |
| Peak | true peak ≤ `0.891` (+1e-4 tolerance), stored peak below full scale |
| Silence | true peak ≥ `0.01` **and** RMS ≥ `0.001` |
| Seam | loop-point discontinuity ≤ `0.02` |
| Harmony | `isValidHarmony` — the chords are legal in the named scale |
| Pitch | no event sounds a pitch outside the scale |
| Density | events per bar inside the feel's declared band |

The loudness band is wide on purpose. The six feels span −27.1 dB (half-time) to
−22.1 dB (bright-straight), and closing that spread means re-balancing voices by
ear. The band accommodates the measured spread rather than asserting a balance
nobody has listened to. It is a guard against gross error — a voice left at the
wrong gain — not a mastering tolerance.

## What the gate cannot do

**Nothing here can hear.** The gate measures loudness, peak, silence, seams,
off-scale pitches and density. None of those is whether a groove is any good, and
a groove can pass all six and be dull, cluttered, or simply not a groove.

The tuning knobs that decide this — swing, `timingMs`, `velocity`, `lean`,
`driftDepth`, and the per-voice gains — **are turned by a listening sign-off**, by
a person, and `straight-funk.ts` says so in as many words. Propose values and say
what you expect them to do; do not report that the result sounds good.

## What must never change

These are re-releases, not refactors. Each silently rewrites history that players
already hold.

- **`src/lib/hash.ts`.** Seeds the generator's RNG *and* picks the player's
  groove of the day. Change one character and every groove re-renders **and**
  every past date is reassigned a different puzzle. Pinned by a fixed table in
  `hash.test.ts` — if that table fails, restore the function.
- **`MUSIC_LABEL = 'events'`** and its draw order. Every committed answer derives
  from this exact string, drawn in exactly this order. Nothing may be added to
  this stream; new randomness goes on `RHYTHM_LABEL`, `GHOST_LABEL`,
  `BONGO_LABEL`, `RIDE_LABEL`, or a new labelled stream of its own. This is why
  the bongos and the ride each got one — inserting a draw into `rhythmRng` would
  have re-rolled the rhythm of all thirty grooves, including the feels that play
  neither voice.
- **The order of `FLAVOURS`.**
- **A groove's `uuid`**, minted once into `catalogue.json`. Links point at it.

`grooves.lock.json` and `npm run grooves:verify` (which runs on `prebuild`) exist
to catch a violation.

## Where to change what

| To change… | Edit |
| :-- | :-- |
| tempo, swing, voices, passes, density, gain, pan of a feel | `templates/<feel>.ts` |
| which modes a feel carries | `templates/<feel>.ts` → `flavours` |
| add a mode | `theory/scales.ts` (append only), `theory/validity.ts` |
| chord vocabulary or progression rules | `theory/harmony.ts` |
| kick / hat / bass / ghost / bongo / comp figures | pattern pools in `events.ts` |
| backbeat, open hat, rim placement | `DEFAULT_PLACEMENT` / `PLACEMENTS` in `events.ts` |
| fills | `DEFAULT_FILL` / `FILLS` in `events.ts` |
| bass register and behaviour | `BASS_*` constants in `events.ts` |
| comp register, voicing, spread | `COMP_*` constants and `voiceLead` in `events.ts` |
| timing feel, lean, drift | `humanize.ts` and the template's `humanize` block |
| reverb, peak ceiling, bus behaviour | `mix.ts` |
| what gets rejected | `gate.ts` |
| add a voice | `types.ts` (`VoiceName`), samples, `samples/pack.json`, every template's `gain`/`pan`, a pattern, and its own RNG stream label |

After any change to what the audio contains, re-render and re-verify:
`npm run grooves` then `npm run grooves:verify`. Generator tests are
`scripts/**` — see [testing.md](testing.md).
