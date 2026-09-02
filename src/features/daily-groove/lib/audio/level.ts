/**
 * How loud anything a chip sounds is, and how it gets out of the way.
 *
 * One number for the whole catalogue (R4) and for both voices (R2) — the root
 * note here, and the mode lick from Epic 1. Neither voice chooses its own
 * level, and there is no per-groove adjustment: the notes and the grooves are
 * both peak-normalised at mint time, so one value holds across all thirty.
 *
 * There is no shared master gain node to go with the shared number. The fade
 * below is per-note, and a single node would duck the arriving note along with
 * the departing one — so each voice builds its own `GainNode` at this level,
 * and `level.test.ts` reads `lib/audio/` from disk to check that every module
 * that calls `createGain(` reads the number from here rather than declaring one
 * of its own.
 */

/**
 * Peak gain for anything a chip sounds — the root note and, from Epic 1, the
 * mode lick (R1, R2, R4).
 *
 * This is what a listen produced, not a computed loudness match: the note has
 * to stay clearly audible against the bass without ever being the loudest thing
 * in the mix (R3). Recalibrating is a one-line diff here — no test asserts the
 * literal value, only that it is below full scale.
 */
export const REFERENCE_LEVEL = 0.4

/**
 * Seconds of ramp when a sound is taken over or cut short (R5).
 *
 * Long enough that a retrigger does not click, short enough that a finger run
 * down the chip row does not smear one note into the next. Like the level, it
 * is a listen rather than a calculation, and no test pins the literal.
 */
export const REFERENCE_FADE_SECONDS = 0.03
