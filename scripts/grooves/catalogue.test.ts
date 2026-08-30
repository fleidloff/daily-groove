import { describe, expect, it } from 'vitest'
import { readCatalogue } from './catalogue.ts'
import { buildEvents } from './events.ts'
import { allTemplates, templateById } from './templates/index.ts'
import { isValidHarmony } from './theory/validity.ts'
import type { Flavour } from './types.ts'

const specs = readCatalogue()
const built = specs.map((spec) => ({ spec, ...buildEvents(spec, templateById(spec.template)) }))

/** The number in `groove-NN`. */
function numberOf(id: string): number {
  const match = /^groove-(\d+)$/.exec(id)
  if (!match) throw new Error(`not a groove id: ${id}`)
  return Number(match[1])
}

/**
 * Epic 4 retired these four: two `Blues` and two `Harmonic minor`, the flavours
 * that are not modes. `groove-15` and `groove-16` were the two highest ids in
 * the catalogue, which is why the six replacements were minted *before* the
 * deletion — see the id-reissue assertion below.
 */
const RETIRED = ['groove-05', 'groove-06', 'groove-15', 'groove-16']

/** Every id this project has ever issued: sixteen originally, six minted in Epic 4. */
const IDS_EVER_ISSUED = 22

describe('the committed catalogue', () => {
  it('holds eighteen grooves, drawn from every template', () => {
    expect(specs).toHaveLength(18)
    for (const template of allTemplates()) {
      expect(
        specs.filter((s) => s.template === template.id).length,
        template.id,
      ).toBeGreaterThan(0)
    }
  })

  it('gives every groove a unique, well-formed id and a unique seed', () => {
    expect(new Set(specs.map((s) => s.id)).size).toBe(specs.length)
    expect(new Set(specs.map((s) => s.seed)).size).toBe(specs.length)
    for (const s of specs) expect(s.id).toMatch(/^groove-\d{2}$/)
  })

  // Step B2 — R6a, AC7b. `selectSeeds` allocates from the highest number ever
  // used, never from the catalogue's length, so a groove that leaves the
  // rotation does not free its id for different audio. The high-water mark is
  // therefore 22 even though only eighteen grooves remain, and a re-issued id
  // shows up here as a mark that has regressed to the count.
  it('never re-issues an id — the high-water mark is every id ever issued', () => {
    const numbers = specs.map((s) => numberOf(s.id))
    expect(new Set(numbers).size, 'an id was issued twice').toBe(numbers.length)
    expect(Math.max(...numbers)).toBe(IDS_EVER_ISSUED)
    // The mark stands above the count precisely because four ids were retired
    // and none of them came back.
    expect(IDS_EVER_ISSUED - specs.length).toBe(RETIRED.length)
  })

  // Step C1 — R4, AC5. The retirement is a deletion from the catalogue, not a
  // flag on an entry: the generator's whole definition of a groove is its
  // catalogue row, so removing the row is what removes the groove.
  it('no longer carries the four retired grooves', () => {
    for (const id of RETIRED) {
      expect(specs.map((s) => s.id), id).not.toContain(id)
    }
  })

  it('names only templates that exist', () => {
    for (const s of specs) expect(() => templateById(s.template)).not.toThrow()
  })

  // Step C3 — R5a, AC6a. Six modes, three grooves each. `blues` and
  // `harmonic-minor` are still in their templates' flavour arrays, so the
  // assertion is about what the catalogue carries, not about what a seed could
  // in principle draw.
  it('puts exactly three grooves behind each of the six modes, and none behind blues or harmonic minor', () => {
    const counts = new Map<Flavour, number>()
    for (const { music } of built) counts.set(music.flavour, (counts.get(music.flavour) ?? 0) + 1)
    expect([...counts.keys()].sort()).toEqual([
      'aeolian',
      'dorian',
      'ionian',
      'lydian',
      'mixolydian',
      'phrygian',
    ])
    for (const [flavour, n] of counts) expect(n, flavour).toBe(3)
  })

  it('asks a different question every time — no repeated root and flavour', () => {
    const answers = built.map(({ music }) => `${music.root}|${music.flavour}`)
    expect(new Set(answers).size).toBe(built.length)
  })

  it('never repeats a scale-and-progression pair', () => {
    const pairs = built.map(({ music }) => `${music.scale}|${music.progression}`)
    expect(new Set(pairs).size).toBe(built.length)
  })

  // Step I1 — validity is per flavour, so this must go through the rule table
  // rather than scanning for strict scale membership, or blues fails its own check.
  it('plays harmony its flavour’s rule allows, for every entry', () => {
    for (const { spec, music, harmony } of built) {
      expect(isValidHarmony(music, harmony), `${spec.id} — ${music.scale} ${music.progression}`).toBe(
        true,
      )
    }
  })

  it('spreads grooves across keys and tempos rather than clustering', () => {
    expect(new Set(built.map((b) => b.music.root)).size).toBeGreaterThanOrEqual(8)
    const tempos = built.map((b) => b.music.bpm)
    expect(Math.max(...tempos) - Math.min(...tempos)).toBeGreaterThanOrEqual(40)
  })

  // Was: "matches what selectSeeds would produce, so the committed file is not
  // hand-edited". Epic 4 hand-edited it deliberately — four rows deleted — so
  // the whole-file equality cannot hold any more. What it was really guarding
  // survives here: every groove that was in the first generation is still the
  // one `selectSeeds` produced, at the same id, on the same seed. That is R6 —
  // no survivor re-seeded, re-templated or renumbered.
  it('leaves every first-generation survivor exactly as selectSeeds produced it', async () => {
    const { selectSeeds } = await import('./select.ts')
    const original = selectSeeds(allTemplates(), { perTemplate: 4 })
    expect(original).toHaveLength(16)

    const survivors = specs.filter((s) => numberOf(s.id) <= 16)
    expect(survivors).toHaveLength(16 - RETIRED.length)
    expect(survivors).toEqual(original.filter((s) => !RETIRED.includes(s.id)))
  })

  // The six Epic 4 grooves are appended after the first generation, never
  // interleaved into it, so the file reads as the mint history it is.
  it('lists the grooves in issue order, with the Epic 4 mint at the end', () => {
    const numbers = specs.map((s) => numberOf(s.id))
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
    expect(specs.slice(-6).map((s) => s.id)).toEqual([
      'groove-17',
      'groove-18',
      'groove-19',
      'groove-20',
      'groove-21',
      'groove-22',
    ])
  })
})
