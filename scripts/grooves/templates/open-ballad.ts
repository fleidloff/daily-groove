import type { FeelTemplate } from '../types.ts'

/**
 * A slow, near-straight eighth-note feel: the calmest pocket of the six, and
 * the one that gets out of the harmony's way.
 *
 * It replaces `double-time`, which was the opposite bet and was the wrong one.
 * That feel put a sixteenth grid at 138–152 bpm and was, by the only judgement
 * that counts, too much: this is a game about naming a chord, and a groove that
 * asks to be admired is competing with the thing the player is trying to hear.
 * The kit's job here is to state a tempo and a pulse and then leave room.
 *
 * Everything follows from that. `subdivision: 8` rather than 16, so the bar has
 * half as many places to put a hit. `swing: 0.02` is very nearly straight —
 * enough that the groove is played rather than programmed, not enough to be
 * heard as a lean, and at 62–74 bpm even that is only 4 ms of displacement.
 * `passes: 2`, because eight bars at this tempo is already ~29 s and four would
 * be a minute of the same figure.
 *
 * The mix is the point as much as the pattern. The comp is the loudest voice
 * after the bass — the only template where it sits above the snare — and the
 * hats are the quietest of the six. A player who cannot hear the third of the
 * chord cannot answer the question, and on a slow feel there is nothing else
 * for the ear to hold on to between the backbeats.
 *
 * `flavours` carries melodic minor and lydian dominant, which is one scale
 * heard two ways: lydian dominant is the fourth mode of melodic minor, so the
 * pair shares every note and differs only in where the ear puts the tonic.
 * That is the hardest and the fairest kind of pair — the two answers cannot be
 * told apart by their note content at all, only by what the bass is sitting on.
 * Which is exactly why they belong on the calmest feel rather than the fastest:
 * the distinction is a bass note and a comp voicing, and it needs to be audible.
 *
 * No `PLACEMENTS` or `FILLS` entry, deliberately. The default backbeat on 2 and
 * 4 is what a ballad plays, and the default fill resolves onto this template's
 * eighth grid through `gridSteps` like every other pattern. A feel earns an
 * override when the default states something untrue about it; nothing here does.
 */
export const openBallad: FeelTemplate = {
  id: 'open-ballad',
  tempoRange: [62, 74],
  subdivision: 8,
  swing: 0.02,
  flavours: ['melodic-minor', 'lydian-dominant'],
  voices: ['kick', 'snare', 'hatClosed', 'hatOpen', 'tomHigh', 'tomLow', 'bass', 'comp'],
  // Loose in absolute terms and tight relative to the grid: at 68 bpm an eighth
  // is 441 ms, so 11 ms of slop is a fortieth of a step. A slow feel tolerates —
  // and needs — more human error than a fast one, because the ear has time to
  // hear the grid it is deviating from.
  humanize: {
    timingMs: 11,
    velocity: 0.1,
    lean: { snare: 13, hatClosed: -2, hatOpen: -2 },
    driftDepth: 0.008,
  },
  // The comp above the snare, which no other template does. The harmony is the
  // question being asked; the kit is the context it is asked in.
  // Corrected for the MuldjordKit drums. The delta is per voice and identical
  // across all six templates, because the thing that changed is the pack's
  // recorded levels, not this feel's intent: MuldjordKit's snare and hats sit
  // at different levels from VCSL's, and every template inherits that equally.
  // Re-deriving each template independently would have quietly rewritten five
  // balances that were already right relative to each other.
  gain: {
    // Toms only sound in the fill, and on a ballad a fill is a turn of phrase
    // rather than an event. They sit under the snare, where a soft mallet-free
    // roll belongs, instead of over it as they do on the faster feels.
    tomHigh: -15,
    tomLow: -14,
    kick: -9,
    snare: -10,
    hatClosed: -15,
    hatOpen: -21,
    bass: -1,
    comp: -4,
  },
  // A narrow image. There is little to separate at this tempo, and a wide kit
  // over a slow groove reads as an empty room rather than a close one.
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
  /** Two passes: ~29 s at the 62–74 range's midpoint, and four would be a minute. */
  passes: 2,
  // The sparsest band of the six. An eighth grid at two passes cannot reach the
  // counts a sixteenth feel does, and should not be asked to.
  density: { minPerBar: 8, maxPerBar: 30 },
}
