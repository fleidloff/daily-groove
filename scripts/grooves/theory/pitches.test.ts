import { describe, expect, it } from 'vitest'
import { offScalePitches } from './pitches.ts'
import { buildHarmony } from './harmony.ts'
import type { Harmony } from './harmony.ts'
import { FLAVOURS, pitchesOf, scaleName } from './scales.ts'
import { ROOTS } from './notes.ts'
import { rngFor } from '../rng.ts'
import type { MusicMeta, NoteEvent, VoiceName } from '../types.ts'

const BPM = 120
const BEATS_PER_BAR = 4
/** 2 seconds at 120 bpm. */
const BAR_SEC = (60 / BPM) * BEATS_PER_BAR

/** C dorian: C D E♭ F G A B♭. B natural and C♯ are outside it. */
const CM7 = [60, 63, 67, 70]
const F7 = [65, 69, 72, 75]

/**
 * Two chords over a four-bar figure, so every bar line is a chord change —
 * including the one at the loop's end, where bar four's F7 leads back into bar
 * one's Cm7.
 */
const HARMONY: Harmony = {
  chordMidi: CM7,
  chordName: 'Cm7',
  progressionDegrees: [0, 3],
  progressionName: 'Cm7–F7',
  progressionMidi: [CM7, F7],
}

const MUSIC: MusicMeta = {
  bpm: BPM,
  bars: 4,
  loopBars: 4,
  root: 'C',
  flavour: 'dorian',
  scale: 'C dorian',
  chord: 'Cm7',
  progression: 'Cm7–F7',
  // Read off HARMONY rather than restated: the words and the audio in this
  // fixture must not be able to drift apart.
  progressionDegrees: HARMONY.progressionDegrees,
}

/** The onset of a sixteenth-note step of a bar, in seconds from the loop's start. */
function at(bar: number, sixteenth: number): number {
  return bar * BAR_SEC + (sixteenth * BAR_SEC) / 16
}

function note(voice: VoiceName, midi: number, timeSec: number): NoteEvent {
  return { voice, timeSec, durationSec: 0.2, velocity: 0.9, midi }
}

const bass = (midi: number, timeSec: number) => note('bass', midi, timeSec)
const comp = (midi: number, timeSec: number) => note('comp', midi, timeSec)

/** A kick: no `midi`, so the check has nothing to say about it. */
function kick(timeSec: number): NoteEvent {
  return { voice: 'kick', timeSec, durationSec: 0.2, velocity: 0.9 }
}

describe('offScalePitches', () => {
  // Step C1 — R9, R10, AC10, AC11
  describe('the rule', () => {
    it('admits a bass line and a comp voicing built from the scale', () => {
      const events = [
        kick(at(0, 0)),
        bass(36, at(0, 0)),
        bass(43, at(0, 6)),
        bass(46, at(0, 10)),
        bass(41, at(1, 0)),
        comp(60, at(0, 2)),
        comp(63, at(0, 2)),
        comp(67, at(0, 2)),
        comp(70, at(0, 2)),
      ]
      expect(offScalePitches(events, MUSIC, HARMONY)).toEqual([])
    })

    it('reports a bass note the scale does not contain, mid-bar', () => {
      const events = [bass(36, at(0, 0)), bass(61, at(0, 4))]
      expect(offScalePitches(events, MUSIC, HARMONY)).toEqual([
        { voice: 'bass', midi: 61, timeSec: at(0, 4) },
      ])
    })

    it('ignores events that carry no pitch at all', () => {
      expect(offScalePitches([kick(at(0, 0)), kick(at(0, 6))], MUSIC, HARMONY)).toEqual([])
    })

    it('reports an off-scale comp pitch in any octave', () => {
      const events = [comp(61, at(0, 2)), comp(73, at(0, 6))]
      expect(offScalePitches(events, MUSIC, HARMONY).map((f) => f.midi)).toEqual([61, 73])
    })
  })

  // Step C3 — R8, R8a, AC9, AC9a
  describe('the approach-note exception', () => {
    /** B natural, a semitone below the C that bar 3 and bar 1 are built on. */
    const B_BELOW_C = 47

    it('admits one bass semitone below the next chord’s root, on the bar’s last off-beat', () => {
      const events = [bass(B_BELOW_C, at(1, 15))]
      expect(offScalePitches(events, MUSIC, HARMONY)).toEqual([])
    })

    it('admits the same note a semitone above the next root', () => {
      // C♯, a semitone above bar 3's C.
      expect(offScalePitches([bass(49, at(1, 15))], MUSIC, HARMONY)).toEqual([])
    })

    it('reports the same pitch on the first beat of the bar', () => {
      const events = [bass(B_BELOW_C, at(1, 0))]
      expect(offScalePitches(events, MUSIC, HARMONY)).toEqual([
        { voice: 'bass', midi: B_BELOW_C, timeSec: at(1, 0) },
      ])
    })

    it('reports a comp note in the approach position — the hole is the bass’s alone', () => {
      const events = [comp(71, at(1, 15))]
      expect(offScalePitches(events, MUSIC, HARMONY)).toEqual([
        { voice: 'comp', midi: 71, timeSec: at(1, 15) },
      ])
    })

    it('reports a pitch that is not a semitone from the next root', () => {
      // F♯, a tritone from bar 3's C, in the approach position.
      expect(offScalePitches([bass(42, at(1, 15))], MUSIC, HARMONY)).toHaveLength(1)
    })

    it('admits only one approach note per chord change', () => {
      const events = [bass(B_BELOW_C, at(1, 15)), bass(49, at(1, 15) + 0.01)]
      const failures = offScalePitches(events, MUSIC, HARMONY)
      expect(failures.map((f) => f.midi)).toEqual([49])
    })

    it('reports an approach note in a bar that leads into the same chord', () => {
      // One chord for the whole figure: no change anywhere, so no exception.
      const oneChord: Harmony = { ...HARMONY, progressionMidi: [CM7], progressionDegrees: [0] }
      expect(offScalePitches([bass(B_BELOW_C, at(1, 15))], MUSIC, oneChord)).toHaveLength(1)
    })

    // R8a, AC9a — the loop's end is a chord change like any other.
    it('admits an approach note on the last off-beat of the final bar, into bar one', () => {
      expect(offScalePitches([bass(B_BELOW_C, at(3, 15))], MUSIC, HARMONY)).toEqual([])
    })

    it('reports an approach note written past the loop’s end', () => {
      const past = 4 * BAR_SEC + 0.01
      expect(offScalePitches([bass(B_BELOW_C, past)], MUSIC, HARMONY)).toHaveLength(1)
    })

    it('applies the exception in every pass, not only the first', () => {
      const long: MusicMeta = { ...MUSIC, loopBars: 8 }
      const events = [
        bass(B_BELOW_C, at(1, 15)),
        bass(B_BELOW_C, at(5, 15)),
        bass(B_BELOW_C, at(7, 15)),
      ]
      expect(offScalePitches(events, long, HARMONY)).toEqual([])
    })
  })

  // R9, R10a — the only other hole, and the proof that it is empty everywhere
  // but blues.
  describe('the flavour’s own chords', () => {
    it('admits the major third of a blues I7, which the six-note scale omits', () => {
      const harmony = buildHarmony('C', 'blues', rngFor('pitches:blues'))
      const music: MusicMeta = {
        bpm: BPM,
        bars: 4,
        loopBars: 4,
        root: 'C',
        flavour: 'blues',
        scale: scaleName('C', 'blues'),
        chord: harmony.chordName,
        progression: harmony.progressionName,
        progressionDegrees: harmony.progressionDegrees,
      }
      // E is a chord tone of C7 and not a member of the C blues scale.
      expect(pitchesOf('C', 'blues')).not.toContain(4)
      expect(harmony.chordMidi).toContain(64)
      expect(offScalePitches([comp(64, at(0, 2))], music, harmony)).toEqual([])
    })

    it('widens nothing for the seven flavours whose chords are drawn from the scale', () => {
      for (const flavour of FLAVOURS) {
        if (flavour === 'blues') continue
        for (const root of ROOTS) {
          const harmony = buildHarmony(root, flavour, rngFor(`pitches:${root}:${flavour}`))
          const scale = new Set(pitchesOf(root, flavour))
          const chords = [harmony.chordMidi, ...harmony.progressionMidi].flat()
          for (const midi of chords) {
            expect(scale.has(midi % 12), `${root} ${flavour} plays ${midi}`).toBe(true)
          }
        }
      }
    })
  })
})
