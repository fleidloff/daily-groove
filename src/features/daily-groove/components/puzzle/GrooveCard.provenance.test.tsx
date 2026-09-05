import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { GrooveCard } from './GrooveCard'
import { puzzle } from '@/lib/snippets'
import { GROOVES } from '../../data/grooves.generated'

const PACK = 'scripts/grooves/samples/provenance.json'
// Composed, not written out: snippets.test.ts fails any file outside
// src/lib/snippets/ that spells the language folder's path.
const SNIPPETS = ['src/lib/snippets', 'en', 'puzzle.ts'].join('/')

const FIX =
  `The sample pack and the credit line the app renders have drifted apart. ` +
  `${PACK} says what has to be credited; the line is drumCredit + ` +
  `drumCreditPublisher in ${SNIPPETS}, followed by the licence link in ` +
  `GrooveCard.tsx. Reword the snippets (and the licence link, if the licence ` +
  `itself changed) so the line still credits what the pack now holds.`

type Provenance = {
  attributions?: string[]
  samples: { source: string; licence: string }[]
}

const provenance = JSON.parse(
  readFileSync(resolve(process.cwd(), PACK), 'utf8'),
) as Provenance

const attributions = provenance.attributions ?? []

// A licence that dedicates to the public domain asks for no credit, so the
// line does not have to cover it. Anything else does, and an unrecognised
// value falls through to the covered-licence check rather than being waved
// past. scripts/grooves/samples/pack.test.ts also admits 'public-domain',
// which no row uses today.
const NO_ATTRIBUTION_REQUIRED = new Set(['CC0', 'CC0-1.0', 'PUBLIC-DOMAIN'])

const canonicalLicence = (licence: string) =>
  licence.trim().toUpperCase().replace(/[\s_]+/g, '-')

const libraryOf = (source: string) => source.split(/[\s,(]/)[0]

const attributedLibraries = [
  ...new Set(
    provenance.samples
      .filter((row) => !NO_ATTRIBUTION_REQUIRED.has(canonicalLicence(row.licence)))
      .map((row) => libraryOf(row.source)),
  ),
].sort()

const publishers = [
  ...new Set(
    attributions.flatMap((entry) =>
      [...entry.matchAll(/\b[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.(?:org|com|net|io)\b/g)].map((m) => m[0]),
    ),
  ),
].sort()

const rowLicences = [
  ...new Set(provenance.samples.map((row) => canonicalLicence(row.licence))),
].sort()

function renderedCredit() {
  render(<GrooveCard groove={GROOVES[0]} meta="" />)
  const paragraph = screen
    .getByRole('link', { name: puzzle.drumCredit })
    .closest('p') as HTMLElement
  const licenceLink = within(paragraph)
    .getAllByRole('link')
    .find((link) => /creativecommons\.org\/licenses\//.test(link.getAttribute('href') ?? ''))

  return { line: paragraph.textContent ?? '', licenceLink }
}

describe('the credit line answers to the sample pack (F24 E3, Track D follow-up)', () => {
  it('reads the pack it is meant to be checking', () => {
    expect(provenance.samples.length, `${PACK} declares no samples.`).toBeGreaterThan(0)
    expect(
      attributedLibraries.length,
      `No row in ${PACK} carries a licence that requires attribution, so this ` +
        `guard would pass without checking anything. Either the pack changed ` +
        `shape or its licence values did — read the rows before trusting this file.`,
    ).toBeGreaterThan(0)
    expect(
      publishers.length,
      `No publisher could be read out of the attributions in ${PACK}, so the ` +
        `publisher check below would pass vacuously. The entries no longer name ` +
        `a domain; derive the publisher differently or fix the pack.`,
    ).toBeGreaterThan(0)
  })

  it('names every library the pack says must be attributed', () => {
    const { line } = renderedCredit()
    const missing = attributedLibraries.filter((library) => !line.includes(library))

    expect(
      missing,
      `${FIX} The line reads "${line}" and never names ${missing.join(', ')}, ` +
        `which ${PACK} lists under a licence that requires attribution.`,
    ).toEqual([])
  })

  it('names the publisher the attributions credit', () => {
    const { line } = renderedCredit()
    const missing = publishers.filter((publisher) => !line.includes(publisher))

    expect(
      missing,
      `${FIX} The attributions in ${PACK} credit ${missing.join(', ')}, and the ` +
        `line "${line}" does not name them.`,
    ).toEqual([])
  })

  it('was written for exactly the two attributions the pack declares', () => {
    expect(
      attributions.length,
      `${FIX} ${PACK} now declares ${attributions.length} attribution ` +
        `entries (${JSON.stringify(attributions)}), not the 2 the merged line ` +
        `was written against. A library was added or removed, so the line is ` +
        `crediting the wrong set — rewrite it against the new entries, then ` +
        `move this count with it.`,
    ).toBe(2)
  })

  it('links a licence that covers every licence in the pack', () => {
    const { licenceLink } = renderedCredit()

    expect(
      licenceLink,
      `${FIX} The credit line links no Creative Commons licence at all, so ` +
        `nothing in ${PACK} is covered.`,
    ).toBeDefined()

    const href = licenceLink?.getAttribute('href') ?? ''
    const parts = href.match(/creativecommons\.org\/licenses\/([a-z-]+)\/([\d.]+)/)
    const linked = parts ? `CC-${parts[1].toUpperCase()}-${parts[2]}` : ''

    expect(
      linked,
      `${FIX} The licence link points at "${href}", which is not a Creative ` +
        `Commons licence URL this guard can read.`,
    ).not.toBe('')
    expect(
      canonicalLicence(licenceLink?.textContent ?? ''),
      `${FIX} The licence link reads "${licenceLink?.textContent}" but points ` +
        `at ${href}. The words and the URL must name the same licence.`,
    ).toBe(linked)

    const uncovered = rowLicences.filter(
      (licence) => !NO_ATTRIBUTION_REQUIRED.has(licence) && licence !== linked,
    )

    expect(
      uncovered,
      `${FIX} Rows in ${PACK} are licensed ${uncovered.join(', ')}, and the ` +
        `line links only ${linked}. Either the link is wrong or a second ` +
        `licence now needs naming.`,
    ).toEqual([])
  })
})
