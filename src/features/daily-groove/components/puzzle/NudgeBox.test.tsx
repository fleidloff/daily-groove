import { describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { NudgeBox } from './NudgeBox'
import { ROOTS } from '../../lib/theory/music'
import type { Feedback } from '../../lib/presentation/feedback'

const NOTE_CHARS = 'A-Za-z♭♯'

function rootPattern(root: string) {
  const escaped = root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?<![${NOTE_CHARS}])${escaped}(?![${NOTE_CHARS}])`)
}

const ROOT_MATCHED: Feedback = {
  message: 'Right home note, wrong colour.',
  tone: 'warm',
}

const SOLVED: Feedback = {
  message: 'That is it. The groove is yours now.',
  tone: 'solved',
}

const MOVE: Feedback = {
  message: 'Hum the bass note on beat one.',
  tone: 'neutral',
}

function box() {
  return screen.getByRole('complementary', { name: 'Hint' })
}

function line() {
  return screen.getByText(/ruled out/)
}

describe('NudgeBox', () => {
  it('carries the "Hint" eyebrow, and never the old "A nudge" wording (R6, AC9)', () => {
    render(<NudgeBox feedback={ROOT_MATCHED} coaching={MOVE} eliminated={2} />)
    expect(screen.getByText('Hint')).toBeInTheDocument()
    expect(screen.queryByText(/a nudge/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('complementary', { name: 'A nudge' }),
    ).not.toBeInTheDocument()
  })

  it('holds the feedback message it is given (R8)', () => {
    render(<NudgeBox feedback={ROOT_MATCHED} coaching={MOVE} eliminated={2} />)
    expect(box()).toContainElement(screen.getByText(ROOT_MATCHED.message))
  })

  it('puts the feedback message above the nudge sentence (R8)', () => {
    render(<NudgeBox feedback={ROOT_MATCHED} coaching={MOVE} eliminated={2} />)
    const message = screen.getByText(ROOT_MATCHED.message)
    expect(
      message.compareDocumentPosition(line()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('names how many roots the app ruled out, and says the row is narrowing (R17, AC17)', () => {
    render(<NudgeBox feedback={ROOT_MATCHED} coaching={MOVE} eliminated={2} />)
    expect(line()).toHaveTextContent('2 roots ruled out. Narrowing as you go.')
  })

  it('names the count it is given (R17, AC17)', () => {
    render(<NudgeBox feedback={ROOT_MATCHED} coaching={MOVE} eliminated={4} />)
    expect(line()).toHaveTextContent('4 roots ruled out. Narrowing as you go.')
  })

  it('names no root anywhere in the box — neither the answer nor the ones removed (R18, AC17)', () => {
    render(<NudgeBox feedback={ROOT_MATCHED} coaching={MOVE} eliminated={4} />)
    const text = box().textContent ?? ''
    for (const root of ROOTS) {
      expect(text, `the box names the root ${root}`).not.toMatch(
        rootPattern(root),
      )
    }
  })

  it.each([2, 4, 6, 8])(
    'states no live count — %i is the only number in the line (R17a, AC17a)',
    (eliminated) => {
      render(
        <NudgeBox
          feedback={ROOT_MATCHED}
          coaching={MOVE}
          eliminated={eliminated}
        />,
      )
      expect(line().textContent?.match(/\d+/g)).toEqual([String(eliminated)])
    },
  )

  it('reads the same at the floor, however long the player goes on missing (R17b, AC17b)', () => {
    render(<NudgeBox feedback={ROOT_MATCHED} coaching={MOVE} eliminated={4} />)
    const fourth = line().textContent
    cleanup()
    render(<NudgeBox feedback={ROOT_MATCHED} coaching={MOVE} eliminated={4} />)
    expect(line().textContent).toBe(fourth)
  })

  it('shows the feedback alone when the app has eliminated nothing (R19, AC18)', () => {
    render(
      <NudgeBox feedback={ROOT_MATCHED} coaching={null} eliminated={null} />,
    )
    expect(box()).toContainElement(screen.getByText(ROOT_MATCHED.message))
    expect(screen.queryByText(/ruled out/)).not.toBeInTheDocument()
  })

  it('treats a count of zero as nothing to report (R19, AC18)', () => {
    render(<NudgeBox feedback={SOLVED} coaching={null} eliminated={0} />)
    expect(box()).toContainElement(screen.getByText(SOLVED.message))
    expect(screen.queryByText(/ruled out/)).not.toBeInTheDocument()
  })

  it('shows the nudge sentence alone when there is no feedback (R17, AC17)', () => {
    render(<NudgeBox feedback={null} coaching={null} eliminated={2} />)
    expect(box()).toContainElement(line())
    expect(screen.getByRole('status')).toHaveTextContent(/2 roots ruled out/)
    expect(screen.queryByText(/wrong colour/)).toBeNull()
  })

  it('renders nothing at all when it has no content to carry (R19, AC18)', () => {
    const { container } = render(
      <NudgeBox feedback={null} coaching={null} eliminated={null} />,
    )
    expect(container).toBeEmptyDOMElement()
    expect(
      screen.queryByRole('complementary', { name: 'Hint' }),
    ).not.toBeInTheDocument()
  })

  it('renders nothing when the feedback message is blank (R19, AC18)', () => {
    const blank = render(
      <NudgeBox
        feedback={{ message: '  ', tone: 'neutral' }}
        coaching={null}
        eliminated={0}
      />,
    )
    expect(blank.container).toBeEmptyDOMElement()
    cleanup()

    const blankMove = render(
      <NudgeBox
        feedback={null}
        coaching={{ message: '  ', tone: 'neutral' }}
        eliminated={null}
      />,
    )
    expect(blankMove.container).toBeEmptyDOMElement()
  })

  it('is a named landmark, but not a live region of its own (R5, R10, AC14)', () => {
    render(<NudgeBox feedback={ROOT_MATCHED} coaching={MOVE} eliminated={2} />)
    expect(box()).not.toHaveAttribute('aria-live')
    expect(box().querySelectorAll('[aria-live]')).toHaveLength(1)
  })

  it('wraps the verdict, the coaching and the count in one polite region (R17, AC20)', () => {
    render(<NudgeBox feedback={ROOT_MATCHED} coaching={MOVE} eliminated={2} />)
    const regions = screen.getAllByRole('status')
    expect(regions).toHaveLength(1)
    expect(regions[0]).toHaveAttribute('aria-live', 'polite')
    expect(regions[0]).toHaveTextContent(ROOT_MATCHED.message)
    expect(regions[0]).toHaveTextContent(MOVE.message)
    expect(regions[0]).toHaveTextContent(/2 roots ruled out/)
    expect(box()).not.toHaveAttribute('aria-live')
    expect(box().querySelectorAll('[aria-live]')).toHaveLength(1)
  })

  it('puts the coaching under the verdict, muted rather than warm (R12, R13, AC11)', () => {
    render(<NudgeBox feedback={ROOT_MATCHED} coaching={MOVE} eliminated={2} />)
    const verdict = screen.getByText(ROOT_MATCHED.message)
    const coaching = screen.getByText(MOVE.message)
    expect(
      verdict.compareDocumentPosition(coaching) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(coaching.dataset.tone).toBe('neutral')
    expect(verdict.dataset.tone).toBe('warm')
    expect(coaching.className).not.toBe(verdict.className)

    const muted = box().querySelectorAll('[data-tone="neutral"]')
    expect(muted).toHaveLength(1)
    expect(muted[0]).toBe(coaching)
  })

  it('is the coaching alone when there is no verdict (R1, R12a, AC16)', () => {
    render(<NudgeBox feedback={null} coaching={MOVE} eliminated={null} />)
    expect(box()).toContainElement(screen.getByText(MOVE.message))
    expect(box().querySelectorAll('[data-tone="warm"]')).toHaveLength(0)
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('puts the coaching above the count when there is no verdict (R1, R12a, AC16)', () => {
    render(<NudgeBox feedback={null} coaching={MOVE} eliminated={2} />)
    const coaching = screen.getByText(MOVE.message)
    expect(
      coaching.compareDocumentPosition(line()) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(box().querySelectorAll('[data-tone="warm"]')).toHaveLength(0)
    expect(screen.getAllByRole('status')).toHaveLength(1)
  })

  it('keeps the feedback tone on the feedback line (R8)', () => {
    render(<NudgeBox feedback={ROOT_MATCHED} coaching={MOVE} eliminated={2} />)
    expect(screen.getByText(ROOT_MATCHED.message).dataset.tone).toBe('warm')
  })

  it('is informational only — it offers no control to press (R6, AC10)', () => {
    render(<NudgeBox feedback={ROOT_MATCHED} coaching={MOVE} eliminated={2} />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
