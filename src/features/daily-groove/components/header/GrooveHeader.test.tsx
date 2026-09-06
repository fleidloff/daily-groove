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

  it('takes the streak and the help handler, and nothing else (F8 E1 R12, AC10; quick 9)', () => {
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

describe('what the header does not know (quick 9)', () => {
  const source = readFileSync(
    resolve(
      process.cwd(),
      'src/features/daily-groove/components/header/GrooveHeader.tsx',
    ),
    'utf8',
  )

  it('learns nothing about sharing (F12 E2 R1a)', () => {
    expect(source).not.toMatch(/from ['"][^'"]*share/)
    expect(source).not.toContain('shareUrlOf')
    expect(source).not.toContain('ShareGroove')
  })

  it('learns nothing about pitch (F23 E1 R1)', () => {
    expect(source).not.toMatch(/transpose['"]/)
    expect(source).not.toContain('TransposeSelect')
    expect(source).not.toContain('useInstrumentKey')
  })

  it('holds no controls row of its own', () => {
    render(<GrooveHeader streak={12} onShowHelp={() => {}} />)

    const header = streakBadge(12).closest('header') as HTMLElement
    expect(header.querySelector('.justify-end')).toBeNull()
  })
})
