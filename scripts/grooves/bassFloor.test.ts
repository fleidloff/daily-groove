import { describe, expect, it } from 'vitest'
import { buildEvents } from './events.ts'
import type { BassDecisions } from './events.ts'
import { readCatalogue } from './catalogue.ts'
import { fixtureKey, readFixture, serialiseEvent } from './eventsFixture.ts'
import { templateById } from './templates/index.ts'
import type { MusicMeta, NoteEvent } from './types.ts'

// Feature-28 lowered BASS_FLOOR_MIDI from 28 to 25. AC4 and AC5 are claims about
// the *difference* between those two registers, so both are built here from
// source and compared. `bassFloorMidi` is what makes the floor-28 side
// reproducible from committed code; `decisions` is what makes the octave pop and
// the always-lift observable at all — both leave a note at 37-39 whichever floor
// was in force, so a final pitch cannot tell you which of them moved it.
//
// Track A measured all of this by patching throwaway copies of the generator
// outside the repo. Every figure below is that measurement, re-taken here.
const PREVIOUS_FLOOR = 28
const FLOOR = 25

// AC4. Asserted as a set, so a swap fails as loudly as a shrinkage. The PRD's R5
// sentence names groove-49 and groove-68 instead of groove-46 and groove-48; both
// of those do move, by 2 and 4 approach-note events. This is the measured set.
const UNCHANGED = [
  'groove-08',
  'groove-46',
  'groove-48',
  'groove-52',
  'groove-54',
  'groove-82',
]

// AC5, R6. The sites where floor 28 folded to 37-39 and failed `midi + 12 <= 48`,
// and floor 25 folds to 25-27, passes, and pops back to the pitch it already had.
const UNBLOCKED_POPS = [
  'groove-08 bar0 step5 -> 37',
  'groove-08 bar3 step5 -> 37',
  'groove-12 bar1 step5 -> 38',
  'groove-14 bar1 step10 -> 38',
  'groove-34 bar3 step6 -> 39',
  'groove-40 bar1 step6 -> 39',
  'groove-42 bar3 step3 -> 38',
  'groove-75 bar3 step10 -> 37',
  'groove-82 bar0 step14 -> 38',
  'groove-82 bar2 step8 -> 39',
]

// AC5, R7. The one pitch class that cannot be approached from below moves from E
// to C sharp, one for one.
const STOP_APPROACHING_FROM_ABOVE = [
  'groove-01 bar0',
  'groove-11 bar0',
  'groove-34 bar0',
  'groove-49 bar0',
  'groove-58 bar2',
  'groove-68 bar3',
  'groove-70 bar0',
  'groove-77 bar3',
]

const START_APPROACHING_FROM_ABOVE = [
  'groove-02 bar1',
  'groove-11 bar1',
  'groove-40 bar1',
  'groove-44 bar2',
  'groove-50 bar3',
  'groove-51 bar2',
  'groove-70 bar1',
  'groove-73 bar3',
]

type Built = {
  id: string
  key: string
  lines: string[]
  events: NoteEvent[]
  music: MusicMeta
  decisions: BassDecisions
}

// The floor-25 side is built with no override, so it is the floor the catalogue
// actually ships with. Move BASS_FLOOR_MIDI and every assertion below goes red,
// not just the one that names the constant.
function buildAt(bassFloorMidi?: number): Built[] {
  return readCatalogue().map((spec) => {
    const decisions: BassDecisions = { pops: [], approaches: [], lifts: [] }
    const { events, music } = buildEvents(spec, templateById(spec.template), {
      bassFloorMidi,
      decisions,
    })
    return {
      id: spec.id,
      key: fixtureKey(spec),
      lines: events.map(serialiseEvent),
      events,
      music,
      decisions,
    }
  })
}

const before = buildAt(PREVIOUS_FLOOR)
const after = buildAt()
const pairs = before.map((b, index) => ({ b, a: after[index] }))

const maxBass = (events: readonly NoteEvent[]) =>
  Math.max(...events.filter((e) => e.voice === 'bass' && e.midi !== undefined).map((e) => e.midi!))

describe('the bass floor — the two registers this feature sits between', () => {
  it('reads the whole committed catalogue at both floors', () => {
    expect(before).toHaveLength(54)
    expect(after).toHaveLength(54)
    expect(after.map((g) => g.key)).toEqual(before.map((g) => g.key))
  })

  it('ships at floor 25, and an explicit floor 25 builds the same thing', () => {
    for (const spec of readCatalogue()) {
      const plain = buildEvents(spec, templateById(spec.template))
      const forced = buildEvents(spec, templateById(spec.template), { bassFloorMidi: FLOOR })
      expect(
        forced.events,
        `${spec.id}: BASS_FLOOR_MIDI is not 25, or bassFloorMidi is not what BASS_FLOOR_MIDI does`,
      ).toEqual(plain.events)
      expect(forced.music, spec.id).toEqual(plain.music)
    }
  })

  it('matches the committed event record on the floor-25 side', () => {
    const fixture = readFixture()
    for (const groove of after) {
      expect(fixture[groove.key], groove.key).toBeDefined()
      expect(groove.lines, `${groove.id}: the floor-25 build is not what events.fixture.json holds`)
        .toEqual(fixture[groove.key].events)
    }
  })

  it('collects a decision record at all three floor-dependent sites', () => {
    const total = (side: Built[], of: (d: BassDecisions) => unknown[]) =>
      side.reduce((sum, g) => sum + of(g.decisions).length, 0)
    expect(total(after, (d) => d.pops)).toBe(228)
    expect(total(after, (d) => d.approaches)).toBe(192)
    expect(total(after, (d) => d.lifts)).toBe(54)
    expect(total(before, (d) => d.pops)).toBe(228)
    expect(total(before, (d) => d.approaches)).toBe(192)
    expect(total(before, (d) => d.lifts)).toBe(54)
  })
})

describe('AC4 — 48 grooves move and these six do not', () => {
  const unchanged: string[] = []
  const changed: string[] = []
  let bassDifferences = 0
  let nonBassDifferences = 0
  const countMismatches: string[] = []

  for (const { b, a } of pairs) {
    if (b.lines.length !== a.lines.length) {
      countMismatches.push(`${b.id}: ${b.lines.length} -> ${a.lines.length}`)
    }
    let differs = false
    for (let i = 0; i < Math.min(b.lines.length, a.lines.length); i++) {
      if (b.lines[i] === a.lines[i]) continue
      differs = true
      if (b.lines[i].startsWith('bass@') && a.lines[i].startsWith('bass@')) bassDifferences++
      else nonBassDifferences++
    }
    ;(differs ? changed : unchanged).push(b.id)
  }

  it('leaves exactly six grooves byte-identical, and they are these six', () => {
    expect(unchanged.slice().sort()).toEqual(UNCHANGED)
  })

  it('moves the other 48', () => {
    expect(changed).toHaveLength(48)
  })

  it('moves 508 bass notes and nothing that is not a bass note', () => {
    expect(nonBassDifferences).toBe(0)
    expect(bassDifferences).toBe(508)
  })

  it('keeps every event count, so no draw moved with the floor', () => {
    expect(countMismatches).toEqual([])
    const total = (side: Built[]) => side.reduce((sum, g) => sum + g.lines.length, 0)
    expect(total(after)).toBe(20123)
    expect(total(before)).toBe(20123)
  })
})

describe('AC5, R6 — the octave pop is unchanged', () => {
  const unblocked: string[] = []
  const pitchChanged: string[] = []
  const moved: string[] = []
  let wantToPop = 0
  let firedBefore = 0
  let firedAfter = 0

  for (const { b, a } of pairs) {
    const sites28 = b.decisions.pops
    const sites25 = a.decisions.pops
    if (sites28.length !== sites25.length) {
      moved.push(`${b.id}: pop site count ${sites28.length} -> ${sites25.length}`)
      continue
    }
    sites28.forEach((x, i) => {
      const y = sites25[i]
      if (x.bar !== y.bar || x.index !== y.index || x.step !== y.step) {
        moved.push(`${b.id}: pop site ${i} moved position`)
        return
      }
      if (x.wants !== y.wants) moved.push(`${b.id} bar${x.bar} step${x.step}: the drop draw moved`)
      if (!x.wants) return
      wantToPop++
      if (x.can) firedBefore++
      if (y.can) firedAfter++
      if (!x.can && y.can) unblocked.push(`${b.id} bar${x.bar} step${x.step} -> ${y.final}`)
      if (x.final !== y.final) {
        pitchChanged.push(`${b.id} bar${x.bar} step${x.step}: ${x.final} -> ${y.final}`)
      }
    })
  }

  it('draws the pop from the same rhythm stream at both floors, at the same sites', () => {
    expect(moved).toEqual([])
    expect(wantToPop).toBe(71)
  })

  it('unblocks ten sites, and they are these ten', () => {
    expect(unblocked.slice().sort()).toEqual(UNBLOCKED_POPS)
    expect(firedBefore).toBe(61)
    expect(firedAfter).toBe(71)
  })

  it('changes the sounding pitch at none of the sites where a pop fires', () => {
    expect(pitchChanged).toEqual([])
  })

  it('lands every unblocked pop on 37, 38 or 39, the pitch the higher floor already sounded', () => {
    const landings = unblocked.map((site) => Number(site.split(' -> ')[1]))
    expect(landings).toHaveLength(10)
    for (const midi of landings) expect(midi).toBeGreaterThanOrEqual(37)
    for (const midi of landings) expect(midi).toBeLessThanOrEqual(39)
  })
})

describe('AC5, R7 — the approach note is unchanged, and its one pitch class moves E to C sharp', () => {
  const stopped: string[] = []
  const started: string[] = []
  const unexpectedFlip: string[] = []
  const moved: string[] = []

  for (const { b, a } of pairs) {
    const sites28 = b.decisions.approaches
    const sites25 = a.decisions.approaches
    if (sites28.length !== sites25.length) {
      moved.push(`${b.id}: approach site count ${sites28.length} -> ${sites25.length}`)
      continue
    }
    sites28.forEach((x, i) => {
      const y = sites25[i]
      if (x.bar !== y.bar) return moved.push(`${b.id}: approach site ${i} moved bar`)
      if (x.wantsBelow !== y.wantsBelow) {
        return moved.push(`${b.id} bar${x.bar}: the direction draw moved`)
      }
      const fromAboveBefore = !(x.wantsBelow && x.belowOk)
      const fromAboveAfter = !(y.wantsBelow && y.belowOk)
      if (fromAboveBefore === fromAboveAfter) return
      const where = `${b.id} bar${x.bar}`
      if (fromAboveBefore) {
        stopped.push(where)
        if (x.approach !== 29 || y.approach !== 27) {
          unexpectedFlip.push(`${where}: ${x.approach} -> ${y.approach}, expected 29 -> 27`)
        }
      } else {
        started.push(where)
        if (x.approach !== 36 || y.approach !== 26) {
          unexpectedFlip.push(`${where}: ${x.approach} -> ${y.approach}, expected 36 -> 26`)
        }
      }
    })
  }

  it('draws the direction from the same rhythm stream at both floors', () => {
    expect(moved).toEqual([])
  })

  it('flips sixteen sites per pass, eight in each direction', () => {
    expect(stopped).toHaveLength(8)
    expect(started).toHaveLength(8)
    expect(stopped.length + started.length).toBe(16)
  })

  it('stops approaching E from above at eight named sites', () => {
    expect(stopped.slice().sort()).toEqual(STOP_APPROACHING_FROM_ABOVE)
  })

  it('starts approaching C sharp from above at eight named sites', () => {
    expect(started.slice().sort()).toEqual(START_APPROACHING_FROM_ABOVE)
  })

  it('is the existing fallback firing on a different pitch class, not a new rule', () => {
    expect(unexpectedFlip).toEqual([])
  })
})

describe('AC5, R8 — the always-lift is unchanged in all 54 grooves', () => {
  it('lifts exactly one note per groove at both floors', () => {
    for (const { b, a } of pairs) {
      expect(b.decisions.lifts, `${b.id} at floor 28`).toHaveLength(1)
      expect(a.decisions.lifts, `${b.id} at floor 25`).toHaveLength(1)
    }
  })

  it('lifts the same note from the same pitch to the same pitch', () => {
    const moved: string[] = []
    for (const { b, a } of pairs) {
      const [x] = b.decisions.lifts
      const [y] = a.decisions.lifts
      const same = x.bar === y.bar && x.step === y.step && x.from === y.from && x.to === y.to
      if (!same) {
        moved.push(
          `${b.id}: bar${x.bar} step${x.step} ${x.from}->${x.to} became bar${y.bar} step${y.step} ${y.from}->${y.to}`,
        )
      }
    }
    expect(moved).toEqual([])
  })

  it('drops the lift floor in the 48 grooves that moved, and the lift still does not follow it', () => {
    const dropped = pairs.filter(({ b, a }) => b.decisions.lifts[0].bottom !== a.decisions.lifts[0].bottom)
    expect(dropped).toHaveLength(48)
    const from = after.map((g) => g.decisions.lifts[0].from)
    expect(Math.min(...from)).toBe(32)
    expect(Math.max(...from)).toBe(36)
  })

  it('keeps every line its highest note', () => {
    const moved: string[] = []
    for (const { b, a } of pairs) {
      const was = maxBass(b.events)
      const is = maxBass(a.events)
      if (was !== is) moved.push(`${b.id}: maximum bass midi ${was} -> ${is}`)
    }
    expect(moved).toEqual([])
  })
})

// AC6's fixture half, which otherwise lived only in the epic's scratch alongside
// AC4 and AC5. The floor cannot reach the music stream: rest, repeat and drop are
// drawn before it is consulted, and inRegister is arithmetic on drawn values.
describe('AC6 — the floor reaches no committed answer', () => {
  it('builds the same bpm, bars, root, flavour, scale, chord and progression at both floors', () => {
    const moved: string[] = []
    for (const { b, a } of pairs) {
      if (JSON.stringify(b.music) !== JSON.stringify(a.music)) moved.push(b.id)
    }
    expect(moved).toEqual([])
  })
})
