import { beforeEach, describe, expect, it } from 'vitest'
import type { DailyResult, Groove } from '../../types'
import { isoDate } from '@/lib/date'
import { answerOf } from '@/lib/theory/music'
import { GROOVES } from '../../data/grooves.generated'
import { createLocalStore } from '../persistence/storage'
import { computeStreak } from '../persistence/streak'
import { selectGrooveForDate } from './selectGroove'
import { dailyGroove } from './dailyGroove'

const DAY = new Date(2026, 8, 1)
const MIX = selectGrooveForDate(DAY, GROOVES)

async function save(result: Partial<DailyResult> & { date: string }): Promise<void> {
  await createLocalStore().save({
    answer: { root: 'C', flavour: 'Dorian' },
    attempts: [],
    solved: true,
    ...result,
  })
}

describe('dailyGroove', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('takes the mix when nothing is stored for the day (AC8)', () => {
    expect(dailyGroove(DAY).uuid).toBe(MIX.uuid)
  })

  it('serves the groove a played day was played on (AC7)', async () => {
    const played = GROOVES.find((g) => g.uuid !== MIX.uuid)
    expect(played).toBeDefined()

    await save({ date: isoDate(DAY), grooveId: played!.id })

    expect(dailyGroove(DAY).uuid).toBe(played!.uuid)
  })

  it('takes the mix when the stored result carries no groove id (AC8)', async () => {
    await save({ date: isoDate(DAY) })

    expect(dailyGroove(DAY).uuid).toBe(MIX.uuid)
  })

  it('takes the mix when the stored groove id names no groove, and never throws (AC9)', async () => {
    await save({ date: isoDate(DAY), grooveId: 'groove-nope' })

    expect(() => dailyGroove(DAY)).not.toThrow()
    expect(dailyGroove(DAY).uuid).toBe(MIX.uuid)
  })

  it('reads the pin for the day it is asked about, not for another day (AC7)', async () => {
    const other = new Date(2026, 8, 2)
    const pinned = GROOVES.find(
      (g) => g.uuid !== MIX.uuid && g.uuid !== selectGrooveForDate(other, GROOVES).uuid,
    )
    expect(pinned).toBeDefined()

    await save({ date: isoDate(DAY), grooveId: pinned!.id })

    expect(dailyGroove(DAY).uuid).toBe(pinned!.uuid)
    expect(dailyGroove(other).uuid).toBe(selectGrooveForDate(other, GROOVES).uuid)
  })
})

describe('a run of played days, through the store the app writes to', () => {
  const START = new Date(2026, 5, 1)

  const dayAt = (offset: number): Date =>
    new Date(START.getFullYear(), START.getMonth(), START.getDate() + offset)

  const playedOn = (day: Date): Groove => {
    const mix = selectGrooveForDate(day, GROOVES)
    const at = GROOVES.findIndex((g) => g.uuid === mix.uuid)
    return GROOVES[(at + 1) % GROOVES.length]
  }

  const run = () =>
    Array.from({ length: GROOVES.length }, (_, i) => {
      const day = dayAt(i)
      return { day, iso: isoDate(day), groove: playedOn(day) }
    })

  const play = async (): Promise<ReturnType<typeof run>> => {
    const days = run()
    for (const { iso, groove } of days) {
      await save({
        date: iso,
        answer: answerOf(groove),
        attempts: [{ ...answerOf(groove), correct: true, rootMatched: true, flavourMatched: true }],
        grooveId: groove.id,
      })
    }
    return days
  }

  beforeEach(() => {
    localStorage.clear()
  })

  it('plays every day on a groove the mix would not have given', () => {
    const agreeing = run()
      .filter(({ day, groove }) => selectGrooveForDate(day, GROOVES).uuid === groove.uuid)
      .map(({ iso }) => iso)

    expect(agreeing).toEqual([])
  })

  it('reopens every stored day on the groove it was played on', async () => {
    const days = await play()

    const reassigned = days
      .filter(({ day, groove }) => dailyGroove(day).uuid !== groove.uuid)
      .map(({ day, iso, groove }) => `${iso}: played ${groove.id}, reopens as ${dailyGroove(day).id}`)

    expect(reassigned).toEqual([])
  })

  it('keeps the answer the player was scored against on every stored day', async () => {
    const days = await play()
    const store = createLocalStore()

    const moved: string[] = []
    for (const { day, iso } of days) {
      const stored = await store.get(iso)
      const now = answerOf(dailyGroove(day))
      if (stored?.answer.root !== now.root || stored?.answer.flavour !== now.flavour) {
        moved.push(`${iso}: solved as ${stored?.answer.root} ${stored?.answer.flavour}, now ${now.root} ${now.flavour}`)
      }
    }

    expect(moved).toEqual([])
  })

  it('reads every played day back out of the store it was written to', async () => {
    const days = await play()

    expect(await createLocalStore().getAll()).toHaveLength(days.length)
  })

  it('adds the run up to a streak one per day, unbroken', async () => {
    const days = await play()
    const dayAfter = dayAt(days.length)

    expect(computeStreak(await createLocalStore().getAll(), isoDate(dayAfter))).toBe(days.length)
  })
})
