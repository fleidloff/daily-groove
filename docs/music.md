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
| Catalogue | `catalogue.json`, several seeds per feel. The count changes at every mint, so it lives there and not here |
| Identity | `{ template, seed }` and nothing else |

**A groove is a backing track.** Drums, a bass and a comp — no lead. The player
is meant to be able to play over it, so nothing occupies the register a soloist
would (`BACKING_VOICES` in `events.ts`).

Determinism is the load-bearing property: the same `{ template, seed }` must
always render the same audio and the same words describing it. Every choice —
tempo, root, flavour, harmony, which rhythm variant — is drawn from a seeded
generator, never from the clock or `Math.random`.

## The fifteen voices

`kick` · `snare` · `hatClosed` · `hatOpen` · `ride` · `rideBell` · `rim` ·
`tomHigh` · `tomLow` · `bongoHigh` · `bongoLow` · `claves` · `cowbell` ·
`bass` · `comp`

Two toms and two bongos, not three and one: the library holds a high and a low
tom, and inventing a middle one by pitching a neighbour gives a detuned copy. A
bongo *is* two drums, and the interplay between them is the sound — a single
`bongo` voice would be a hand drum.

**The ride is the bow, struck with the stick tip** — not the bell, not a
crash-ride wash. It exists to carry a pulse. Before it the kit had exactly one
way of stating time, a closed hi-hat, so every feel marked its beat identically.
A feel that takes the ride hands it that job, and its hat drops to punctuation —
see *Rhythm* below. `rideBell` is the same cymbal in the same session struck on
the bell, so a feel can accent without changing instrument.

**Three voices are in the pack and in no template.** `rideBell`, `claves` and
`cowbell` were sourced, prepared and levelled ahead of the feels that will want
them; a voice nothing plays costs a render nothing. Sourcing a voice and playing
it are two decisions, and this list records the first.

`claves` and `rim` never sound in the same groove — both are the dry, high crack
a feel reaches for once, and a kit carrying two of them has neither. A style that
wants the claves gives up its rim, so the choice falls to whichever feels declare
a rim; `bossa-nova` puts its whole clave on one.

Samples come from four libraries, two of which carry an obligation.
**MuldjordKit is CC-BY 4.0 and a rendered groove must credit "Drum samples
provided by DrumGizmo.org"**; DRSKit, which supplies the ride, is CC-BY 4.0 as
well and carries a second string of its own — **"Ride cymbal samples from
DRSKit, provided by DrumGizmo.org"**. The bongos, claves and cowbell (VCSL) and
bass/comp (VSCO 2 CE) are CC0. See `scripts/grooves/samples/README.md`, which
records why the ride is DRSKit's over a library that measured better on every
axis, and why it ships one velocity layer on purpose.

## Scales: the twelve flavours

`FLAVOURS` in `src/lib/theory/names.ts` and `INTERVALS` in
`src/lib/theory/scales.ts`.

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

`INTERVALS` carries **thirteen** scales. The thirteenth is locrian, and it is
the app's: it is spelled, quizzed and drawn on the staff, but never rendered. It
is absent from `FLAVOURS` for the reason constraint 1 gives.

Three constraints govern this list, and a new flavour has to satisfy all three:

1. **Every scale must contain a perfect fifth.** A tonic without one cannot
   state itself. The best chord `chordsForScale` can name on a locrian tonic is
   `m7♭5` — a half-diminished the ear hears as somebody else's ii — so a groove
   in it never establishes the key its own words claim. This is a musical
   exclusion, not a mechanical one: nothing throws. What keeps locrian out of
   the render is the twelve-member `FlavourSlug` union and the fact that no
   template names it.
2. **Six major thirds, six minor.** The app's simple mode grades by family, so
   an uneven split would make one answer the better blind guess — exactly the
   elimination strategy the wider pool defeats.
3. **The order is frozen.** New flavours are appended, never interleaved. The
   draw is `pick(musicRng, template.flavours)` — it indexes the template's own
   list of two to four, not `FLAVOURS` — so what re-renders is reordering or
   editing a template's `flavours`, which re-rolls that feel's mode for every
   seed on it. Appending to a list is the exception: the draw is over a longer
   array, so it re-rolls too. A `flavours` line freezes at that feel's first
   mint.
   `FLAVOURS` stays append-only because it is the declared vocabulary that the
   app's derived `FLAVOUR_INTERVALS`, every twelve-ness test and any future draw
   are graded against.

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

**Progressions** are four chords, one per bar of a pass, and start on the tonic.
The seed draws three or four; a draw of three is completed by the tonic, so bar 4
states the home chord again before the loop returns to it. Within a pass no
degree repeats back to back; across the seam the tonic may. `theory/validity.ts`
then re-checks that the words and the audio agree.

## The feels

`templates/*.ts`. A feel fixes what a human decides; the seed fixes the rest.

Each feel owns **two to four** flavours, and the sets may overlap — `ionian`
belongs to `bright-straight` and to `bossa-nova` both. `FLAVOURS_MIN`,
`FLAVOURS_MAX` and `flavourFailures` in `templates/rules.ts` are the rule; the
heading carries no count because feels are still being added.

The mode is therefore a *weaker* clue to the feel than it was, and deliberately
so. Hearing a bossa used to name the mode; now it narrows it to four. What the
rule keeps is the pair of invariants the game rests on: every flavour the app
offers has grooves behind it, and no groove answers to a flavour the app does not
offer. Twelve flavours divided into disjoint pairs left room for one feel per
pair and not one more, which is what dropping the rule bought.

| Feel | BPM | Subdiv | Swing | Flavours | Passes | Density/bar | Pulse |
| :-- | :-- | :-- | :-- | :-- | :-- | :-- | :-- |
| `straight-funk` | 94–106 | 16 | 0.18 | dorian, mixolydian | 4 | 18–44 | hat |
| `swung-sixteenth` | 106–116 | 16 | 0.44 | phrygian-dominant, harmonic-major | 4 | 16–42 | ride |
| `shuffle` | 78–92 | 8 | 0.64 | blues, aeolian | 4 | 16–38 | ride |
| `half-time` | 68–80 | 16 | 0.28 | phrygian, harmonic-minor | 2 | 14–48 | hat |
| `bright-straight` | 116–132 | 8 | 0.06 | lydian, ionian | 4 | 17–40 | hat |
| `open-ballad` | 62–74 | 8 | 0.02 | melodic-minor, lydian-dominant | 2 | 8–30 | hat |
| `bossa-nova` | 122–138 | 8 | 0.01 | ionian, lydian, dorian, melodic-minor | 4 | 20–36 | hat |
| `second-line` | 88–96 | 16 | 0.22 | mixolydian, blues, ionian, harmonic-major | 4 | 21–30 | hat |
| `boom-bap` | 86–92 | 16 | 0.34 | dorian, aeolian, phrygian | 2 | 17–33 | hat |

Two feels ride, and they are the two that genuinely swing: `swung-sixteenth` at
0.44 and `shuffle` at 0.64. The rest keep the closed hat on the pulse, where it
is the idiomatic timekeeper. `bossa-nova`'s `0.01` is the one swing value that
means *straight*: it displaces an off-eighth by about 1.1 ms, under a quarter of
that feel's 5 ms humanize bound, and it is there because the registry asserts
every feel
declares a swing of its own. Slow feels declare fewer passes: four passes at 68
bpm is a 56-second file, while `bossa-nova`'s four at 130 are half a minute.

`boom-bap` was minted with the drums over the bass — `kick −4` and `snare −3` above
every other voice, where every other feel declares its bass on top. The inversion was
the style, a struck sampled break with the rest of the band behind it, and it is
**retracted**: it put the comp 15 dB and the bass 16 dB under the kick, about 12 dB
below the quietest of the feels that predate it, and a listening pass on
`groove-71` … `groove-76` rejected it. The comp states the chord and the bass states
the root; they are the two voices carrying the answer, and a mix that buries them is
not a stylistic choice this app can afford. Both feels' kits were dropped by a uniform
offset — 7 dB on `boom-bap`, 5 dB on `second-line`, which had the same defect one step
less severe — so every relationship inside each kit is exactly the one that was
declared, and only the kit-against-band balance moved. Both now measure comp −2.6 dB
and bass −5.1 dB against their own kick, which are `straight-funk`'s figures.
`boom-bap`'s comp plays one stab a bar, on an even sixteenth, so the chord lands
unswung while the kit swings at 0.34 around it. Two
passes, so there is no middle pass and the loop declares a fill bar and no
variation bar — which is also why two. The kit carries no toms, so
`withoutToms(DEFAULT_FILL)` is the fill itself, and a three-pass loop would play
that bar twice rather than thin it. See *Fills* below.

`half-time` and `open-ballad` were considered for the ride and **declined**. At
swing 0.28 and 0.02 they are straight in all but name, so a ride over either
would be a cymbal laid over a straight groove rather than a jazz pulse; they keep
their hat, their kick and their committed renders. That is recorded here so the
next reader does not re-add them as an oversight.

**Swing** is off-beat displacement: `0` straight, `1` lands on the next on-beat,
a triplet shuffle ≈ `0.67`. An off-beat is delayed by `swing × half a
subdivision`.

## Rhythm

Everything is written on a **sixteenth grid** (`PATTERN_RESOLUTION = 16`) and
resolved onto the feel's own subdivision by `gridSteps`, so an eighth-note feel
plays the same phrase at its own resolution.

**Drawn per seed** — the variable part. Each pool below is the shared one, used
by every feel that does not override it; a feel may declare `patterns` of its own
and replace any of them for itself alone (`PatternPools` in `types.ts`,
`assertPatterns` in `patterns.ts`). An eighth key, `patterns.kit`, has no shared
pool behind it: it draws the ordinary bar's snare line, and it is the one
override that opens an RNG stream, `KIT_LABEL`.

| Pool | Options | Notes |
| :-- | :-- | :-- |
| `KICK_PATTERNS` | 5 | |
| `HAT_PATTERNS` | 3 | eighths, sixteenths, or a broken figure — when the hat keeps time |
| `HAT_PUNCTUATION_PATTERNS` | 3 | when a ride keeps time instead. Every figure holds beats 2 and 4, 2–4 a bar |
| `RIDE_PATTERNS` | 3 per subdivision | keyed by the feel's subdivision — 3 figures for 8, 3 for 16. Every figure keeps every quarter and outnumbers the busiest foot hat |
| `BASS_PATTERNS` | 4 | |
| `SNARE_GHOST_PATTERNS` | 5 | every step odd — a ghost fills the space *between* backbeats |
| `BONGO_PATTERNS` | 4 | sparse, off the strong positions, always across both drums |
| `COMP_PATTERNS` | 4 | |

**Who keeps time.** A feel that declares `ride` hands the pulse to it, drops
`hatOpen` from the kit entirely, and its closed hat falls back to
`HAT_PUNCTUATION_PATTERNS` — two to four points a bar, every figure holding beats
2 and 4. That is the left foot, not a subdivision, which is what handing the time
over is meant to leave behind. Ride figures are denser than hat punctuation by
construction, because on a riding feel that voice *is* the pulse. The ride sits
out the fill bar and reduces to quarters in the thinned variation bar, so a fill
lands in the space the cymbal leaves; the foot hat plays its figure in both.

This document used to say that hat played off-sixteenths, and gave as the reason
that it must never mark a position the ride was already using. That reason was
**wrong** — not too narrow, wrong — and it is retracted rather than reworded. A
ride playing eighths lands on beats 2 and 4 along with the foot hat, and a ping
and a foot together on the backbeat is the sound a drummer is after, not a
collision. What had to go was the hat *stating a subdivision*, which is the job
the ride was handed; where its two to four points fall was never the problem.

**Feathering.** A riding feel's kick carries a *feather* under the drawn
`KICK_PATTERNS` figure: the quarter notes the figure left empty, in every bar of
the loop, struck below the `0.5` threshold that separates a ghost from a
backbeat. It is fixed placement computed from the bar's own kick steps rather
than a drawn pool, so it costs no randomness, re-keys nothing and needs no new
sample. Where the drawn figure already carries a quarter, that hit stands at its
own velocity and no feather is added under it — the drawn figure is the groove
and the feather is the floor beneath it. Feathering reaches exactly the feels the
ride does: it is the other half of one jazz gesture, not a second improvement
that can be taken on its own.

Accent cycles run over each voice's own hits and are deliberately coprime with
the bar so they never fall into lockstep: `HAT_ACCENTS` (4 entries),
`BONGO_ACCENTS` (4), `RIDE_ACCENTS` (3, and shallower — a wavering pulse is worse
than a flat one).

**Fixed per feel** — `DEFAULT_PLACEMENT`: snare on `[4, 12]`, open hat on `[14]`,
rim pickup on `[15]` in bars 1 and 3. A groove whose backbeat moves is a
different groove, not the same one in another key, so these are not drawn.
`PLACEMENTS` overrides per feel, and a key **replaces** the default line rather
than merging with it: `half-time` plays one snare on beat three (`[8]`) — the
wide backbeat that is the whole reason the table exists — and `bright-straight`
moves the rim pickup to `[14]` and to bar 3 alone. `second-line` spends it on the
rim: its key moves the cross-stick from the `[15]` pickup in bars 1 and 3 to
`[13]`, the "e" of 4, in every bar of the cycle, which turns a pickup into the
turnaround click the figure sets up.

**Velocity by metric position** (`VELOCITIES`): `strong` on quarters, `medium` on
off-eighths, `weak` on off-sixteenths. The backbeat lands above every hat around
it; the hats' off-positions fall into ghost territory. Ghosts are struck at
`0.15–0.25`, well under the `0.5` threshold that separates a ghost from a
backbeat.

**Fills.** The last bar of the final pass plays a fill. A feel with an entry in
`FILLS` plays its own; every other feel plays `DEFAULT_FILL`, which resolves on
the snare, never a crash — the downbeat after a fill *is* position zero of the
file, so a crash there would be heard at the top of every playback before any
fill had played.

**The variation** is the middle pass's last bar, thinned. It exists only on loops
of three or more passes — `middlePassOf` returns `null` below three, so a feel
that declares two passes renders a fill bar and no variation bar at all, which is
`boom-bap`'s case. Where it does exist it is the feel's own declared `variation`
if it has one, and its fill with the toms taken out if it has not. A feel
declares one when thinning by toms alone would say nothing: `bossa-nova` carries
no toms, so `withoutToms(fill)` would hand back the fill unchanged, and
`second-line`'s ordinary bars already carry toms, so its thinning has to be
visible against them rather than against the fill — its variation changes the
kick, cuts the snare to four steps and brings back the open hat and the
turnaround rim that its fill drops.

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

`gate.ts`. A minted candidate enters the catalogue only if all seven checks pass.
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

The loudness band is wide on purpose. The feels span −27.1 dB (`half-time`) to
−21.4 dB (`bossa-nova`, measured over sixty candidates), and closing that spread
means re-balancing voices by ear. The band accommodates the measured spread rather than asserting a balance
nobody has listened to. It is a guard against gross error — a voice left at the
wrong gain — not a mastering tolerance.

## What the gate cannot do

**Nothing here can hear.** The gate measures loudness, peak, silence, seams,
harmony, off-scale pitches and density. None of those is whether a groove is any good, and
a groove can pass all seven and be dull, cluttered, or simply not a groove.

The tuning knobs that decide this — swing, `timingMs`, `velocity`, `lean`,
`driftDepth`, and the per-voice gains — **are turned by a listening sign-off**, by
a person, and `straight-funk.ts` says so in as many words. Propose values and say
what you expect them to do; do not report that the result sounds good.

## What must never change

These are re-releases, not refactors. Each silently rewrites history that players
already hold.

**The audio itself is not on this list.** Re-rendering every MP3 is always
allowed, and so is changing what a groove *is* — its chords, its feel, its
style — when the new one is better. A groove is a slot, not a record: it keeps
its `uuid` and whatever is behind it today is the answer. Don't weigh a sound
improvement against the catalogue it invalidates; ship the better sound. What
stays frozen below is identity — which seed, which draw order, which link — not
content.

- **`src/lib/hash.ts`.** Seeds the generator's RNG *and* picks the player's
  groove of the day. Change one character and every groove re-renders **and**
  every past date is reassigned a different puzzle. Pinned by a fixed table in
  `hash.test.ts` — if that table fails, restore the function.
- **`MUSIC_LABEL = 'events'`** and its draw order. Every committed answer derives
  from this exact string, drawn in exactly this order. Nothing may be added to
  this stream; new randomness goes on `RHYTHM_LABEL`, `GHOST_LABEL`,
  `BONGO_LABEL`, `RIDE_LABEL`, `KIT_LABEL`, or a new labelled stream of its own.
  This is why the bongos, the ride and the drawn snare line each got one —
  inserting a draw into `rhythmRng` would have re-rolled the rhythm of every
  committed groove, including the feels that play neither voice.
- **The order of `FLAVOURS`** in `src/lib/theory/names.ts`, and **each
  template's own `flavours` list**. The draw indexes the template's list, so
  that is the one that re-renders; `FLAVOURS` is append-only because it is the
  vocabulary every other list is checked against.
- **A groove's `uuid`**, minted once into `catalogue.json`. Links point at it.

**What deliberately may.** `ROTA_EPOCH` in
`src/features/daily-groove/lib/puzzle/selectGroove.ts` is the one value in the
rota that is *meant* to move. Bumping it remaps every unplayed date, past and
future, to a different groove. It re-renders nothing and reassigns no answer: it
changes a seed string, not `hashString`, so `src/lib/hash.ts` and its fixed table
are untouched and this is a reshuffle rather than one of the re-releases above.
Every release that mints grooves bumps it, so the whole catalogue reshuffles
instead of new grooves being appended to an order players already know. A date
the player has already played keeps its groove, pinned from the stored result.

`grooves.lock.json` and `npm run grooves:verify` (which runs on `prebuild`) exist
to catch a violation.

## Where to change what

| To change… | Edit |
| :-- | :-- |
| tempo, swing, voices, passes, density, gain, pan of a feel | `templates/<feel>.ts` |
| which modes a feel carries | `templates/<feel>.ts` → `flavours` |
| add a mode | `src/lib/theory/names.ts` (append only), `src/lib/theory/scales.ts`, `theory/validity.ts`, and one template's `flavours` |
| chord vocabulary or progression rules | `theory/harmony.ts` |
| kick / hat / bass / ghost / bongo / comp figures, for every feel at once | the pattern pools in `events.ts` |
| the same figures for **one** feel only | `templates/<feel>.ts` → `patterns`. A declared pool **replaces** the shared one for that voice, never extends it, so the pools stay the length every committed draw expects |
| a figure that never varies — a clave, a two-bar ostinato, a once-a-pass tom accent | `templates/<feel>.ts` → `figures`: one step list per bar of the cycle, drawn from no pool and played through fills. `PLACEMENTS` is the answer only for a one-bar override of an existing placement line; anything longer than a bar is a `figures` entry, and a `figures` entry on `rim` or `hatOpen` suppresses that voice's placement line for the feel |
| backbeat, open hat, rim placement | `DEFAULT_PLACEMENT` / `PLACEMENTS` in `events.ts`. A feel whose snare line varies per seed instead declares `patterns.kit` — one or the other, never both |
| fills | `DEFAULT_FILL` / `FILLS` in `events.ts` |
| bass register and behaviour | `BASS_*` constants in `events.ts` |
| comp register, voicing, spread | `COMP_*` constants and `voiceLead` in `events.ts` |
| timing feel, lean, drift | `humanize.ts` and the template's `humanize` block |
| reverb, peak ceiling, bus behaviour | `mix.ts` |
| what gets rejected | `gate.ts` |
| the track a scale is heard in, shown on the reveal | `heard-in.json`, keyed by `Groove.scale`; `npm run grooves -- --manifest-only` re-renders it |
| add a voice | `types.ts` (`VoiceName`), samples, `samples/pack.json`, every template's `gain`/`pan`, a pattern, and its own RNG stream label |
| the daily order, after minting grooves | `ROTA_EPOCH` in `src/features/daily-groove/lib/puzzle/selectGroove.ts` — bump it by one, every release that mints |

After any change to what the audio contains, re-render and re-verify:
`npm run grooves` then `npm run grooves:verify`. Generator tests are
`scripts/**` — see [testing.md](testing.md).
