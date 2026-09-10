import { describe, expect, it } from 'vitest'
import { readCatalogue } from './catalogue.ts'
import { LOW_REGISTER_CEILING_MIDI, lowRegisterRanking, lowRegisterShare } from './lowRegister.ts'
import type { NoteEvent } from './types.ts'

function bass(midi: number, durationSec: number): NoteEvent {
  return { voice: 'bass', timeSec: 0, durationSec, velocity: 0.8, midi }
}

describe('lowRegisterShare', () => {
  it('is the share of bass note-time spent below the ceiling', () => {
    expect(lowRegisterShare([bass(25, 1), bass(40, 1)])).toBe(0.5)
  })

  it('weighs note-time rather than note count', () => {
    expect(lowRegisterShare([bass(27, 3), bass(28, 1)])).toBe(0.75)
  })

  it('counts a note strictly below the ceiling, so a note on the low E does not count', () => {
    expect(lowRegisterShare([bass(LOW_REGISTER_CEILING_MIDI, 1)])).toBe(0)
    expect(lowRegisterShare([bass(LOW_REGISTER_CEILING_MIDI - 1, 1)])).toBe(1)
  })

  it('ignores every voice but the bass', () => {
    const events: NoteEvent[] = [
      { voice: 'kick', timeSec: 0, durationSec: 4, velocity: 0.9 },
      { voice: 'comp', timeSec: 0, durationSec: 4, velocity: 0.7, midi: 60 },
      bass(25, 1),
    ]
    expect(lowRegisterShare(events)).toBe(1)
  })

  it('ignores a bass event carrying no pitch, on both sides of the ratio', () => {
    const pitchless: NoteEvent = { voice: 'bass', timeSec: 0, durationSec: 9, velocity: 0.8 }
    expect(lowRegisterShare([pitchless, bass(25, 1)])).toBe(1)
  })

  it('is 0 rather than NaN for a groove with no bass at all', () => {
    expect(lowRegisterShare([{ voice: 'kick', timeSec: 0, durationSec: 1, velocity: 0.9 }])).toBe(0)
    expect(lowRegisterShare([])).toBe(0)
  })

  // 28 is the four-string's open low E and the register boundary this metric is about.
  // It is deliberately not BASS_FLOOR_MIDI: binding the metric to the live floor would
  // make every groove read zero again the day the floor moves, which is the opposite of
  // what the metric is for.
  it('measures at 28, and does not read the live floor', () => {
    expect(LOW_REGISTER_CEILING_MIDI).toBe(28)
  })
})

describe('lowRegisterRanking', () => {
  it('ranks every groove of the feel, descending, in catalogue order on a tie', () => {
    const catalogue = readCatalogue()
    const shuffleIds = catalogue.filter((spec) => spec.template === 'shuffle').map((s) => s.id)
    const ranking = lowRegisterRanking('shuffle')

    expect(ranking.length).toBe(shuffleIds.length)
    expect([...ranking.map((row) => row.id)].sort()).toEqual([...shuffleIds].sort())

    for (let i = 1; i < ranking.length; i += 1) {
      expect(ranking[i - 1].share).toBeGreaterThanOrEqual(ranking[i].share)
    }

    const ties = ranking.filter((row) => row.share === ranking[0].share).map((row) => row.id)
    const inCatalogueOrder = shuffleIds.filter((id) => ties.includes(id))
    expect(ties).toEqual(inCatalogueOrder)
  })

  it('ranks the grooves of the catalogue it is given, and no others', () => {
    const catalogue = readCatalogue()
    const two = catalogue.filter((spec) => spec.template === 'shuffle').slice(0, 2)
    expect(lowRegisterRanking('shuffle', two).map((row) => row.id)).toEqual(
      two.map((spec) => spec.id),
    )
  })

  it('is empty for a feel no groove in the catalogue plays', () => {
    expect(lowRegisterRanking('no-such-feel')).toEqual([])
  })

  it('reports a share in 0..1 for every groove in the catalogue', () => {
    for (const row of lowRegisterRanking('open-ballad')) {
      expect(row.share).toBeGreaterThanOrEqual(0)
      expect(row.share).toBeLessThanOrEqual(1)
    }
  })
})
