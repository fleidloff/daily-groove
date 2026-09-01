import { afterEach, describe, expect, it, vi } from 'vitest'
import { GROOVES } from '../../data/grooves.generated'
import { grooveByUuid } from './grooveByUuid'

/**
 * Feature-12, Epic 1, Step B1 — R1b, R12, R13; AC7, AC15.
 *
 * The uuids are read from the committed `GROOVES` rather than written out here,
 * so a re-render of the manifest cannot leave this file asserting against a
 * groove that no longer exists.
 */

/**
 * A canonical v4 uuid that no groove holds. Asserted against the manifest
 * below, so it cannot quietly become a real groove's uuid.
 */
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
    // The premise: the fixture really is unused.
    expect(GROOVES.map((groove) => groove.uuid)).not.toContain(UNUSED_UUID)

    expect(grooveByUuid(UNUSED_UUID)).toBeUndefined()
  })

  it('resolves nothing for a groove id — the uuid is the only link identifier (R1)', () => {
    expect(grooveByUuid(GROOVES[0].id)).toBeUndefined()
  })

  it('resolves the same groove on any day (R13)', () => {
    // R13 holds by construction — nothing here reads a clock — so the clock is
    // moved under it rather than the source being inspected.
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
