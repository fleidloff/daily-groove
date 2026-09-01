import { useState } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GrooveCard } from './GrooveCard'
import { dateLine, metaLine } from '../../lib/presentation/date'
import type { Groove } from '../../types'
import { GROOVES } from '../../data/grooves.generated'
import { selectGrooveForDate } from '../../lib/puzzle/selectGroove'
import { renderFeature } from '../../testing/renderFeature'

const DAY = new Date(2026, 7, 30)

const GROOVE: Groove = {
  id: 'groove-01',
  uuid: '15a29033-2902-4b56-9166-4b8c8bf17cbc',
  audioSrc: '/grooves/groove-01.mp3',
  name: 'Sunroom Shuffle',
  bpm: 84,
  root: 'G',
  flavour: 'Dorian',
  bars: 4,
  scale: 'G dorian',
  chord: 'Gm9',
  progression: 'Gm9–C13',
  headDelaySeconds: 0.025057,
}

/** The same groove at the tempo most of the assertions below read back. */
const GROOVE_105: Groove = { ...GROOVE, bpm: 105 }

/**
 * The finished meta line, composed exactly as `GroovePuzzleView` composes it
 * (F12 E3 Step A2). The card no longer decides this line — it is handed the
 * string — so the assertions below go through `metaLine` rather than a literal,
 * and the rendered line they were always about stays their subject.
 */
const metaFor = (groove: Groove) => metaLine(groove, DAY)

describe('GrooveCard', () => {
  it("shows the groove's name (D1, AC5)", () => {
    render(<GrooveCard groove={GROOVE} meta={metaFor(GROOVE)} />)
    expect(
      screen.getByRole('heading', { name: 'Sunroom Shuffle' }),
    ).toBeInTheDocument()
  })

  it('shows the tempo as a number and its unit (R1, R5, AC1, AC4)', () => {
    render(<GrooveCard groove={GROOVE_105} meta={metaFor(GROOVE_105)} />)
    expect(screen.getByText('105 bpm · Sunday, 30 August')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Sunroom Shuffle' }),
    ).toBeInTheDocument()
  })

  it('keeps the tempo out of the heading (R3, R4, AC3)', () => {
    render(<GrooveCard groove={GROOVE_105} meta={metaFor(GROOVE_105)} />)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.textContent).toBe('Sunroom Shuffle')
    expect(heading).not.toHaveTextContent('105')
    expect(screen.getByText('105 bpm · Sunday, 30 August')).not.toBe(heading)
  })

  it('shows the tempo whether or not the groove is playing (R2, AC2)', async () => {
    function PlayingToggle() {
      const [playing, setPlaying] = useState(false)
      return (
        <button type="button" onClick={() => setPlaying(!playing)}>
          {playing ? 'Stop' : 'Play'}
        </button>
      )
    }

    const user = userEvent.setup()
    render(
      <GrooveCard groove={GROOVE_105} meta={metaFor(GROOVE_105)}>
        <PlayingToggle />
      </GrooveCard>,
    )

    expect(screen.getByText('105 bpm · Sunday, 30 August')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(screen.getByText('105 bpm · Sunday, 30 August')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.getByText('105 bpm · Sunday, 30 August')).toBeInTheDocument()
  })

  it('renders no meta line beneath the name (R9, AC5)', () => {
    const { container } = render(
      <GrooveCard groove={GROOVE} meta={metaFor(GROOVE)} />,
    )
    // The canvas' "No. 214 · 4 bars · loops forever" is dropped, not filled.
    expect(screen.queryByText(/No\.|bars|loops/)).not.toBeInTheDocument()
    expect(container.textContent ?? '').not.toMatch(/No\.|bars|loops/)
  })

  // F11 — the answer joins the meta line once the day is over. The payoff panel
  // names it too, but it is below both cards and out of view while you play
  // along; the card that is playing should say what you are playing over.
  //
  // Since F12 E3 the card is handed the finished line, so *where* the answer
  // sits in it is `metaLine`'s subject and is asserted in
  // `lib/presentation/date.test.ts`. What stays the card's subject is that it
  // renders the line whole, and puts none of it in the heading.

  it('renders a line carrying the answer exactly as it was composed', () => {
    render(
      <GrooveCard
        groove={GROOVE_105}
        meta={metaLine(GROOVE_105, DAY, { root: 'C', flavour: 'Mixolydian' })}
      />,
    )

    // One node, the composed string verbatim — the order is metaLine's to set.
    expect(
      screen.getByText('105 bpm · C Mixolydian · Sunday, 30 August'),
    ).toBeInTheDocument()
  })

  it('says nothing about the answer while the day is still on', () => {
    const { container } = render(
      <GrooveCard groove={GROOVE_105} meta={metaFor(GROOVE_105)} />,
    )
    expect(screen.getByText('105 bpm · Sunday, 30 August')).toBeInTheDocument()
    expect(container.textContent ?? '').not.toMatch(/Dorian|Mixolydian/)
  })

  it('keeps the answer out of the heading too', () => {
    render(
      <GrooveCard
        groove={GROOVE}
        meta={metaLine(GROOVE, DAY, { root: 'C', flavour: 'Mixolydian' })}
      />,
    )
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.textContent).toBe('Sunroom Shuffle')
  })

  it('repeats the day beside the tempo, in one muted line', () => {
    render(<GrooveCard groove={GROOVE_105} meta={metaFor(GROOVE_105)} />)

    // One node, not two: the tempo and the day read as a single meta line
    // under the name, the way a lead sheet heads a chart.
    expect(
      screen.getByText('105 bpm · Sunday, 30 August'),
    ).toBeInTheDocument()
  })

  it('writes the day exactly as the page header writes it', () => {
    render(<GrooveCard groove={GROOVE} meta={metaFor(GROOVE)} />)

    // The line the card is handed comes from `metaLine`, which composes
    // `dateLine` — the same function the header writes the day with, so the two
    // cannot drift into different spellings of the same day. Asserting the
    // shared output rather than a literal is what makes that a guarantee
    // rather than a coincidence.
    expect(
      screen.getByText(new RegExp(dateLine(DAY).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))),
    ).toBeInTheDocument()
  })

  it('renders its children below the header region', () => {
    render(
      <GrooveCard groove={GROOVE} meta={metaFor(GROOVE)}>
        <p>transport goes here</p>
      </GrooveCard>,
    )
    expect(screen.getByText('transport goes here')).toBeInTheDocument()
  })

  // --- F12 Epic 3, Step A2: the card renders the line it is given -----------

  it('renders whatever meta line it is handed, verbatim (F12 E3 R1a, R4, AC11)', () => {
    // The shared page's line, as `GroovePuzzleView` composes it. The card is
    // the same card: only the string differs.
    const { rerender } = render(
      <GrooveCard groove={GROOVE_105} meta={metaLine(GROOVE_105, null)} />,
    )
    expect(screen.getByText('105 bpm · shared groove')).toBeInTheDocument()
    expect(screen.queryByText(/August|Sunday/)).not.toBeInTheDocument()

    rerender(<GrooveCard groove={GROOVE_105} meta={metaFor(GROOVE_105)} />)
    expect(screen.getByText('105 bpm · Sunday, 30 August')).toBeInTheDocument()
    expect(screen.queryByText(/shared groove/)).not.toBeInTheDocument()
  })

  it('renders whichever line it was given, shared or not (F12 E3 R1a)', () => {
    render(
      <GrooveCard
        groove={GROOVE_105}
        meta={metaLine(GROOVE_105, null, { root: 'C', flavour: 'Mixolydian' })}
      />,
    )
    expect(
      screen.getByText('105 bpm · C Mixolydian · shared groove'),
    ).toBeInTheDocument()
  })

  it('branches on nothing about which page renders it (F12 E3 R4, AC3)', () => {
    // Read from the source, because the rule is about what the card no longer
    // decides, not about what it draws: the day, the words "shared groove" and
    // the mode the page is in are all things it is now simply handed.
    //
    // Comments are blanked first, on the same reasoning as the retirement guard
    // in `lib/theory/music.test.ts`: the rule is about what the code does, not
    // how it is described, and the card's own doc comment has to be free to
    // explain which page's line it is handed without tripping the assertion.
    // Every shape being looked for — an import, a call, a type annotation —
    // survives the blanking.
    const source = readFileSync(
      join(process.cwd(), 'src/features/daily-groove/components/puzzle/GrooveCard.tsx'),
      'utf8',
    )
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1')

    expect(source).not.toMatch(/dateLine|metaLine/)
    expect(source).not.toMatch(/shared/)
    expect(source).not.toMatch(/PuzzleMode/)
  })
})

/**
 * Relocated from `src/app/page.test.tsx` (Epic 3, Step C2). These assert the
 * card as the page composes it, against the groove the day actually selects,
 * so they keep the composed render they were written against rather than a
 * hand-made prop.
 */
describe('through the composed page', () => {
  it("shows today's groove card", async () => {
    await renderFeature();

    const groove = selectGrooveForDate(new Date(), GROOVES);
    expect(
      screen.getByRole("heading", { name: groove.name }),
    ).toBeInTheDocument();
  })
})
