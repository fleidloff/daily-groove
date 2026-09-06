import { describe, it, expect } from 'vitest'
import type { Groove, Root } from '../../types'
import { isoDate } from '@/lib/date'
import { selectGrooveForDate, dayIndexOf, orderFor, ROTA_EPOCH } from './selectGroove'

const grooves: Groove[] = [
  { id: 'a', uuid: '4eaa88e8-267d-49d0-a2d9-b6d2db848d3e', audioSrc: '/grooves/a.mp3', name: 'Test Groove', bpm: 90, root: 'C', flavour: 'Minor', bars: 4, scale: 'C minor', chord: 'Cm', progression: 'Cm–F–G', headDelaySeconds: 0.025057 },
  { id: 'b', uuid: '189022bc-852b-4228-b6f8-6bef9117f166', audioSrc: '/grooves/b.mp3', name: 'Test Groove', bpm: 90, root: 'A', flavour: 'Dorian', bars: 4, scale: 'A dorian', chord: 'Am7', progression: 'Am–D–G', headDelaySeconds: 0.025057 },
  { id: 'c', uuid: 'a5de9f44-30d7-46bb-914d-830a31b7133e', audioSrc: '/grooves/c.mp3', name: 'Test Groove', bpm: 90, root: 'E', flavour: 'Phrygian', bars: 4, scale: 'E phrygian', chord: 'Em', progression: 'Em–Am–B7', headDelaySeconds: 0.025057 },
]

describe('selectGrooveForDate', () => {
  it('returns the same groove across repeated calls for a fixed date', () => {
    const date = new Date('2026-08-21')
    const first = selectGrooveForDate(date, grooves)
    const second = selectGrooveForDate(date, grooves)
    const third = selectGrooveForDate(new Date('2026-08-21'), grooves)
    expect(first).toBe(second)
    expect(first).toBe(third)
  })

  it('resolves a far-future date to a valid member of the set (never exhausts)', () => {
    const result = selectGrooveForDate(new Date('2099-01-01'), grooves)
    expect(grooves).toContain(result)
  })

  it('returns a member of the set for any date', () => {
    for (const d of ['2026-01-01', '2026-06-15', '2030-12-31', '2050-07-04']) {
      expect(grooves).toContain(selectGrooveForDate(new Date(d), grooves))
    }
  })
})

let fixtureUuids = 0
const nextFixtureUuid = () =>
  `00000000-0000-4000-8000-${String((fixtureUuids += 1)).padStart(12, '0')}`

const sweepGroove = (id: string): Groove => ({
  id,
  uuid: nextFixtureUuid(),
  audioSrc: `/grooves/${id}.mp3`,
  name: 'n',
  bpm: 90,
  root: 'C',
  flavour: 'Minor',
  bars: 4,
  scale: 's',
  chord: 'c',
  progression: 'p',
  headDelaySeconds: 0.025057,
})

const SWEEP_START = new Date(2026, 0, 1)
const SWEEP_DAYS = 365

const sweep = (set: Groove[]): string => {
  let out = ''
  for (let i = 0; i < SWEEP_DAYS; i++) {
    const day = new Date(SWEEP_START.getFullYear(), SWEEP_START.getMonth(), SWEEP_START.getDate() + i)
    out += selectGrooveForDate(day, set).id
  }
  return out
}

// These two strings move only in a commit that also moves ROTA_EPOCH. If they
// fail and the epoch did not move, something else reshuffled the rota, and the
// fix is to find it, not to regenerate this.
const SWEEP_OVER_THREE = [
  'cbabcabacacbcababcacbcbacabcabcbacabcbabacabcbcacabcbabacabcabcacbcbabacb',
  'cacabcbabacbcabacbcacababcabcbacbcacabcbacbabcacbacabacbcbabcacbabacbcaba',
  'cabcacbcbabacbacbcacababcacbabcbcacbabacacbcbacbabcabacacbcbacbacabacbabc',
  'abcbacacbcababcacbcabacbcbabcacabcababcabcabcbcacabacbcbacabacbcbacababca',
  'bcabcabcacbcbabcabacbcacbacbacbabacbcabcabacabcbacacbcbacbabacabcacbcbacb',
].join('')

const SWEEP_OVER_SIXTEEN = [
  '47ac0bfe1d1c52e67f908bd4a3237da15b6f4e0c89716da2e45cf980b3236c7594df1e8a0',
  'b6b1708fcae49235ded4c1973f2568ba08db57ca94f3e02612f13c6ead4705b98d80731fc',
  '46b5a92e6d4e17cf3592b0a8a48bf935c26de170c1e6307492bf58da8a0de173f5269bc49',
  '0b3d8754e61a2fce49a186d3f527b0cafc6e8514972d0b36ebfc27d950a8431241a8563cb',
  '0edf97579213a4f80bcd6e09ca7f2d86351e4b0cfed59b281437a6fa32814e7569db0c0c7',
].join('')

describe('selectGrooveForDate determinism (under ROTA_EPOCH)', () => {
  it('pins the epoch the sweeps were captured under', () => {
    expect(ROTA_EPOCH).toBe(3)
  })

  it('assigns the same groove to every date of a year-long sweep (3 grooves)', () => {
    expect(sweep(['a', 'b', 'c'].map(sweepGroove))).toBe(SWEEP_OVER_THREE)
  })

  it('assigns the same groove to every date of a year-long sweep (16 grooves)', () => {
    expect(sweep('0123456789abcdef'.split('').map(sweepGroove))).toBe(SWEEP_OVER_SIXTEEN)
  })

  it('sweeps a full year of local calendar days', () => {
    expect(SWEEP_OVER_THREE).toHaveLength(SWEEP_DAYS)
    expect(SWEEP_OVER_SIXTEEN).toHaveLength(SWEEP_DAYS)
    expect(isoDate(SWEEP_START)).toBe('2026-01-01')
  })
})

const makeGrooves = (count: number): Groove[] =>
  Array.from({ length: count }, (_, i) => sweepGroove(`g${String(i).padStart(2, '0')}`))

const dayAt = (offset: number): Date => new Date(1970, 0, 1 + offset, 12, 0, 0, 0)

const indexAt = (offset: number): number => dayIndexOf(isoDate(dayAt(offset)))

const lapStart = (n: number, from = 0): number => {
  let offset = from
  while (indexAt(offset) % n !== 0) offset += 1
  return offset
}

const SEAM_SPAN = 5_000

const idsOver = (grooves: Groove[], startOffset: number, days: number): string[] =>
  Array.from({ length: days }, (_, i) => selectGrooveForDate(dayAt(startOffset + i), grooves).id)

describe('dayIndexOf', () => {
  it('counts days from the 1970-01-01 epoch', () => {
    expect(dayIndexOf('1970-01-01')).toBe(0)
    expect(dayIndexOf('1970-01-02')).toBe(1)
  })

  it('advances by exactly one across a DST transition', () => {
    expect(dayIndexOf('2026-03-29')).toBe(dayIndexOf('2026-03-28') + 1)
    expect(dayIndexOf('2026-03-30')).toBe(dayIndexOf('2026-03-29') + 1)
    expect(dayIndexOf('2026-10-25')).toBe(dayIndexOf('2026-10-24') + 1)
  })

  it('is the same for any clock time on the same calendar day', () => {
    expect(dayIndexOf(isoDate(new Date(2026, 7, 30, 0, 0, 1)))).toBe(
      dayIndexOf(isoDate(new Date(2026, 7, 30, 23, 59, 59))),
    )
  })
})

describe('selectGrooveForDate rotation', () => {
  it('plays every groove exactly once across a lap of N days (AC1)', () => {
    const grooves = makeGrooves(16)
    const start = lapStart(16, 20_000)
    const ids = idsOver(grooves, start, 16)
    expect(new Set(ids).size).toBe(16)
    expect([...ids].sort()).toEqual(grooves.map((g) => g.id).sort())
  })

  it('returns the same groove for the same date however often it is asked (AC2)', () => {
    const grooves = makeGrooves(16)
    const start = lapStart(16, 20_000)
    const first = selectGrooveForDate(dayAt(start + 5), grooves)
    expect(selectGrooveForDate(dayAt(start + 5), grooves)).toBe(first)
    expect(selectGrooveForDate(new Date(dayAt(start + 5).getTime()), grooves)).toBe(first)
  })

  it('returns the same groove at two different times of the same day (AC3)', () => {
    const grooves = makeGrooves(16)
    const morning = new Date(2026, 7, 30, 0, 30, 0)
    const night = new Date(2026, 7, 30, 23, 30, 0)
    expect(selectGrooveForDate(morning, grooves)).toBe(selectGrooveForDate(night, grooves))
  })

  it('plays every groove exactly twice across two laps (AC5)', () => {
    const grooves = makeGrooves(16)
    const start = lapStart(16, 20_000)
    const counts = new Map<string, number>()
    for (const id of idsOver(grooves, start, 32)) {
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    expect(counts.size).toBe(16)
    expect([...counts.values()].every((n) => n === 2)).toBe(true)
  })

  it('never opens a lap on the groove that closed the one before (AC4)', () => {
    const grooves = makeGrooves(16)
    const boundaries: string[] = []
    for (let offset = 1; offset < SEAM_SPAN; offset += 1) {
      if (indexAt(offset) % 16 !== 0) continue
      const closing = selectGrooveForDate(dayAt(offset - 1), grooves).id
      const opening = selectGrooveForDate(dayAt(offset), grooves).id
      if (closing === opening) boundaries.push(`day ${indexAt(offset)}: ${opening} twice`)
    }
    expect(boundaries).toEqual([])
  })

  it('plays all sixty grooves exactly once across a lap at the shipped size (AC4)', () => {
    const grooves = makeGrooves(60)
    const start = lapStart(60, 20_000)
    const ids = idsOver(grooves, start, 60)
    expect(new Set(ids).size).toBe(60)
    expect([...ids].sort()).toEqual(grooves.map((g) => g.id).sort())
  })

  it('returns the same groove object a hundred times over for one date (AC5)', () => {
    const grooves = makeGrooves(60)
    const day = dayAt(20_007)
    const first = selectGrooveForDate(day, grooves)
    for (let i = 0; i < 100; i += 1) {
      expect(selectGrooveForDate(dayAt(20_007), grooves)).toBe(first)
    }
  })

  it('never repeats on two consecutive days at all (AC4)', () => {
    const grooves = makeGrooves(16)
    const repeats: string[] = []
    for (let offset = 1; offset < SEAM_SPAN; offset += 1) {
      const today = selectGrooveForDate(dayAt(offset), grooves).id
      if (today === selectGrooveForDate(dayAt(offset - 1), grooves).id) {
        repeats.push(`day ${indexAt(offset)}: ${today} twice`)
      }
    }
    expect(repeats).toEqual([])
  })
})

describe('selectGrooveForDate with a degenerate rotation (AC7)', () => {
  it('throws on an empty rotation', () => {
    expect(() => selectGrooveForDate(new Date(2026, 7, 30), [])).toThrow(
      'selectGrooveForDate: grooves must not be empty',
    )
  })

  it('returns the only groove every day, without looping forever', () => {
    const one = makeGrooves(1)
    for (let offset = 0; offset < 10; offset += 1) {
      expect(selectGrooveForDate(dayAt(20_000 + offset), one)).toBe(one[0])
    }
  })

  it('strictly alternates a rotation of two, with no repeat at any seam', () => {
    const two = makeGrooves(2)
    const ids = idsOver(two, 20_000, 40)
    expect(new Set(ids).size).toBe(2)
    for (let i = 1; i < ids.length; i += 1) expect(ids[i]).not.toBe(ids[i - 1])
  })
})

describe('selectGrooveForDate with a grown rotation (AC6)', () => {
  it('keeps the once-per-lap guarantee at the new size', () => {
    const grooves = makeGrooves(18)
    const start = lapStart(18, 20_000)
    const ids = idsOver(grooves, start, 18)
    expect(new Set(ids).size).toBe(18)
  })

  it('keeps the lap seam guarded at the new size', () => {
    const grooves = makeGrooves(18)
    const boundaries: string[] = []
    for (let offset = 1; offset < SEAM_SPAN; offset += 1) {
      if (indexAt(offset) % 18 !== 0) continue
      const closing = selectGrooveForDate(dayAt(offset - 1), grooves).id
      const opening = selectGrooveForDate(dayAt(offset), grooves).id
      if (closing === opening) boundaries.push(`day ${indexAt(offset)}: ${opening} twice`)
    }
    expect(boundaries).toEqual([])
  })

  it('reassigns dates when the rotation changes size — the accepted cost (R6a)', () => {
    const sixteen = makeGrooves(16)
    const eighteen = makeGrooves(18)
    const start = lapStart(16, 20_000)
    const differs = Array.from({ length: 40 }, (_, i) => dayAt(start + i)).some(
      (date) => selectGrooveForDate(date, sixteen).id !== selectGrooveForDate(date, eighteen).id,
    )
    expect(differs).toBe(true)
  })
})

describe('the rota epoch', () => {
  it('ships as 3', () => {
    expect(ROTA_EPOCH).toBe(3)
  })

  it('reshuffles every lap when it is bumped (AC1)', () => {
    const grooves = makeGrooves(60)
    const unmoved: string[] = []
    for (let lap = 0; lap <= 5; lap += 1) {
      const before = orderFor(lap, grooves, 2).map((g) => g.id)
      const after = orderFor(lap, grooves, 3).map((g) => g.id)
      if (before.join(',') === after.join(',')) unmoved.push(`lap ${lap}`)
    }
    expect(unmoved).toEqual([])
  })

  it('defaults to the shipped epoch', () => {
    const grooves = makeGrooves(60)
    expect(orderFor(3, grooves).map((g) => g.id)).toEqual(
      orderFor(3, grooves, ROTA_EPOCH).map((g) => g.id),
    )
  })

  it('carries into the lap-boundary guard, under any epoch (AC6)', () => {
    const grooves = makeGrooves(60)
    const collisions: string[] = []
    for (const epoch of [1, 2, 3]) {
      for (let lap = 1; lap <= 200; lap += 1) {
        const opening = orderFor(lap, grooves, epoch)[0].id
        const closing = orderFor(lap - 1, grooves, epoch)[59].id
        if (opening === closing) collisions.push(`epoch ${epoch}, lap ${lap}: ${opening} twice`)
      }
    }
    expect(collisions).toEqual([])
  })

  it('keeps the seam guarded across a long sweep at the shipped size (AC6)', () => {
    const grooves = makeGrooves(60)
    const boundaries: string[] = []
    for (let offset = 1; offset < SEAM_SPAN; offset += 1) {
      if (indexAt(offset) % 60 !== 0) continue
      const closing = selectGrooveForDate(dayAt(offset - 1), grooves).id
      const opening = selectGrooveForDate(dayAt(offset), grooves).id
      if (closing === opening) boundaries.push(`day ${indexAt(offset)}: ${opening} twice`)
    }
    expect(boundaries).toEqual([])
  })
})

const VARIED_ROOTS: Root[] = ['C', 'D', 'E', 'F', 'G', 'A']
const VARIED_MODES = ['Dorian', 'Ionian', 'Phrygian', 'Aeolian', 'Lydian', 'Mixolydian']
const VARIED_STYLES = ['straight-funk', 'shuffle', 'bossa-nova', 'boom-bap']

// The sweep fixtures above are deliberately uniform, so the constraint can never
// be satisfied on them and they only exercise the fallback. This one has the
// spread the rule is about.
const variedGrooves = (count: number): Groove[] =>
  Array.from({ length: count }, (_, i) => ({
    ...sweepGroove(`v${String(i).padStart(2, '0')}`),
    root: VARIED_ROOTS[i % VARIED_ROOTS.length],
    flavour: VARIED_MODES[(i * 5) % VARIED_MODES.length],
    style: VARIED_STYLES[i % VARIED_STYLES.length],
  }))

const clashesOver = (grooves: Groove[], days: number, from = 20_000): string[] => {
  const played = Array.from({ length: days }, (_, i) =>
    selectGrooveForDate(dayAt(from + i), grooves),
  )
  const clashes: string[] = []
  for (let i = 2; i < played.length; i += 1) {
    for (const earlier of [played[i - 1], played[i - 2]] as const) {
      const day = `day ${indexAt(from + i)}`
      if (played[i].root === earlier.root) clashes.push(`${day}: root ${played[i].root}`)
      if (played[i].flavour === earlier.flavour) clashes.push(`${day}: mode ${played[i].flavour}`)
      if (played[i].style === earlier.style) clashes.push(`${day}: style ${played[i].style}`)
    }
  }
  return clashes
}

describe('no repeats within three days (quick 11)', () => {
  it('repeats no root, mode or style over a long run of consecutive days (D1, D2, D3)', () => {
    expect(clashesOver(variedGrooves(24), 2_000)).toEqual([])
  })

  it('holds across every lap seam, not just inside a lap (D1, D2, D3)', () => {
    const grooves = variedGrooves(24)
    const seams: string[] = []
    for (let offset = 1; offset < SEAM_SPAN; offset += 1) {
      if (indexAt(offset) % 24 !== 0) continue
      seams.push(...clashesOver(grooves, 4, offset - 2))
    }
    expect(seams).toEqual([])
  })

  it('still plays every groove exactly once a lap (D1)', () => {
    const grooves = variedGrooves(24)
    const start = lapStart(24, 20_000)
    const ids = idsOver(grooves, start, 24)
    expect(new Set(ids).size).toBe(24)
    expect([...ids].sort()).toEqual(grooves.map((g) => g.id).sort())
  })

  it('resolves a far-future date to the same member of the set every time', () => {
    const grooves = variedGrooves(24)
    const first = selectGrooveForDate(new Date('2099-01-01'), grooves)
    expect(selectGrooveForDate(new Date('2099-01-01'), grooves)).toBe(first)
    expect(grooves).toContain(first)
  })

  it('gives a lap the same order whether it is reached forwards or revisited', () => {
    const grooves = variedGrooves(24)
    const far = orderFor(400, grooves).map((g) => g.id)
    const near = orderFor(12, grooves).map((g) => g.id)
    expect(orderFor(400, grooves).map((g) => g.id)).toEqual(far)
    expect(orderFor(12, grooves).map((g) => g.id)).toEqual(near)
    expect(far).not.toEqual(near)
  })

  it('treats a missing style as no constraint, so uniform fixtures still resolve', () => {
    const bare = makeGrooves(16)
    expect(bare.every((g) => g.style === undefined)).toBe(true)
    expect(new Set(idsOver(bare, lapStart(16, 20_000), 16)).size).toBe(16)
  })
})

describe('selectGrooveForDate with a pinned groove', () => {
  const grooves = makeGrooves(60)
  const day = dayAt(20_011)
  const mix = selectGrooveForDate(day, grooves)
  const other = grooves.find((g) => g.id !== mix.id) as Groove

  it('serves the pinned groove over the one the mix gives (AC7)', () => {
    expect(selectGrooveForDate(day, grooves, other.id)).toBe(other)
  })

  it('takes the mix when no id is pinned (AC8)', () => {
    expect(selectGrooveForDate(day, grooves, undefined)).toBe(mix)
  })

  it('takes the mix when the pinned id names no groove in the catalogue (AC9)', () => {
    expect(() => selectGrooveForDate(day, grooves, 'groove-does-not-exist')).not.toThrow()
    expect(selectGrooveForDate(day, grooves, 'groove-does-not-exist')).toBe(mix)
  })

  it('takes the mix when the pinned id is the empty string', () => {
    expect(selectGrooveForDate(day, grooves, '')).toBe(mix)
  })

  it('is no special case when the pin agrees with the mix', () => {
    expect(selectGrooveForDate(day, grooves, mix.id)).toBe(mix)
  })

  it('still throws on an empty catalogue, pin or no pin (AC7)', () => {
    expect(() => selectGrooveForDate(day, [], 'g00')).toThrow(
      'selectGrooveForDate: grooves must not be empty',
    )
  })
})
