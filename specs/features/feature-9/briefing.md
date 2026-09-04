* natural feel
* we will improve the groove creation so that grooves feel more natural
* existing grooves get updated as well with new groove creation mechanisms
* get rid of the freeze rule in README. We are still in development and it creates problems
* add more different templates for groove creation
* 

## Simple ways to make the grooves feel natural

Cheapest first. Every one of these is a change inside `scripts/grooves/`; none
of them touch the app.

* **per-voice timing offsets** — one seeded millisecond offset per voice per
  groove, on top of the existing jitter: snare 8–15 ms behind the grid (laid
  back), hats a hair ahead (pushing). Single biggest win for the least code.
* **correlated jitter instead of white noise** — `humanize.ts` currently draws
  an independent deviation for every event, which reads as sloppiness rather
  than as feel. Consecutive hits should move together (slow random walk over
  the bar), and the bass should lock to the kick rather than roll its own dice.
* **gaussian instead of uniform deviations** — uniform makes the extremes as
  likely as the centre, which no player does.
* **fix the doubled dynamics** — `pack.ts` picks the velocity layer by
  velocity, then `voices.ts` multiplies the sample by velocity *again*. The
  layers were deliberately not normalised, so their loudness is already the
  data. The dynamic range ends up squared (ghosts vanish, accents shout) and
  every layer boundary is an audible level step — with humanize jittering
  across it, a hat sitting near a boundary flips layers hit to hit. Scale
  relative to the layer's nominal velocity instead.
* **real snare ghost notes** — the snare only ever plays the backbeat today.
  Ghosts on off-sixteenths at 0.15–0.25 are what separate a drummer from a
  drum machine in funk.
* **accent shapes for the hats** — a repeating 2- or 4-step accent pattern
  rather than `velocityFor()`'s pure function of metric position, so not every
  downbeat is 0.98 forever.
* **note-offs** — `durationSec` is decorative right now: `addAt` copies the
  whole sample regardless. A short release fade at `timeSec + durationSec`
  gives us articulation (staccato vs sustained), stops comp chords blurring
  across bar lines, and lets a closed hat **choke** a ringing open hat.
* **comp voicings that sound like hands** — `inCompRegister()` folds every
  chord tone independently, so the voicing re-inverts at random on each chord
  change. Fold to minimise motion from the previous chord (voice-leading),
  spread the chord 5–15 ms (a strum), shape velocity within the chord (top
  voice up, inner voices down), and drop the root — the bass already has it.
* **bass lines instead of arpeggios** — `chord[i % chord.length]` walks the
  chord tones in fixed order inside a single octave. Add repeated roots,
  octave jumps, rests, and a chromatic approach into the next bar's root.
* **a shared room** — one reverb send on the bus in `mix.ts` (short room,
  ~0.6 s, plus early reflections). Seven dry samples glued only by panning
  never sound like one band in one room.
* **a breath of tempo drift** — ±0.3–0.8 % across the loop, with an envelope
  that returns to zero at the loop point so the seam and the loop
  visualisation are unaffected.
* **better samples, eventually** — the ceiling on all of the above is the pack:
  the kick is a cajon, the bass an FM piano, the comp a clavisynth, the rim a
  woodblock. A real kit, an upright or electric bass and a Rhodes (VCSL is CC0,
  same source as what we already ship) would be worth more than any three
  items in this list. Bigger scope; do it last or as its own epic.

## Variations: 16-bar loops with a fill

**The shape:** a groove becomes four passes of its four-bar figure rendered as
one 16-bar loop, with a fill in bar 16 (and optionally a lighter variation in
bar 8). We keep playing one file on one looping buffer.

* **every pass is drawn fresh** — new humanize deviations and new round-robin
  alternates per pass. This matters more than the fill itself: today the
  repeats are *bit-identical*, so the ear locks onto the loop within two cycles
  because the transients are literally the same bytes.
* **the player does not change** — `audio.ts` still runs one
  `AudioBufferSourceNode` with `loopStart`/`loopEnd`, `loop.ts` still derives
  position arithmetically, and `mix.ts`'s overhang fold still closes the seam
  (fold the bar past bar 16 onto bar 1). Only `loopSeconds` gets bigger.
* **still shown as a 4-bar loop** — the visualisation keeps its four-bar ring
  and gains a repeat indicator (*3 of 4*), rather than stretching to sixteen
  bars. The manifest carries `loopBars: 16` alongside the musical `bars: 4` so
  the two ideas stay separate.
* **file size** — ~900 KB per groove at the current 192 kbps, up from ~225 KB.
  Only today's groove is fetched, so it is a per-visit cost and not a bundle
  cost; drop to 128 kbps (~600 KB) if that feels heavy.
* **we need toms and a crash** — the pack has neither, and a fill without them
  is limited to snare sixteenths and ghosts. Pull them from VCSL (CC0, same
  library we already use), add the mapping to `pack.json` and the entries to
  `provenance.json`. The open hat can stand in for a crash until then, but the
  downbeat payoff after a fill really wants a cymbal.
* **fills live per template** — model them the way `PLACEMENTS` in `events.ts`
  already models the half-time backbeat: a small fill vocabulary next to the
  rule it varies, rather than a new field on the frozen `FeelTemplate`.
* **this needs the freeze rule gone** (above) — every existing groove
  re-renders at a new length with new audio.
