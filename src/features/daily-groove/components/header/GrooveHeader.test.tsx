import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GrooveHeader } from './GrooveHeader'
import { branding, header } from '@/lib/snippets'
import { renderFeature } from '../../testing/renderFeature'

const { appName: APP_NAME, tagline: TAGLINE } = branding

const streakBadge = (days: number) =>
  screen.getByLabelText(header.streakName({ days }))
const controlsRow = (days: number) =>
  streakBadge(days).closest('header')?.querySelector('.justify-end') as HTMLElement

describe('GrooveHeader', () => {
  it('drops the wordmark, and the date with it (F8 E1 R11, AC9)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)
    expect(screen.queryByText('daily-groove')).toBeNull()
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
    expect(screen.getByRole('heading', { level: 1 })).toHaveAccessibleName(
      APP_NAME,
    )
    expect(screen.queryByRole('heading', { name: TAGLINE })).toBeNull()
  })

  it('renders the tagline as muted body copy (F8 E1 R5, AC8)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)

    const tagline = screen.getByText(TAGLINE)
    expect(tagline.tagName).toBe('P')
    expect(tagline.className).toContain('text-text-muted')
  })

  it('takes the streak, the help handler and two slots (F8 E1 R12, AC10; F12 E2 R1a; F23 E1 R1)', () => {
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
    expect(props).toEqual(['streak', 'onShowHelp', 'share', 'transpose'])

    expect(source).not.toContain('dateLine')
  })

  it('ends the tagline line with a question mark that asks for the box (F8 E3 R8, R9, R10, AC10)', async () => {
    const onShowHelp = vi.fn()
    render(<GrooveHeader streak={12} onShowHelp={onShowHelp} />)

    const help = screen.getByRole('button', { name: header.helpToggleName })
    expect(help).toBeInTheDocument()

    await userEvent.click(help)
    expect(onShowHelp).toHaveBeenCalledTimes(1)
  })

  it('offers the question mark to every player, whatever their streak (F8 E3 R10)', () => {
    render(<GrooveHeader streak={0} onShowHelp={() => {}} />)
    expect(
      screen.getByRole('button', { name: header.helpToggleName }),
    ).toBeInTheDocument()
  })

  it('puts the question mark inside the tagline, after its last word (F8 E3 R8)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)

    const tagline = screen.getByText(TAGLINE)
    const help = screen.getByRole('button', { name: header.helpToggleName })

    expect(tagline.tagName).toBe('P')
    expect(tagline).toContainElement(help)
    expect(tagline.lastElementChild).toBe(help)
  })

  it('drops the question mark when there is nothing to ask for (F8 E3 R10)', () => {
    render(<GrooveHeader streak={12} onShowHelp={null} />)

    expect(screen.queryByRole('button', { name: header.helpToggleName })).toBeNull()
    expect(screen.getByText(TAGLINE)).toBeInTheDocument()
  })

  it('puts the streak at the end of the title line (quick 4)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)

    const badge = streakBadge(12)
    const title = screen.getByRole('heading', { level: 1 })
    const row = badge.parentElement as HTMLElement

    expect(row).toContainElement(title)
    expect(row).not.toContainElement(screen.getByText(TAGLINE))
    expect(row.className).toContain('justify-between')
    expect(
      title.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('carries the streak as a fire and a count (quick 4)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)
    expect(streakBadge(12).textContent).toBe('🔥12')
  })
})

describe('through the composed page', () => {
  it("shows the streak badge alongside the puzzle (AC6)", async () => {
    await renderFeature();

    expect(screen.getByLabelText(header.streakName({ days: 0 }))).toBeInTheDocument();
  })
})

describe('the header row (F8 E2)', () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      'src/features/daily-groove/components/header/GrooveHeader.tsx',
    ),
    'utf8',
  )

  it('never collapses, so the streak keeps its corner at every width (quick 4)', () => {
    expect(source).not.toContain('collapseBelow')
  })
})

describe('the share slot (F12 E2)', () => {
  const slot = () => (
    <button type="button" onClick={() => {}}>
      Share
    </button>
  )

  it('renders the slot inside the header, below the tagline (R1, R1a, AC1, AC11; quick 4)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} share={slot()} />)

    const share = screen.getByRole('button', { name: 'Share' })
    const row = controlsRow(12)

    expect(share.closest('header')).not.toBeNull()
    expect(row).toContainElement(share)
    expect(row).not.toContainElement(streakBadge(12))
    expect(
      screen
        .getByText(TAGLINE)
        .compareDocumentPosition(share) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('keeps the slot at the end of its own line (R1b, AC11; quick 4)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} share={slot()} />)

    const row = controlsRow(12)
    expect(row.className).toContain('justify-end')
    expect(row).toContainElement(screen.getByRole('button', { name: 'Share' }))
  })

  it('renders unchanged when no slot is given (R1)', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)

    expect(screen.queryByRole('button', { name: 'Share' })).toBeNull()
    expect(
      screen.getByRole('heading', { level: 1, name: APP_NAME }),
    ).toBeInTheDocument()
    expect(screen.getByText(TAGLINE)).toBeInTheDocument()
    expect(streakBadge(12).textContent).toBe('🔥12')
    expect(controlsRow(12)).toBeNull()
  })

  it('learns nothing about sharing to render it (R1a)', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/daily-groove/components/header/GrooveHeader.tsx',
      ),
      'utf8',
    )

    expect(source).not.toMatch(/from ['"][^'"]*share/)
    expect(source).not.toContain('shareUrlOf')
    expect(source).not.toContain('ShareGroove')
  })
})

describe('the transpose slot (F23 E1)', () => {
  const share = () => (
    <button type="button" onClick={() => {}}>
      Share
    </button>
  )
  const transpose = () => (
    <button type="button" onClick={() => {}}>
      Transpose
    </button>
  )

  it('renders the slot inside the header, ahead of share (R1, AC1; quick 4)', () => {
    render(
      <GrooveHeader
        streak={12}
        onShowHelp={() => {}}
        share={share()}
        transpose={transpose()}
      />,
    )

    const shareButton = screen.getByRole('button', { name: 'Share' })
    const pill = screen.getByRole('button', { name: 'Transpose' })
    const row = controlsRow(12)

    expect(row).toContainElement(shareButton)
    expect(row).toContainElement(pill)
    expect(
      pill.compareDocumentPosition(shareButton) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('renders the slot on the controls line when share is absent (R1)', () => {
    render(
      <GrooveHeader streak={12} onShowHelp={() => {}} transpose={transpose()} />,
    )

    expect(controlsRow(12)).toContainElement(
      screen.getByRole('button', { name: 'Transpose' }),
    )
  })

  it('learns nothing about pitch to render it (R1)', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/daily-groove/components/header/GrooveHeader.tsx',
      ),
      'utf8',
    )

    expect(source).not.toMatch(/transpose['"]/)
    expect(source).not.toContain('TransposeSelect')
    expect(source).not.toContain('useInstrumentKey')
  })
})
