import { describe, it, expect } from 'vitest'
import type { DailyResult, Groove } from '../types'
import { selectGrooveForDate } from './selectGroove'
import { resolveGrooveForResult } from './resolveGroove'

function groove(id: string): Groove {
  return {
    id,
    audioSrc: `/grooves/${id}.mp3`,
    name: `Groove ${id}`,
    bpm: 90,
    root: 'C',
    flavour: 'Minor',
    bars: 4,
    scale: 'C minor',
    chord: 'Cm',
    progression: 'Cm–F–G',
  }
}

function result(date: string, grooveId?: string): DailyResult {
  return {
    date,
    answer: { root: 'C', flavour: 'Minor' },
    attempts: [],
    solved: true,
    ...(grooveId === undefined ? {} : { grooveId }),
  }
}

/**
 * Noon-anchored, as `archive.ts` and `streak.ts` parse: a DST step must not
 * land the record on the wrong calendar day.
 */
function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

describe('resolveGrooveForResult', () => {
  // B1
  it('resolves a record that carries a groove id by that id', () => {
    const grooves = [groove('groove-01'), groove('groove-02')]
    expect(resolveGrooveForResult(result('2026-08-24', 'groove-02'), grooves)).toBe(grooves[1])
  })

  it('prefers the stored id over what the date would pick', () => {
    const grooves = [groove('groove-01'), groove('groove-02'), groove('groove-03')]
    const date = '2026-08-24'
    const byDate = selectGrooveForDate(parseIsoDate(date), grooves)
    const other = grooves.find((g) => g !== byDate)!
    expect(resolveGrooveForResult(result(date, other.id), grooves)).toBe(other)
  })

  // B2
  it('resolves a record without a groove id by its date', () => {
    const grooves = [groove('groove-01'), groove('groove-02'), groove('groove-03')]
    const date = '2026-08-24'
    expect(resolveGrooveForResult(result(date), grooves)).toBe(
      selectGrooveForDate(parseIsoDate(date), grooves),
    )
  })

  it('parses the record date noon-anchored, so it never slips a calendar day', () => {
    const grooves = [groove('groove-01'), groove('groove-02'), groove('groove-03')]
    for (const date of ['2026-03-29', '2026-10-25', '2026-01-01', '2026-12-31']) {
      expect(resolveGrooveForResult(result(date), grooves)).toBe(
        selectGrooveForDate(parseIsoDate(date), grooves),
      )
    }
  })

  // B3 — the regression this epic exists to prevent.
  it('keeps an id-carrying record on the same groove when the catalogue grows, while a date-only record drifts', () => {
    // 2026-08-24 hashes to index 2 of 3 and index 3 of 4 — the drift is real,
    // not accidental.
    const date = '2026-08-24'
    const before = [groove('groove-01'), groove('groove-02'), groove('groove-03')]
    const after = [...before, groove('groove-04')]

    const withId = result(date, 'groove-02')
    const withoutId = result(date)

    const idBefore = resolveGrooveForResult(withId, before)
    const idAfter = resolveGrooveForResult(withId, after)
    expect(idBefore).not.toBeNull()
    expect(idAfter?.id).toBe(idBefore?.id)
    expect(idAfter?.id).toBe('groove-02')

    const dateBefore = resolveGrooveForResult(withoutId, before)
    const dateAfter = resolveGrooveForResult(withoutId, after)
    expect(dateBefore).not.toBeNull()
    expect(dateAfter).not.toBeNull()
    expect(dateAfter?.id).not.toBe(dateBefore?.id)
  })

  // B4
  it('returns null for a stored id that is no longer in the catalogue', () => {
    const grooves = [groove('groove-01'), groove('groove-02')]
    expect(resolveGrooveForResult(result('2026-08-24', 'groove-99'), grooves)).toBeNull()
  })

  it('does not fall back to date resolution when the stored id is unknown', () => {
    const grooves = [groove('groove-01'), groove('groove-02'), groove('groove-03')]
    const date = '2026-08-24'
    // The date alone would resolve to a groove; the unknown id must beat it.
    expect(selectGrooveForDate(parseIsoDate(date), grooves)).toBeTruthy()
    expect(resolveGrooveForResult(result(date, 'groove-gone'), grooves)).toBeNull()
  })
})
