import type { FeelTemplate } from '../types.ts'

/**
 * A fast, almost-straight sixteenth feel: the quickest pocket of the six.
 *
 * This is the mirror of `half-time`. Where that one takes the sixteenth grid
 * and halves the pulse, this one keeps the grid and pushes the tempo past
 * anything the other five play at — 138–152 bpm, a band nothing else occupies,
 * so a listener places it inside a bar. At 145 bpm a sixteenth is 103 ms, which
 * is the resolution a fusion drummer actually plays; the same patterns the
 * funk plays at 100 bpm read as a different instrument up here.
 *
 * `swing: 0.10` is nearly straight, and that is a consequence of the tempo
 * rather than a taste. `applySwing` delays each off-step by `swing × half a
 * step`, so 0.10 here is 2.6 ms — a hair of looseness. The funk's 0.18 at 100
 * bpm is 13 ms, five times the displacement; putting that number on this grid
 * at this tempo would not read as a swung sixteenth but as a drummer failing to
 * keep up. Everything about this feel is scaled down for speed: the smallest
 * timing window of the six (5 ms), the smallest velocity spread, and the
 * shallowest drift, because at 145 bpm a 1 % tempo wobble is audible where at
 * 70 bpm it is not.
 *
 * The kit is light and wide: a quiet, tight hat panned hard, the cross-stick
 * kept as the pickup into the turnaround, and the kick mixed under the bass so
 * the low end is played rather than thumped. Four passes is ~26 s at the range's
 * midpoint — in line with the other fast feels, and the reason it can afford
 * four where `half-time` cannot.
 *
 * `flavours` carries melodic minor and lydian dominant, which is one scale
 * heard two ways: lydian dominant is the fourth mode of melodic minor, so the
 * pair shares every note and differs only in where the ear puts the tonic.
 * That is the hardest and the fairest kind of pair — the two answers cannot be
 * told apart by their note content at all, only by what the bass is sitting on
 * — and both are the bright, tense colours that need speed and air. Melodic
 * minor's natural 6 and raised 7 and lydian dominant's ♯4 over a ♭7 are heard
 * as lift; at 70 bpm they would just sound wrong.
 *
 * No `PLACEMENTS` or `FILLS` entry, deliberately. The default backbeat on 2 and
 * 4, the open hat closing the bar and the sixteenth-note run down the kit are
 * all written on the sixteenth grid this template already plays on, and at this
 * tempo they are quick without being busy. A feel earns an override when the
 * default states something untrue about it; nothing here does.
 */
export const doubleTime: FeelTemplate = {
  id: 'double-time',
  tempoRange: [138, 152],
  subdivision: 16,
  swing: 0.1,
  flavours: ['melodic-minor', 'lydian-dominant'],
  voices: ['kick', 'snare', 'hatClosed', 'hatOpen', 'rim', 'tomHigh', 'tomLow', 'bass', 'comp'],
  // The tightest of the six. At 145 bpm a sixteenth is 103 ms, so a lean of
  // more than a few milliseconds is a fraction of the grid a listener can
  // actually hear as a mistake rather than as a feel.
  humanize: {
    timingMs: 5,
    velocity: 0.04,
    lean: { snare: 4, hatClosed: -2, hatOpen: -2, rim: 2 },
    driftDepth: 0.003,
  },
  // The bass over the kick, not under it: at this tempo the kick is a
  // percussion part and the bass is the low end.
  gain: {
    tomHigh: -12,
    tomLow: -11,
    kick: -8,
    snare: -9,
    hatClosed: -14,
    hatOpen: -15,
    rim: -7,
    bass: -2,
    comp: -7,
  },
  // The widest image of the six: hats hard left, comp hard right. A fast feel
  // needs the space between the parts to stay legible.
  pan: {
    tomHigh: -0.3,
    tomLow: 0.32,
    kick: 0,
    snare: 0.04,
    hatClosed: -0.46,
    hatOpen: -0.5,
    rim: 0.38,
    bass: 0,
    comp: 0.36,
  },
  /** Four passes: ~26 s at the 138–152 range's midpoint, the shortest of the six. */
  passes: 4,
  density: { minPerBar: 18, maxPerBar: 44 },
}
