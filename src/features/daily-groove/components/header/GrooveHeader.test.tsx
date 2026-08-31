import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GrooveHeader } from './GrooveHeader'
import { APP_NAME, TAGLINE } from '@/lib/branding'
import { renderFeature } from '../../testing/renderFeature'

describe('GrooveHeader', () => {
  it('drops the wordmark, and the date with it (F8 E1 R11, AC9)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)
    expect(screen.queryByText('daily-groove')).toBeNull()
    // The day is the groove card's to state now (F8 E1 R13, AC11).
    expect(screen.queryByText('Saturday, 29 August')).toBeNull()
  })

  it('sets the page title to the app name (F8 E1 R1, R2, AC1, AC2)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)
    expect(
      screen.getByRole('heading', { level: 1, name: APP_NAME }),
    ).toBeInTheDocument()
  })

  it('shows no date at all (F8 E1 R11, AC9)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)
    expect(screen.queryByText('Saturday, 29 August')).toBeNull()
    expect(screen.queryByText('Saturday')).toBeNull()
  })

  it('carries the tagline under the name (F8 E1 R3, R4, AC3, AC4)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)

    expect(screen.getByText(TAGLINE)).toBeInTheDocument()
    // A separate node: the heading's accessible name is the app name alone.
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      APP_NAME,
    )
    // And it adds no level to the document outline.
    expect(screen.queryByRole('heading', { name: TAGLINE })).toBeNull()
  })

  it('renders the tagline as muted body copy (F8 E1 R5, AC8)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)

    const tagline = screen.getByText(TAGLINE)
    expect(tagline.tagName).toBe('P')
    expect(tagline.className).toContain('text-text-muted')
  })

  it('takes the streak and nothing else (F8 E1 R12, AC10)', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/daily-groove/components/header/GrooveHeader.tsx',
      ),
      'utf8',
    )

    const block = source.match(/type GrooveHeaderProps = \{([\s\S]*?)\n\}/)
    expect(block).not.toBeNull()

    const props = [
      ...(block as RegExpMatchArray)[1].matchAll(/^\s{2}(\w+)\??:/gm),
    ].map((match) => match[1])
    expect(props).toEqual(['streak', 'onShowHelp'])

    // The header reads no clock and formats no day.
    expect(source).not.toContain('dateLine')
  })

  // --- F8 Epic 3, Step C6: the question mark at the end of the tagline ------

  it('ends the tagline line with a question mark that asks for the box (F8 E3 R8, R9, R10, AC10)', async () => {
    const onShowHelp = vi.fn()
    render(<GrooveHeader streak={12} onShowHelp={onShowHelp} />)

    const help = screen.getByRole('button', { name: 'How to play' })
    expect(help).toBeInTheDocument()

    await userEvent.click(help)
    expect(onShowHelp).toHaveBeenCalledTimes(1)
  })

  it('offers the question mark to every player, whatever their streak (F8 E3 R10)', () => {
    render(<GrooveHeader streak={0} onShowHelp={() => {}} />)
    expect(
      screen.getByRole('button', { name: 'How to play' }),
    ).toBeInTheDocument()
  })

  it('puts the question mark inside the tagline, after its last word (F8 E3 R8)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)

    const tagline = screen.getByText(TAGLINE)
    const help = screen.getByRole('button', { name: 'How to play' })

    // Inside the paragraph, not beside it: this is what makes it follow the
    // final full stop wherever the sentence wraps.
    expect(tagline.tagName).toBe('P')
    expect(tagline).toContainElement(help)
    // And it is the last thing in that paragraph.
    expect(tagline.lastElementChild).toBe(help)
  })

  it('drops the question mark when there is nothing to ask for (F8 E3 R10)', () => {
    // `null` is how the page says the box is already on screen.
    render(<GrooveHeader streak={12} onShowHelp={null} />)

    expect(screen.queryByRole('button', { name: 'How to play' })).toBeNull()
    // The tagline itself is untouched.
    expect(screen.getByText(TAGLINE)).toBeInTheDocument()
  })

  it('keeps the streak at the right even when the header stacks (F8 E2 R10a, AC9a)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)

    // Below `sm` the Row is a column, so its `align="center"` is the horizontal
    // one. The badge anchors itself to the end of its own line instead of
    // being centred, and hands alignment back once the Row is a row again.
    const anchor = screen.getByLabelText(/current streak/i)
      .parentElement as HTMLElement
    expect(anchor.className).toContain('self-end')
    expect(anchor.className).toContain('sm:self-auto')
  })

  it('anchors the title block to the left when the header stacks (F8 E2 R10a)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)

    // The same trap centres the left column; the tagline usually fills the
    // width and hides it, which is exactly why it needs a test.
    const anchor = screen.getByRole('heading', { level: 1 })
      .parentElement?.parentElement as HTMLElement
    expect(anchor.className).toContain('self-start')
    expect(anchor.className).toContain('sm:self-auto')
  })

  it('carries the streak pill (R3)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)
    const badge = screen.getByLabelText(/current streak/i)
    expect(badge).toHaveTextContent('12 days streak')
  })
})

/**
 * Relocated from `src/app/page.test.tsx` (Epic 3, Step C2). The header's own
 * tests pass a streak in; this one asserts the page puts the header beside the
 * puzzle at all, which needs the composed render it was written against.
 */
describe('through the composed page', () => {
  it("shows the streak badge alongside the puzzle (AC6)", async () => {
    await renderFeature();

    // Streak badge is present (empty state on first run).
    expect(screen.getByLabelText(/current streak/i)).toBeInTheDocument();
  })
})

/**
 * Source-read on purpose (F8 E2, Steps C1, C2). Where the badge sits in the
 * header is a test; how a flex row aligns it is a look — a render here would
 * only assert on a generated flex class.
 */
describe('the header row (F8 E2)', () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      'src/features/daily-groove/components/header/GrooveHeader.tsx',
    ),
    'utf8',
  )

  it('aligns its two sides on their centres (F8 E2 R8, R9, AC8)', () => {
    expect(source).toMatch(/<Row[^>]*align="center"/)
    expect(source).not.toMatch(/<Row[^>]*align="start"/)
  })

  it('still stacks below the collapse breakpoint (F8 E2 R10, AC9)', () => {
    // `Row`'s collapse table makes the stacked case the default and the split
    // the override, so the alignment cannot affect it. This pins against the
    // collapse being dropped while the row is rearranged.
    expect(source).toMatch(/<Row[^>]*collapseBelow="sm"/)
  })
})
