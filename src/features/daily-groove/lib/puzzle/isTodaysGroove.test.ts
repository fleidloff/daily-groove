import { beforeEach, describe, expect, it } from 'vitest'
import type { DailyResult } from '../../types'
import { isoDate } from '@/lib/date'
import { isTodaysGroove } from './isTodaysGroove'
import { selectGrooveForDate } from './selectGroove'
import { createLocalStore } from '../persistence/storage'
import { GROOVES } from '../../data/grooves.generated'

describe('isTodaysGroove', () => {
  const DAY = new Date(2026, 8, 1)

  beforeEach(() => {
    localStorage.clear()
  })

  async function save(result: Partial<DailyResult> & { date: string }): Promise<void> {
    await createLocalStore().save({
      answer: { root: 'C', flavour: 'Dorian' },
      attempts: [],
      solved: true,
      ...result,
    })
  }

  it("says yes to the groove the day's own pick returns", () => {
    const todays = selectGrooveForDate(DAY, GROOVES)
    expect(isTodaysGroove(todays, DAY)).toBe(true)
  })

  it('says no to every other groove in the catalogue', () => {
    const todays = selectGrooveForDate(DAY, GROOVES)
    const others = GROOVES.filter((g) => g.uuid !== todays.uuid)

    expect(others).toHaveLength(GROOVES.length - 1)
    for (const other of others) {
      expect(isTodaysGroove(other, DAY), other.id).toBe(false)
    }
  })

  it('answers for the day it is given, not for the day it is called on', () => {
    const days = Array.from({ length: 40 }, (_, i) => new Date(2026, 8, 1 + i))
    const first = selectGrooveForDate(days[0], GROOVES)
    const daysItIsTodays = days.filter((d) => isTodaysGroove(first, d))

    expect(daysItIsTodays.length).toBeGreaterThan(0)
    for (const day of daysItIsTodays) {
      expect(selectGrooveForDate(day, GROOVES).uuid).toBe(first.uuid)
    }
    expect(daysItIsTodays.length).toBeLessThan(days.length)
  })

  it('compares by uuid, not by object identity', () => {
    const todays = selectGrooveForDate(DAY, GROOVES)
    expect(isTodaysGroove({ ...todays }, DAY)).toBe(true)
    expect(
      isTodaysGroove({ ...todays, uuid: '00000000-0000-4000-8000-000000000000' }, DAY),
    ).toBe(false)
  })

  it('answers under the pin: the played groove is today’s, the mix is not (AC12)', async () => {
    const mix = selectGrooveForDate(DAY, GROOVES)
    const pinned = GROOVES.find((g) => g.uuid !== mix.uuid)
    expect(pinned).toBeDefined()

    await save({ date: isoDate(DAY), grooveId: pinned!.id })

    expect(isTodaysGroove(pinned!, DAY)).toBe(true)
    expect(isTodaysGroove(mix, DAY)).toBe(false)
  })
})
