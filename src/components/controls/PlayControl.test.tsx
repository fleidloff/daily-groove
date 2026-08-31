import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayControl } from './PlayControl'

describe('PlayControl', () => {
  it('offers to play when not playing', () => {
    render(<PlayControl isPlaying={false} onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: 'Play the loop' })).toBeInTheDocument()
  })

  it('offers to stop when playing', () => {
    render(<PlayControl isPlaying onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: 'Stop the loop' })).toBeInTheDocument()
  })

  it('swaps its accessible name as the state changes', () => {
    const { rerender } = render(<PlayControl isPlaying={false} onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAccessibleName('Play the loop')

    rerender(<PlayControl isPlaying onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAccessibleName('Stop the loop')
  })

  it('calls onToggle when pressed while stopped', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<PlayControl isPlaying={false} onToggle={onToggle} />)

    await user.click(screen.getByRole('button'))

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('calls onToggle when pressed while playing', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<PlayControl isPlaying onToggle={onToggle} />)

    await user.click(screen.getByRole('button'))

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  // D1 — R9, AC8a. The one form the control has left: the caller picks no size.
  // Widened by feature-8 Epic 2, Step B2 — R6, AC5: the size the control picks
  // for itself is the large one, in every state, so each state test pins it.
  it('renders the large full-width button form with no size given (D1, B2, R9, R6, AC8a, AC5)', () => {
    render(<PlayControl isPlaying={false} onToggle={() => {}} />)

    const button = screen.getByRole('button', { name: 'Play the loop' })
    expect(button).toHaveTextContent('▶ Play')
    expect(button.className).toContain('w-full')
    expect(button.className).toContain('py-[22px]')
    expect(button).toBeEnabled()
  })

  it('renders full-width with the glyph and its text (A1, R1, R4a, AC1, AC3a)', () => {
    render(<PlayControl isPlaying={false} onToggle={() => {}} />)

    const button = screen.getByRole('button')
    expect(button).toHaveTextContent('▶ Play')
    expect(button.className).toContain('w-full')
  })

  it('renders caller-supplied words in BOTH states (R4a, AC3a)', () => {
    // The design system carries no domain vocabulary (globals I5), so the
    // words arrive as a prop. Both halves must be honoured: a control that
    // used `text.play` and ignored `text.stop` passed the whole suite before
    // this assertion existed.
    // Both words differ from the component's own defaults ('Play' / 'Stop').
    // A fixture reusing a default cannot distinguish "the prop was honoured"
    // from "the prop was ignored" — it passes either way.
    const text = { play: 'Start it', stop: 'Halt it', loading: 'Fetching…' }

    const { rerender } = render(
      <PlayControl isPlaying={false} onToggle={() => {}} text={text} />,
    )
    expect(screen.getByRole('button')).toHaveTextContent('▶ Start it')

    rerender(<PlayControl isPlaying onToggle={() => {}} text={text} />)
    expect(screen.getByRole('button')).toHaveTextContent('■ Halt it')
  })

  // feature-8 Epic 2, Step B1 — R4, R7, AC4. Feature-4 sized this control to
  // match the solve button exactly; this epic undoes that. The form is still
  // the one button's — full width, same radius, same horizontal padding — and
  // the play control takes its larger size because it is the first move.
  it('takes the large form of the one button, not the solve button\'s size (B1, R4, R7, AC4)', () => {
    render(<PlayControl isPlaying={false} onToggle={() => {}} />)

    const className = screen.getByRole('button').className
    for (const geometry of ['w-full', 'rounded-control', 'px-4', 'py-[22px]', 'text-[17px]']) {
      expect(className).toContain(geometry)
    }
  })

  it('swaps to the stop glyph and text while sounding, at the same size (A2, B2, R4b, R6, AC3a, AC5)', () => {
    render(<PlayControl isPlaying onToggle={() => {}} />)

    const button = screen.getByRole('button')
    expect(button).toHaveTextContent('■ Stop')
    expect(button).toHaveAccessibleName('Stop the loop')
    expect(button.className).toContain('py-[22px]')
  })

  it('differs between the two states in glyph and text only (A2, R4b, AC3b)', () => {
    const classOf = (isPlaying: boolean) =>
      (
        render(<PlayControl isPlaying={isPlaying} onToggle={() => {}} />)
          .container.firstElementChild as HTMLElement
      ).className

    const stopped = classOf(false)
    const playing = classOf(true)

    expect(playing).toBe(stopped)
  })

  it('states the action, not the state, in its accessible name (A3, R5, AC4)', () => {
    const { rerender } = render(<PlayControl isPlaying={false} onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAccessibleName('Play the loop')

    rerender(<PlayControl isPlaying onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAccessibleName('Stop the loop')
  })

  it('keeps its own name whatever words the caller supplies (D1, R9, AC8a)', () => {
    // With `label` gone the accessible name is the control's alone: the text
    // prop names the thing being played, it does not rename the action.
    render(
      <PlayControl
        isPlaying={false}
        onToggle={() => {}}
        text={{ play: 'Play the whole thing', stop: 'Stop', loading: 'Fetching…' }}
      />,
    )

    expect(screen.getByRole('button')).toHaveAccessibleName('Play the loop')
  })

  // Step C1 — R7a, AC8b. Web Audio cannot play progressively: the first press
  // has to fetch and decode before any sound exists. The control says so
  // rather than flipping to "Stop" over silence.
  it('renders inert at the same size with the loading word while busy (C1, B2, R7a, R6, AC8b, AC5, AC6)', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(
      <PlayControl
        isPlaying={false}
        busy
        onToggle={onToggle}
        text={{ play: 'Start it', stop: 'Halt it', loading: 'Fetching…' }}
      />,
    )

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('◌ Fetching…')
    expect(button).not.toHaveTextContent('Start it')
    expect(button).toHaveAccessibleName('Fetching…')
    expect(button.className).toContain('py-[22px]')

    await user.click(button)

    expect(onToggle).not.toHaveBeenCalled()
  })

  it('says it is loading in its accessible name while busy (C1, R7a, AC8b)', () => {
    // "Inert and labelled as loading" (AC8b) is about what a screen reader
    // hears too: an aria-label still naming the press would leave the state
    // visible only to sighted users.
    render(
      <PlayControl
        isPlaying={false}
        busy
        onToggle={() => {}}
        text={{ play: 'Start it', stop: 'Halt it', loading: 'Fetching…' }}
      />,
    )

    expect(screen.getByRole('button')).toHaveAccessibleName('Fetching…')
  })

  it('is busy over either state, and busy without words falls back (C1, R7a, AC8b)', () => {
    // The design system names the act, never the thing: the default word is
    // as generic as 'Play' and 'Stop' beside it.
    const { rerender } = render(<PlayControl isPlaying busy onToggle={() => {}} />)

    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByRole('button')).toHaveTextContent('Loading…')
    expect(screen.getByRole('button')).not.toHaveTextContent('Stop')

    rerender(<PlayControl isPlaying={false} busy onToggle={() => {}} />)

    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByRole('button')).toHaveTextContent('Loading…')
  })

  // Step C2 — R7a, AC8c, AC8d. `busy` is a prop, never state: it cannot latch.
  it('leaves the busy state when the prop clears while playing (C2, R7a, AC8c)', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const text = { play: 'Start it', stop: 'Halt it', loading: 'Fetching…' }
    const { rerender } = render(
      <PlayControl isPlaying={false} busy onToggle={onToggle} text={text} />,
    )

    rerender(<PlayControl isPlaying busy={false} onToggle={onToggle} text={text} />)

    const button = screen.getByRole('button')
    expect(button).toBeEnabled()
    expect(button).toHaveTextContent('■ Halt it')
    expect(button).toHaveAccessibleName('Stop the loop')

    await user.click(button)

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('leaves the busy state when a failed press clears the prop (C2, R7a, AC8d)', () => {
    // A press that rejects never starts audio, so `isPlaying` stays false and
    // the control must return to offering the press, not sit inert forever.
    const text = { play: 'Start it', stop: 'Halt it', loading: 'Fetching…' }
    const { rerender } = render(
      <PlayControl isPlaying={false} busy onToggle={() => {}} text={text} />,
    )

    rerender(<PlayControl isPlaying={false} busy={false} onToggle={() => {}} text={text} />)

    const button = screen.getByRole('button')
    expect(button).toBeEnabled()
    expect(button).toHaveTextContent('▶ Start it')
    expect(button).toHaveAccessibleName('Play the loop')
  })

  it('is the default when busy is omitted (C1, R7a)', () => {
    render(<PlayControl isPlaying={false} onToggle={() => {}} />)

    expect(screen.getByRole('button')).toBeEnabled()
    expect(screen.getByRole('button')).toHaveTextContent('▶ Play')
  })

})
