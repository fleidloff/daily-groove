import type { FeelTemplate } from '../types.ts'

// A second line inverts the two things every other feel here assumes. The snare is the
// figure rather than a backbeat, so the line comes from patterns.kit and PLACEMENTS
// declares no snare at all; and the toms answer that figure in every bar rather than
// waiting for the fill.
//
// Three dynamic levels do the work, and they fall out of VELOCITIES' metric shape
// rather than being declared: a snare step on a quarter reads strong (1.0), one on an
// even off-sixteenth reads medium (0.7), one on an odd sixteenth reads weak (0.45).
// That is a parade snare part written the way it is played — accents, taps, and the
// ghost line under both. Every figure below therefore states exactly one quarter, so
// the bar has one accent to hang on.
export const secondLine: FeelTemplate = {
  id: 'second-line',
  // A brass band walks. Below 88 the sixteenth taps turn into a dirge; above 96 the
  // roll stops being a roll and starts being a machine.
  tempoRange: [88, 96],
  subdivision: 16,
  // Between straight-funk's 0.18 and half-time's 0.28, which is where this style
  // actually sits: the sixteenths lilt, they do not shuffle. At 92 bpm a sixteenth
  // step is 163 ms, so 0.22 delays an odd sixteenth by 18 ms — audible as roll,
  // nowhere near a triplet (0.67 would be 54 ms).
  swing: 0.22,
  // mixolydian and blues are the style's own — the one-chord dominant vamp and the
  // R&B it came out of. ionian is the hymn half of the repertoire, played as a march
  // on the way out. harmonic-major is the thinnest claim of the four and is here
  // partly for headroom against the answer-dominance cap: it is a major tonic with a
  // borrowed flat six, which is the one colour in the tradition that is major without
  // being bright.
  flavours: ['mixolydian', 'blues', 'ionian', 'harmonic-major'],
  voices: ['kick', 'snare', 'hatClosed', 'hatOpen', 'rim', 'tomHigh', 'tomLow', 'bass', 'comp'],
  humanize: {
    // Looser than straight-funk's 9 ms: this is a street band, not a studio.
    timingMs: 11,
    // Held under 0.05 on purpose. A snare tap on an odd sixteenth is nominally 0.45,
    // and every velocity-classified reading of a groove — GHOST_VELOCITY_THRESHOLD —
    // splits at 0.5. A wider bound would let the same tap read as a figure note in one
    // bar and a ghost in the next, which would make this feel's rendered bars differ
    // from pass to pass for no musical reason.
    velocity: 0.04,
    // The snare drags, which is what makes the figure roll rather than march; the toms
    // and the rim answer it and drag with it, less far. The hats push, as everywhere.
    lean: { snare: 12, tomHigh: 6, tomLow: 6, rim: 8, hatClosed: -3, hatOpen: -3 },
    driftDepth: 0.008,
  },
  gain: {
    // The whole kit sits 5 dB below where it was minted — a uniform offset, so every
    // relationship between two drums below is exactly the one that was declared. What
    // moves is the kit against the band: measured post-gain track RMS relative to the
    // kick is now comp -2.6, bass -5.1 (straight-funk's own figures), where the mint
    // measured comp -8.0 and bass -10.0. Same correction as boom-bap's, one step
    // smaller, and for the same reason: the comp and the bass carry the answer.
    // The parade bass drum is a big drum and it carries the clave.
    kick: -12,
    snare: -13,
    // Both toms come up about 3 dB on straight-funk's relationship to its snare. There
    // they decorate a fill; here they are half the figure.
    tomHigh: -15,
    tomLow: -14,
    // Demoted. Under a snare this busy the closed hat is a floor, not a pulse.
    hatClosed: -17,
    hatOpen: -20,
    // The quietest velocity table of any drum (strong 0.55 against the snare's 1.0),
    // so -14 is what puts the click level with the drum it is struck on.
    rim: -14,
    // Forward, and for a measurable reason as well as a musical one: the master pins
    // true peak onto the ceiling, so a transient-heavy kit renders quiet. The bass and
    // the comp are the two voices that sustain, and they are what keeps loop RMS off
    // the gate's -29 floor.
    bass: -22.2,
    comp: -4.2,
  },
  pan: {
    kick: 0,
    snare: -0.05,
    tomHigh: 0.24,
    tomLow: -0.28,
    hatClosed: 0.32,
    hatOpen: 0.36,
    rim: -0.22,
    bass: 0,
    comp: -0.24,
  },
  passes: 4,
  // Measured before it was declared. Over seeds 1–120: 22.38 events a bar at the
  // thinnest, 28.06 at the thickest, mean 25.41. Over 120 000 seeds in three ranges the
  // true extremes are 21.31 and 29.25, and those are what the band is set from — a
  // ceiling of 29 would have rejected a legitimate groove. Span 9, the second narrowest
  // in the registry, because this feel varies only in the snare figure (4–7 steps), the
  // ghost line (1–3) and the hat (3–5).
  density: { minPerBar: 21, maxPerBar: 30 },
  patterns: {
    // Four readings of the street beat. Each states one quarter — the accent — and
    // spends the rest of the bar off it. None is [4, 12] or any part of it.
    kit: [
      // The parade beat: accent on 1, taps on the "a" of 1 and the "a" of 3, the
      // "and"s of 2, 3 and 4 struck. The low tom takes beat 4 — the big four.
      { snare: [0, 3, 6, 10, 11, 14], tomHigh: [7], tomLow: [12] },
      // The accent moves to beat 3 and beat 1 is left to the kick. The toms answer in
      // a descending pair into beat 4.
      { snare: [2, 3, 6, 8, 11, 14], tomHigh: [10], tomLow: [12] },
      // The busy one, and the one that runs over the bar line: a tap on the last
      // sixteenth hands the bar on.
      { snare: [0, 2, 3, 6, 10, 14, 15], tomHigh: [11], tomLow: [12] },
      // The skeleton. The one figure that keeps a backbeat accent, on 2 and only on 2,
      // and gives beats 3 and 4 to the toms.
      { snare: [4, 6, 10, 14], tomHigh: [8], tomLow: [12] },
    ],
    // The 3-side of the son clave — 1, the "and" of 2, 4 — is the anchor every figure
    // keeps, and it is the set the bass is allowed to play. Each figure adds its own
    // hits around it.
    kick: [
      [0, 3, 6, 12],
      [0, 6, 10, 12],
      [0, 6, 12, 14],
      [0, 3, 6, 12, 14],
    ],
    // Only anchors, so the bass lands on a kick in every bar whichever pair is drawn.
    bass: [
      [0, 6, 12],
      [0, 12],
      [0, 6],
    ],
    // Three floors, not three pulses: quarters; the off-beat hand; and quarters with
    // the "and"s of 2 and 4. DEFAULT_PLACEMENT's open hat on 14 takes the last of
    // whichever figure reaches it.
    hatClosed: [
      [0, 4, 8, 12],
      [2, 6, 10, 14],
      [0, 4, 6, 8, 12, 14],
    ],
    // One stab a bar, always off the beat, and quick-23 moved all four into the first
    // half. The bass states the bar's root on steps 0-1 and stops there in every bar,
    // so a stab on the old 10 or 11 put the chord 650 ms after the root had gone and
    // the ear had to bridge the two from memory; 1-3 abut it or overlap it. Step 6 was
    // dropped rather than kept: it is the "and of 2" and the most idiomatic single
    // position in the style, but it is also the busiest step of the bar in all six
    // committed grooves — kick plus a snare accent — so a chord there groups with the
    // drum instead of reading as its own event.
    //
    // The order is load-bearing. `pick` indexes a four-member pool, so each committed
    // groove keeps the index it draws today, and the index decides its step: index 0 is
    // groove-70 (step 3), index 1 groove-69 (step 5), index 2 groove-65, -66 and -68
    // (step 2), index 3 groove-67 (step 1). Step 2 sits at index 2 because
    // three of the six land there and it is the only medium-velocity step left in the
    // pool — VELOCITIES puts an even off-sixteenth at 0.62 against an odd one's 0.52.
    // Re-ordering or shortening this array re-rolls which groove gets which stab.
    //
    // The keys are still the sparsest voice in this feel by construction: one onset
    // times a three- or four-note voicing can never reach the shared pool's two.
    comp: [[3], [5], [2], [1]],
    // Declared rather than inherited, because the shared pool sits on 3, 7, 11 and 15
    // — three of which the kit figures already strike, so against this feel it would
    // collapse to one tap a bar or none — and because a ghost on 13 would land on the
    // rim click. These four sit on the "e"s the figures leave empty.
    snareGhosts: [
      [1, 9],
      [5, 9],
      [9],
      [1, 5, 9],
    ],
  },
}
