import type { FeelTemplate } from '../types.ts'

/**
 * A mid-tempo groove with its sixteenths swung most of the way to a triplet:
 * the swagger between the funk's light push and the shuffle's full lope.
 *
 * The two numbers that make this feel are `subdivision: 16` and `swing: 0.44`,
 * and neither means anything without the other. `shuffle` swings harder — 0.64
 * — but on an eighth-note grid, so what swings is the beat itself; here the
 * beat is square and it is the sixteenths inside it that lean, which is a
 * different thing to hear and to play. `straight-funk` is on the same grid at
 * 0.18, a push rather than a lilt. At 0.44 an off-sixteenth at 111 bpm lands
 * 29 ms late, roughly two-thirds of the way to a triplet: far enough that the
 * hand pattern rolls, not so far that the bar stops being in four.
 *
 * The tempo band, 106–116, is the one gap the first four feels left — above the
 * funk's 94–106 and below the bright feel's 116–132 — so this pocket is not any
 * of them played slightly faster or slower. It is the tempo the roll wants:
 * under about 100 the swung sixteenths drag into a shuffle, and over about 120
 * they smear.
 *
 * The kit is heavy and has no cross-stick. A pickup into the turnaround is a
 * light gesture, and every gesture in this feel is weighted — the kick and the
 * snare are mixed up near `half-time`'s levels, the toms are close behind them,
 * and the hat sits under all of it keeping the roll going. The humanize bounds
 * are the second loosest of the six, behind the shuffle: a swung sixteenth that
 * lands exactly where the swing calculation puts it every time stops swinging,
 * for the same reason a shuffle does.
 *
 * `flavours` carries phrygian dominant and harmonic major. Both are a ♭6
 * standing against a major third — the interval that gives each of them its
 * whole character — and they differ in the second, ♭2 against a natural one.
 * That is a real distinction a player can hear and a narrow one to have to
 * hear, which is what the pairing is for. Both are dark, ceremonial colours
 * that want weight underneath them and a tempo slow enough to let the augmented
 * second ring; this feel gives them both.
 *
 * No `PLACEMENTS` or `FILLS` entry, deliberately. The default backbeat is
 * correct — this is a groove in four, not a wide-backbeat feel — and the
 * default fill is written on the sixteenth grid, so the swing this template
 * declares does to the fill exactly what it does to the figure: the run down
 * the kit comes out rolled rather than square, which is the fill this feel
 * would be given if it were written out by hand.
 */
export const swungSixteenth: FeelTemplate = {
  id: 'swung-sixteenth',
  tempoRange: [106, 116],
  subdivision: 16,
  swing: 0.44,
  flavours: ['phrygian-dominant', 'harmonic-major'],
  voices: ['kick', 'snare', 'hatClosed', 'hatOpen', 'tomHigh', 'tomLow', 'bass', 'comp'],
  // Second only to the shuffle. The roll is the feel, so the hand pattern
  // pushes hardest of any template here and the snare sits well behind it —
  // the gap between them is what a listener hears as swagger.
  humanize: {
    timingMs: 12,
    velocity: 0.12,
    lean: { snare: 11, hatClosed: -5, hatOpen: -5 },
    driftDepth: 0.008,
  },
  // A heavy kit: kick, snare and toms close together and loud, the hat well
  // under them. The comp is the quietest of the six because the harmony here
  // is carried by the bass — a rootless voicing over a ♭6 needs the root
  // audible beneath it more than it needs to be loud itself.
  gain: {
    tomHigh: -9,
    tomLow: -8,
    kick: -5,
    snare: -7,
    hatClosed: -14,
    hatOpen: -15,
    bass: -1,
    comp: -11,
  },
  // Narrower than the fast feels on purpose: a heavy groove reads as one band
  // in one room, so nothing is panned past a third of the way out.
  pan: {
    tomHigh: 0.18,
    tomLow: -0.2,
    kick: 0,
    snare: -0.03,
    hatClosed: 0.33,
    hatOpen: 0.36,
    bass: 0,
    comp: -0.31,
  },
  /** Four passes: ~35 s at the 106–116 range's midpoint, between the funk and the shuffle. */
  passes: 4,
  density: { minPerBar: 16, maxPerBar: 42 },
}
