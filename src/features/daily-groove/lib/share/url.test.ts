import { describe, expect, it } from 'vitest'
import { GROOVES } from '../../data/grooves.generated'
import { GROOVE_PATH, grooveHref, shareUrlOf } from './url'

/**
 * Feature-12, Epic 1, Step B2 — R12; AC14.
 *
 * The groove is taken from the committed manifest rather than hand-made, so the
 * uuid under test is the one a real link would carry.
 */
const groove = GROOVES[0]

describe('GROOVE_PATH', () => {
  it('is the one route segment a shared groove lives under (R16)', () => {
    expect(GROOVE_PATH).toBe('/groove')
  })
})

describe('grooveHref', () => {
  it("is the groove's route, carrying the uuid entire (R12, AC14)", () => {
    expect(grooveHref(groove)).toBe(`/groove/${groove.uuid}`)
  })

  it('is a root-relative path, so it needs no origin to be useful', () => {
    expect(grooveHref(groove).startsWith('/')).toBe(true)
  })

  it('carries every groove in the manifest whole (AC14)', () => {
    for (const entry of GROOVES) {
      expect(grooveHref(entry), entry.id).toBe(`${GROOVE_PATH}/${entry.uuid}`)
    }
  })
})

describe('shareUrlOf', () => {
  it('is the absolute URL of the groove against the given origin (R12, AC14)', () => {
    expect(shareUrlOf(groove, 'https://example.test')).toBe(
      `https://example.test/groove/${groove.uuid}`,
    )
  })

  it('does not double the separator when the origin already ends in a slash', () => {
    expect(shareUrlOf(groove, 'https://example.test/')).toBe(
      `https://example.test/groove/${groove.uuid}`,
    )
  })

  it('yields the same URL with or without the origin’s trailing slash', () => {
    expect(shareUrlOf(groove, 'https://example.test/')).toBe(
      shareUrlOf(groove, 'https://example.test'),
    )
  })

  it('keeps a port and a scheme intact', () => {
    expect(shareUrlOf(groove, 'http://localhost:3000')).toBe(
      `http://localhost:3000/groove/${groove.uuid}`,
    )
  })

  it('carries the uuid entire — no short form, no second identifier (R1a, AC14)', () => {
    expect(shareUrlOf(groove, 'https://example.test')).toContain(groove.uuid)
  })

  it('is spoiler-free by construction: the uuid and nothing else', () => {
    for (const entry of GROOVES) {
      const url = shareUrlOf(entry, 'https://example.test')

      // Positively: the whole URL is the origin, the path and the uuid.
      expect(url, entry.id).toBe(`https://example.test/groove/${entry.uuid}`)
      expect(url, entry.id).toMatch(
        /^https:\/\/example\.test\/groove\/[0-9a-f-]{36}$/,
      )

      // And so it can name none of the things the puzzle asks the player for.
      // Case-sensitive: the manifest capitalises all five, while the URL is
      // lowercase hex, so a hex run inside the uuid cannot be a false hit.
      expect(url, entry.id).not.toContain(entry.root)
      expect(url, entry.id).not.toContain(entry.flavour)
      expect(url, entry.id).not.toContain(entry.scale)
      expect(url, entry.id).not.toContain(entry.chord)
      expect(url, entry.id).not.toContain(entry.progression)
      expect(url, entry.id).not.toContain(`${entry.root} ${entry.flavour}`)
    }
  })

  it('names no groove id and no audio file either', () => {
    for (const entry of GROOVES) {
      const url = shareUrlOf(entry, 'https://example.test')
      expect(url, entry.id).not.toContain(entry.id)
      expect(url, entry.id).not.toContain(entry.audioSrc)
      expect(url, entry.id).not.toContain(entry.name)
    }
  })
})
