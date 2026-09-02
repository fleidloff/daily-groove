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
const BAR_SEC = (60 / BPM) * BEATS_PER_BAR

const CM7 = [60, 63, 67, 70]
const F7 = [65, 69, 72, 75]

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
  progressionDegrees: HARMONY.progressionDegrees,
}

function at(bar: number, sixteenth: number): number {
  return bar * BAR_SEC + (sixteenth * BAR_SEC) / 16
}

function note(voice: VoiceName, midi: number, timeSec: number): NoteEvent {
  return { voice, timeSec, durationSec: 0.2, velocity: 0.9, midi }
}

const bass = (midi: number, timeSec: number) => note('bass', midi, timeSec)
const comp = (midi: number, timeSec: number) => note('comp', midi, timeSec)

function kick(timeSec: number): NoteEvent {
  return { voice: 'kick', timeSec, durationSec: 0.2, velocity: 0.9 }
}

describe('offScalePitches', () => {
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

  describe('the approach-note exception', () => {
    const B_BELOW_C = 47

    it('admits one bass semitone below the next chord’s root, on the bar’s last off-beat', () => {
      const events = [bass(B_BELOW_C, at(1, 15))]
      expect(offScalePitches(events, MUSIC, HARMONY)).toEqual([])
    })

    it('admits the same note a semitone above the next root', () => {
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
      expect(offScalePitches([bass(42, at(1, 15))], MUSIC, HARMONY)).toHaveLength(1)
    })

    it('admits only one approach note per chord change', () => {
      const events = [bass(B_BELOW_C, at(1, 15)), bass(49, at(1, 15) + 0.01)]
      const failures = offScalePitches(events, MUSIC, HARMONY)
      expect(failures.map((f) => f.midi)).toEqual([49])
    })

    it('reports an approach note in a bar that leads into the same chord', () => {
      const oneChord: Harmony = { ...HARMONY, progressionMidi: [CM7], progressionDegrees: [0] }
      expect(offScalePitches([bass(B_BELOW_C, at(1, 15))], MUSIC, oneChord)).toHaveLength(1)
    })

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
