import type { FeelTemplate } from '../types.ts'

export const openBallad: FeelTemplate = {
  id: 'open-ballad',
  tempoRange: [62, 74],
  subdivision: 16,
  swing: 0.02,
  flavours: ['melodic-minor', 'lydian-dominant'],
  voices: ['kick', 'snare', 'hatClosed', 'hatOpen', 'tomHigh', 'tomLow', 'bass', 'comp'],
  humanize: {
    timingMs: 11,
    velocity: 0.1,
    lean: { snare: 13, hatClosed: -2, hatOpen: -2 },
    driftDepth: 0.008,
  },
  gain: {
    tomHigh: -15,
    tomLow: -14,
    kick: -9,
    snare: -10,
    hatClosed: -15,
    hatOpen: -21,
    bass: -22,
    comp: -5.9,
  },
  pan: {
    tomHigh: 0.18,
    tomLow: -0.2,
    kick: 0,
    snare: -0.06,
    hatClosed: 0.2,
    hatOpen: 0.22,
    bass: 0,
    comp: -0.16,
  },
  passes: 2,
  // Five sixteenths, clamped to the next bass onset. Six was rendered first and heard
  // as ringing a little too long; five is the step down the musician's handover named
  // for that verdict. The pool's gaps are 1, 2, 4, 5, 6, 7, 8, 9, 10 and 15, so five
  // lets a note reach its gap up to 5 and caps everything wider — including the `[0, 8]`
  // pairs, which is where the length comes off. A cap is what keeps BASS_REST_CHANCE's
  // 9-to-15-sixteenth gaps audible as space rather than swallowed.
  bassSustain: 5,
  density: { minPerBar: 27, maxPerBar: 37 },
  patterns: {
    // The hat, and the reason this feel is on the sixteenth grid at all. At
    // subdivision 8 all three shared HAT_PATTERNS gridded to the same straight
    // eighths, so the draw picked one of three and always got one line. Neither 10
    // nor 14 appears in any member: the hatOpen figure below owns both steps, and
    // nothing subtracts a figure's steps from the closed line the way
    // `hatOpenSteps` does for a placement one.
    hatClosed: [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12, 13, 15],
      [0, 2, 3, 4, 6, 7, 8, 11, 12, 15],
      [0, 1, 2, 4, 5, 6, 8, 9, 12, 13],
    ],
    // A ballad's bedrock is 1 and 3. The shared KICK_PATTERNS were written for funk
    // and not one of its five figures states beat 3.
    kick: [
      [0, 8],
      [0, 8, 14],
      [0, 6, 8],
      [0, 8, 10, 14],
      [0, 6, 10],
    ],
    bass: [
      [0, 8],
      [0, 8, 14],
      [0, 6, 10],
      [0, 8, 10],
    ],
    // Three onsets where the shared pool gives two, because one chord held across a
    // 3.5-second bar on two hits is what made this feel sit still. Two of the four are
    // two-bar phrases, written flat. No member touches 12 or 14: a comp note lasts a
    // quarter and takes the current bar's voicing, so a hit on the "and" of 4 is the
    // old chord ringing into the new one rather than an anticipation.
    comp: [
      [0, 6, 10],
      [0, 8, 10],
      [0, 6, 10, 18, 22, 26],
      [0, 8, 10, 18, 22, 26],
    ],
  },
  // The half-phrase mark. Declaring hatOpen here suppresses its placement line for the
  // feel, so bars one to three restate what the placement gave; the fourth opens twice.
  // `barInPass % bars.length` is 4 against two passes, so this marks bars 4 and 8 —
  // the antecedent and consequent of an eight-bar strain.
  figures: [{ voice: 'hatOpen', bars: [[14], [14], [14], [10, 14]] }],
}
