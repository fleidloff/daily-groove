import { afterEach, describe, expect, it, vi } from 'vitest'
import { GROOVES } from '../../data/grooves.generated'
import { grooveByUuid } from './grooveByUuid'

const UNUSED_UUID = '00000000-0000-4000-8000-000000000000'

afterEach(() => {
  vi.useRealTimers()
})

describe('grooveByUuid', () => {
  it('resolves a uuid to the groove that holds it (R12, AC7)', () => {
    const entry = GROOVES[0]

    expect(grooveByUuid(entry.uuid)).toBe(entry)
  })

  it('resolves every groove in the manifest by its own uuid (R12, AC7)', () => {
    for (const groove of GROOVES) {
      expect(grooveByUuid(groove.uuid), groove.id).toBe(groove)
    }
  })

  it('resolves a uuid a mail program has capitalised (R1b, AC15)', () => {
    const entry = GROOVES[0]

    expect(grooveByUuid(entry.uuid.toUpperCase())).toBe(entry)
  })

  it('resolves a mixed-case uuid for every groove (R1b, AC15)', () => {
    for (const groove of GROOVES) {
      const shouted = groove.uuid.replace(/[0-9a-f]/g, (char, index) =>
        index % 2 === 0 ? char.toUpperCase() : char,
      )
      expect(grooveByUuid(shouted), groove.id).toBe(groove)
    }
  })

  it('resolves nothing for a string that is not a uuid at all', () => {
    expect(grooveByUuid('nope')).toBeUndefined()
  })

  it('resolves nothing for the empty string', () => {
    expect(grooveByUuid('')).toBeUndefined()
  })

  it('resolves nothing for a well-formed uuid no groove holds (R14)', () => {
    expect(GROOVES.map((groove) => groove.uuid)).not.toContain(UNUSED_UUID)

    expect(grooveByUuid(UNUSED_UUID)).toBeUndefined()
  })

  it('resolves nothing for a groove id — the uuid is the only link identifier (R1)', () => {
    expect(grooveByUuid(GROOVES[0].id)).toBeUndefined()
  })

  it('resolves the same groove on any day (R13)', () => {
    const entry = GROOVES[GROOVES.length - 1]

    vi.useFakeTimers()

    vi.setSystemTime(new Date(2020, 0, 1, 12))
    const early = grooveByUuid(entry.uuid)

    vi.setSystemTime(new Date(2099, 11, 31, 12))
    const late = grooveByUuid(entry.uuid)

    expect(early).toBe(entry)
    expect(late).toBe(entry)
  })

  it('takes no date argument, so no caller can make it day-dependent (R13)', () => {
    expect(grooveByUuid.length).toBe(1)
  })
})
