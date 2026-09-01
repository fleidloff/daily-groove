/**
 * One of five files holding the composed puzzle's tests. **The grouping rule,
 * and where a new case goes, is documented at the top of
 * `GroovePuzzle.page.test.tsx`** — read it before adding one here.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DailyResult, Groove, Root } from '../types'
// The shared setup — fixtures, the fake audio context, the render and the
// accessible-name queries — has one home (F14 E2 R5). Everything below the
// `vi.mock` block is imported from it rather than restated here.
import {
  advance,
  CAPTION,
  CHANGES_READ,
  chipAdornment,
  chipLabel,
  GROOVE,
  GROOVE_LOOP_SECONDS,
  guess,
  installPuzzleAudio,
  loopFraction,
  miss,
  NOTE_GLYPH,
  otherWrongFlavour,
  play,
  renderPuzzle,
  resetMockStore,
  rootGroup,
  settle,
  SOLVING,
  teardownPuzzleAudio,
  TODAY,
  wrongFlavour,
} from '../testing/puzzleHarness'

// The audio module is NOT mocked, and neither is scoring: the flows below run
// through the real Web Audio player, the real store and the real
// `scoreAttempt`. Playback is driven by stubbing the browser instead — see
// `installPuzzleAudio` in the harness.

// Mock the persistence seam so useProgress reads/writes a controllable store —
// no real localStorage. useProgress defaults to this module-singleton store.
// `vi.hoisted` and `vi.mock` are lifted to the top of the file that calls them,
// so neither survives being wrapped in a helper: only the store factory is
// shared, and this block stays here.
const { mockStore } = await vi.hoisted(async () => {
  const { createMockStore } = await import('../testing/puzzleHarness')
  return { mockStore: createMockStore() }
})
// Only the module singleton is stood in for: `createReadOnlyStore` stays the
// real decorator, because the shared session below is the real one.
vi.mock('../lib/persistence/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/persistence/storage')>()),
  createLocalStore: () => mockStore,
}))

import { GroovePuzzle } from './GroovePuzzle'
import { answerOf, simpleRootOptions } from '../lib/theory/music'
import { createLocalPreferenceStore } from '../lib/persistence/preferences'
import { dateLine } from '../lib/presentation/date'
import { barChords } from '../lib/theory/changes'
import { NOTES } from '../data/notes.generated'
import { renderFeature } from '../testing/renderFeature'
import type { FakeContext } from '../testing/fakeAudioContext'

/** The fake audio context this test's cases read the clock and sources from. */
let fake: FakeContext

describe('GroovePuzzle', () => {
  beforeEach(() => {
    resetMockStore(mockStore)
    ;({ fake } = installPuzzleAudio())
  })

  afterEach(() => {
    teardownPuzzleAudio()
  })

  /**
   * The answer panel, found through the heading it leads with. The page carries
   * more than one live region — the transport announces itself too — so the
   * panel is located by its own content rather than by role alone.
   */
  const solutionPanel = () =>
    screen
      .getByRole('heading', { name: 'C Aeolian' })
      .closest('[role="status"]') as HTMLElement

  /** A day whose mode is minor, and a day whose mode is major. */
  const DORIAN: Groove = { ...GROOVE, flavour: 'Dorian', scale: 'C Dorian' }

  /**
   * Turn the preference on before the page reads it, through the same
   * `PreferenceStore` the hook behind the toggle uses. No hook and no component
   * is mocked: the page loads the preference the way it will in a browser.
   */
  async function enableSimpleMode() {
    await createLocalPreferenceStore().set({ simpleMode: true })
  }

  /** The six roots the day offers in simple mode, resolved as the page does. */
  const simpleRoots = () => simpleRootOptions(new Date(), answerOf(DORIAN))

  const chipTexts = (group: HTMLElement) =>
    within(group).getAllByRole('button').map(chipLabel)

  it('shows an error with retry when playback rejects, the card stays (R7)', async () => {
    // A decode that rejects. Fetch failure and a browser with no AudioContext
    // land in the same place — there is one playback path and one error (R7).
    fake.failNextDecode()
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('button', { name: /^play the loop$/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    // The rest of the UI stays usable: the guessing card still renders.
    expect(rootGroup()).toBeInTheDocument()
    // ...and so do the card's name and its transport panel (D6, AC9).
    expect(
      screen.getByRole('heading', { name: GROOVE.name }),
    ).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it("clears the error and replays today's groove on retry (E6 R4, AC6)", async () => {
    fake.failNextDecode()
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('button', { name: /play the loop/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /retry/i }))

    expect(
      await screen.findByRole('button', { name: 'Stop the loop' }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
    // Retry is the same press as the control: it asks the transport to play,
    // and the only groove it could mean is today's (E6 R4, AC6). A failed
    // press costs no player — the retry reuses the one context.
    expect(fake.contexts).toHaveLength(1)
    expect(fake.sources).toHaveLength(1)
    // Filtered to the groove's own file: since F10 E1 the page also warms the
    // twelve reference notes once the groove has decoded, and those are a
    // different subject. What is asserted is unchanged — the failed press and
    // the retry each asked for today's groove, and for nothing else.
    expect(
      vi
        .mocked(fetch)
        .mock.calls.map((call) => String(call[0]))
        .filter((url) => !url.startsWith('/notes/')),
    ).toEqual([GROOVE.audioSrc, GROOVE.audioSrc])
  })

  it('plays, stops and restarts on successive presses (E2 R6, AC5)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    // 1 — starts one looping source and now offers to stop.
    await play(user)
    expect(fake.sources).toHaveLength(1)
    expect(fake.sources[0].start).toHaveBeenCalledTimes(1)
    expect(fake.sources[0].loop).toBe(true)

    // 2 — partway through the loop...
    await advance(loopFraction(0.5))
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50',
    )

    // ...a press halts playback and rewinds it (AC5). Nothing is held.
    await user.click(screen.getByRole('button', { name: 'Stop the loop' }))
    expect(fake.sources[0].stop).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    expect(
      await screen.findByRole('button', { name: 'Play the loop' }),
    ).toBeInTheDocument()

    // 3 — the next press starts from the beginning, not from bar three (AC9).
    // A buffer source is single-use, so it is a second node over the *same*
    // decoded buffer: one context, one fetch, one decode.
    await play(user)
    expect(fake.sources).toHaveLength(2)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    expect(fake.contexts).toHaveLength(1)
    // The *groove's* file, once. Counted per URL rather than off the fake's
    // running total: since F10 E1 the page also warms the twelve reference
    // notes once the groove has decoded, and those are a different subject.
    // What this asserts is unchanged — replaying re-uses the decoded buffer.
    const grooveFetches = vi
      .mocked(fetch)
      .mock.calls.filter((call) => String(call[0]) === GROOVE.audioSrc)
    expect(grooveFetches).toHaveLength(1)
    // One decode per file fetched, and never a second one of the same file.
    expect(fake.decodeCalls).toBe(fake.fetchCalls)
  })

  // Step C5 — R5, AC6: the fill, not only the highlight. `isPlaying` used to
  // gate the highlighted segment alone while the fill swept regardless, which
  // is how a groove nobody was listening to drew the picture.
  it('returns the progress track to the start on stop (E2 R6a, AC5a, AC6)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    // Before any press the fill is empty, not merely unhighlighted.
    expect(screen.getByTestId('progress-fill')).toHaveAttribute('width', '0%')

    await play(user)
    await advance(loopFraction(0.5))

    // The track reads the sounding position...
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50',
    )
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '2',
    )

    await user.click(screen.getByRole('button', { name: 'Stop the loop' }))

    // ...and returns to the start: no segment highlighted, and the fill itself
    // back to zero rather than holding its last value (AC6).
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    expect(screen.queryByTestId('progress-active')).not.toBeInTheDocument()
    expect(screen.getByTestId('progress-fill')).toHaveAttribute('width', '0%')

    // The clock running on does not revive it either.
    await advance(loopFraction(0.25))
    expect(screen.getByTestId('progress-fill')).toHaveAttribute('width', '0%')
  })

  it('reads "■ Stop" while the groove sounds (E2 R4a, AC3a)', async () => {
    // The words are supplied by this feature, not by the design system, so the
    // sounding half of that pair is only asserted here. Without this, a
    // regression that dropped `text.stop` would leave the whole suite green.
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('button', { name: 'Play the loop' }))

    const control = await screen.findByRole('button', { name: 'Stop the loop' })
    expect(control).toHaveTextContent('■ Stop')
  })

  it('stacks the caption below the control rather than beside it (E2 R4, AC3)', async () => {
    await renderPuzzle()

    const play = screen.getByRole('button', { name: 'Play the loop' })
    // Full-width, with glyph and words (E2 R1, R4a, AC3a).
    expect(play).toHaveTextContent('▶ Play the groove')
    expect(play).toHaveClass('w-full')

    // The caption follows the control in document order, in a column — not as a
    // sibling within a row.
    const region = play.parentElement as HTMLElement
    expect(region).toHaveClass('flex-col')
    expect(region).not.toHaveClass('flex-row')
    // F10 E2 Step I1 — the only place the old wording was asserted. R1a
    // replaced the string and nothing else: the caption is still the control's
    // next sibling, in a column, which is the half of feature-4 E2 R4 that
    // still stands.
    expect(play.nextElementSibling).toHaveTextContent(CAPTION)
  })

  it("moves the bar highlight with the player's position (D5, AC8, AC2, AC3)", async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await play(user)
    // The sounding bar is the highlighted segment on the track; the bar labels
    // that used to carry it were removed with the rest of the card's chrome.
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '0',
    )

    // Three eighths of the way through the loop is bar 2 (AC3).
    await advance(loopFraction(0.375))
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '1',
    )

    await advance(loopFraction(0.6 - 0.375))
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '2',
    )

    // A whole loop later it is back in the same bar, not pinned at the end:
    // the position wraps rather than clamping at 1 (AC2).
    await advance(loopFraction(1))
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '2',
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '60',
    )
  })

  // Feature-7 Epic 2 put the tempo back on the card: it is the one piece of the
  // retired meta line backed by data worth showing, and a player reading "90
  // bpm" knows what they are about to hear. The day was later repeated beside
  // it, so the caption is one line carrying both. The rest of that line stays
  // gone — `GrooveCard.test.tsx` still holds "renders no meta line beneath the
  // name".
  it('renders the groove card header, the tempo, the day and the transport (E1 R5, AC5)', async () => {
    await renderPuzzle()
    expect(
      screen.getByRole('heading', { name: GROOVE.name }),
    ).toBeInTheDocument()
    // Lower-case `bpm`, as a caption beneath the name — not the old `BPM` cell.
    // Matched by pattern because the day follows it and the page uses the real
    // today; `GrooveCard.test.tsx` pins the exact wording against a fixed date.
    expect(
      screen.getByText(new RegExp(`^${GROOVE.bpm} bpm · `)),
    ).toBeInTheDocument()
    // The day appears exactly once, beside the tempo: the header stopped
    // carrying its own copy, so the card is the page's only statement of the
    // day (F8 E1 R13, AC11).
    expect(screen.getAllByText(new RegExp(dateLine(new Date())))).toHaveLength(1)
    expect(screen.queryByText('BPM')).not.toBeInTheDocument()
    // The tempo sits outside the heading, so the name is still the whole of the
    // heading's accessible name.
    expect(
      screen.getByRole('heading', { name: GROOVE.name }),
    ).not.toHaveTextContent('bpm')
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  const nameOf = (el: HTMLElement) => el.getAttribute('aria-label')

  /**
   * Every control on the page currently offering to stop. The single-sounding
   * invariant is asserted against this, not against one button at a time.
   */
  const soundingControls = () =>
    screen
      .getAllByRole('button')
      .filter((b) => /^Stop\b/.test(b.getAttribute('aria-label') ?? ''))

  const todayControl = () =>
    screen.getByRole('button', { name: /^(Play|Stop) the loop$/ })

  it("plays today's groove through the page transport (E5 R3, R4, AC3)", async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(todayControl())
    await screen.findByRole('button', { name: 'Stop the loop' })

    // The file the page fetched is today's groove, and one source sounds it,
    // looping between that groove's own boundaries (R12).
    expect(fetch).toHaveBeenCalledWith(GROOVE.audioSrc)
    expect(fake.sources).toHaveLength(1)
    expect(fake.sources[0].loop).toBe(true)
    expect(nameOf(todayControl())).toBe('Stop the loop')

    // ...and pressing it again stops that same source rather than a second one.
    await user.click(todayControl())
    expect(fake.sources[0].stop).toHaveBeenCalledTimes(1)
    expect(fake.contexts).toHaveLength(1)
    expect(soundingControls()).toEqual([])
  })

  // Step C4 — R7a, AC8b, AC8c. Web Audio has no progressive playback, so a
  // press means fetch, then decode, then sound. The control has to say so
  // rather than sitting in "Stop" over silence.
  it('shows an inert loading control until the first sound (E2 R7a, AC8b, AC8c)', async () => {
    fake.deferNextDecode()
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('button', { name: 'Play the loop' }))

    const busy = await screen.findByRole('button', { name: 'Loading…' })
    expect(busy).toBeDisabled()
    expect(busy).toHaveTextContent('Loading…')
    // Nothing sounds yet, and a further press starts nothing (R10, AC10).
    expect(fake.sources).toHaveLength(0)
    await user.click(busy)
    expect(fake.sources).toHaveLength(0)

    await act(async () => {
      fake.releaseDecodes()
    })

    const stop = await screen.findByRole('button', { name: 'Stop the loop' })
    expect(stop).toBeEnabled()
    expect(stop).toHaveTextContent('■ Stop')
    expect(fake.sources).toHaveLength(1)
  })

  // Step I0 — R4, AC5: the head delay is the groove's own, off its manifest
  // entry. No constant is shared across the catalogue, so a groove minted
  // under a different encoder loops correctly with no code change.
  it("starts the loop at this groove's own head delay (R4, AC5)", async () => {
    const user = userEvent.setup()
    await renderPuzzle(
      <GroovePuzzle groove={{ ...GROOVE, headDelaySeconds: 0.05 }} />,
    )

    await play(user)

    const source = fake.sources[0]
    expect(source.loopStart).toBeCloseTo(0.05, 6)
    expect(source.loopEnd - source.loopStart).toBeCloseTo(
      GROOVE_LOOP_SECONDS,
      5,
    )
    // The first pass skips the encoder delay too, not only the repeats.
    expect(source.start).toHaveBeenCalledWith(0, 0.05)
  })

  /**
   * The reference voice is *not* mocked, in keeping with the rest of this
   * file: the browser is stubbed instead, so these run over the same fetch,
   * decode and node path a real tap takes. Which files exist is
   * `notes.generated.ts`'s business, so the expected URL is read from it.
   */
  const noteSrc = (root: Root) =>
    (NOTES.find((note) => note.root === root) as { audioSrc: string }).audioSrc

  /** Every URL asked for so far, in order. */
  const fetchedUrls = () =>
    (globalThis.fetch as unknown as Mock).mock.calls.map(([url]) => String(url))

  /** Only the reference notes: the groove's own file is not one of them. */
  const fetchedNotes = () =>
    fetchedUrls().filter((url) => url.startsWith('/notes/'))

  /** Wait for the tap's fetch-decode-start chain to have settled. */
  const soundedNotes = async (count: number) => {
    await waitFor(() => expect(fake.sources).toHaveLength(count))
    return fake.sources
  }

  // Step D2 — R1, R2, AC1. It is also AC3 and AC21: the groove has never been
  // played here, so nothing has been warmed and the note is fetched on demand.
  it('selects the tapped root and sounds its note (D2, R1, R2, R3, AC1)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(within(rootGroup()).getByRole('button', { name: 'E♭' }))

    expect(
      within(rootGroup()).getByRole('button', { name: 'E♭' }),
    ).toHaveAttribute('aria-pressed', 'true')

    const [note] = await soundedNotes(1)
    expect(fetchedNotes()).toEqual([noteSrc('E♭')])
    // One-shot, not a loop, and started rather than scheduled (R3, R4).
    expect(note.loop).toBe(false)
    expect(note.start).toHaveBeenCalledTimes(1)
  })

  // Step D3 — R1, AC2. The handler is deliberately unguarded, so the chip that
  // is already selected still sounds. A guard on "the value changed" would
  // break this and nothing else, which is why the case is written down.
  it('sounds the selected root again when it is tapped again (D3, R1, AC2)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    const chip = () => within(rootGroup()).getByRole('button', { name: 'E♭' })
    await user.click(chip())
    await soundedNotes(1)
    await user.click(chip())
    const nodes = await soundedNotes(2)

    expect(chip()).toHaveAttribute('aria-pressed', 'true')
    expect(nodes[1].start).toHaveBeenCalledTimes(1)
    // Heard twice, fetched once (R17, AC14).
    expect(fetchedNotes()).toEqual([noteSrc('E♭')])
  })

  // Step D5 — R12, AC10. The chips are already disabled on a finished day;
  // this is the guard that the new call did not route around that lock.
  it('stays silent on a day that has been solved (D5, R12, AC10)', async () => {
    const stored: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [SOLVING],
      solved: true,
    }
    mockStore.get.mockResolvedValue(stored)
    mockStore.getAll.mockResolvedValue([stored])

    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(within(rootGroup()).getByRole('button', { name: 'G' }))

    expect(fetchedNotes()).toEqual([])
    expect(fake.sources).toHaveLength(0)
    expect(
      within(rootGroup()).getByRole('button', { name: 'G' }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  // Step D6 — R7, AC6. Nothing special-cases the twelve: the page hands the
  // whole chromatic set to the voice whatever the mode, and the row is what
  // narrows. Switching modes therefore costs no fetch of its own.
  it('sounds each of simple mode’s six roots (D6, R7, AC6)', async () => {
    await enableSimpleMode()
    const user = userEvent.setup()
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    const six = simpleRoots()
    expect(chipTexts(rootGroup())).toEqual(six)

    for (const root of six) {
      await user.click(within(rootGroup()).getByRole('button', { name: root }))
    }

    await waitFor(() =>
      expect(fetchedNotes()).toEqual(six.map((root) => noteSrc(root))),
    )
    await soundedNotes(six.length)
  })

  // Step D7 — R6, R13, AC5, AC11. The two voices share the context and nothing
  // else. This fails loudly if the transport is ever reused to play a note.
  it('leaves the groove untouched, and the groove leaves the note alone (D7, R6, R13, AC5, AC11)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await play(user)
    await advance(loopFraction(0.5))
    const groove = fake.sources[0]
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50',
    )

    await user.click(within(rootGroup()).getByRole('button', { name: 'A' }))
    const [, note] = await soundedNotes(2)

    // The groove kept playing, from where it was: no stop, no restart, no
    // rewind, and one context between the two voices (R6, R14, AC5).
    expect(groove.stop).not.toHaveBeenCalled()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50',
    )
    expect(
      screen.getByRole('button', { name: 'Stop the loop' }),
    ).toBeInTheDocument()
    expect(fake.contexts).toHaveLength(1)

    // And the other direction: stopping the groove does not cut the note, which
    // rings on to its natural end (R13, AC11).
    await user.click(screen.getByRole('button', { name: 'Stop the loop' }))
    expect(groove.stop).toHaveBeenCalledTimes(1)
    expect(note.stop).not.toHaveBeenCalled()
  })

  // Step D4 — R9, R10, AC8. The selection is the half that must not depend on
  // the audio: with no Web Audio at all the chip still takes the tap, and the
  // groove's own banner is not raised on a reference note's account (R11).
  it('selects and stays quiet where Web Audio is unavailable (D4, R9, R10, R11, AC8)', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(within(rootGroup()).getByRole('button', { name: 'F' }))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(
      within(rootGroup()).getByRole('button', { name: 'F' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(fake.sources).toHaveLength(0)
  })

  /** Every reference note there is, in the order the module lists them. */
  const allNoteSrcs = () => NOTES.map((note) => note.audioSrc)

  // R18, R19, AC21. Warming is an optimisation that must never contend with
  // the groove the player actually pressed, so it waits for that fetch and
  // decode to finish before asking for anything of its own.
  it('warms the whole row once the groove has decoded, never before (I2, R18, R19)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    // Nothing is asked for until the player asks for something.
    expect(fetchedUrls()).toEqual([])

    await play(user)
    await waitFor(() => expect(fetchedNotes()).toHaveLength(NOTES.length))

    // The groove's own file was asked for first; the twelve notes followed it.
    const urls = fetchedUrls()
    expect(urls[0]).toBe(GROOVE.audioSrc)
    expect(urls.indexOf(GROOVE.audioSrc)).toBeLessThan(
      urls.findIndex((url) => url.startsWith('/notes/')),
    )
    // The whole row, whatever the mode: simple mode's six are a subset (R7).
    expect([...fetchedNotes()].sort()).toEqual([...allNoteSrcs()].sort())
    // Warming sounds nothing — the groove is still the only voice (R18).
    expect(fake.sources).toHaveLength(1)
  })

  it('warms once, not on every press (I2, R19)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await play(user)
    await waitFor(() => expect(fetchedNotes()).toHaveLength(NOTES.length))

    await user.click(screen.getByRole('button', { name: 'Stop the loop' }))
    await play(user)
    await settle()

    // Still twelve: the second press warms nothing, and neither does the
    // decoded buffer already in hand (R17, AC14).
    expect(fetchedNotes()).toHaveLength(NOTES.length)
  })

  // R19a, AC21. Warming is never a precondition. A player who taps a root
  // before ever pressing play hears it, fetched on demand.
  it('sounds a tap that lands before any warm (I2, R19a, AC21)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(within(rootGroup()).getByRole('button', { name: 'B' }))

    const [note] = await soundedNotes(1)
    expect(note.start).toHaveBeenCalledTimes(1)
    // Exactly the one note it needed — the row was never warmed (R19a).
    expect(fetchedNotes()).toEqual([noteSrc('B')])
  })

  // Step C3 — R1a, R5, AC6. The glyph marks where; this sentence is what
  // actually names the behaviour.
  it('reads the new caption under the play control (E2 R1a, R5, AC6)', async () => {
    await renderPuzzle()

    expect(screen.getByText(CAPTION)).toBeInTheDocument()
    // ...and the wording it replaced is gone (F10 E2 R1a).
    expect(
      screen.queryByText('Play along. Find the note that feels like home.'),
    ).toBeNull()
  })

  // Step C4 — R1a, AC6a. R1a supersedes the wording half of feature-4 E2 R4
  // and nothing else: the caption still follows the control, full width, in a
  // column. Written so a later edit cannot move it while chasing its wording.
  it('keeps the caption below the control at full width (E2 R1a, AC6a)', async () => {
    await renderPuzzle()

    const play = screen.getByRole('button', { name: 'Play the loop' })
    const caption = screen.getByText(CAPTION)

    // Same stack, control first.
    expect(play.nextElementSibling).toBe(caption)
    expect(caption.parentElement).toBe(play.parentElement)
    expect(play.parentElement).toHaveClass('flex-col')
    expect(play.parentElement).not.toHaveClass('flex-row')
    // Still the muted, small caption feature-4 put there — tone and size are
    // that epic's, not this one's.
    expect(caption.className).toMatch(/text-text-muted/)
    expect(caption.className).toMatch(/text-\[13px\]/)
  })

  // Step C5 — R10, AC11. No "seen it" flag, no fade after first use: the
  // glyph is the same on a reload as it was on the first frame.
  it('remembers nothing about the glyph across a reload (E2 R10, AC11)', async () => {
    const user = userEvent.setup()
    const first = await renderFeature()

    const marked = () =>
      within(rootGroup())
        .getAllByRole('button')
        .map((chip) => chipAdornment(chip))

    expect(marked().every((glyph) => glyph === NOTE_GLYPH)).toBe(true)

    await user.click(within(rootGroup()).getAllByRole('button')[0])
    await settle()

    // A reload: the tree goes away and the page is built again from storage.
    first.unmount()
    await renderFeature()

    const after = marked()
    expect(after).toHaveLength(12)
    expect(after.every((glyph) => glyph === NOTE_GLYPH)).toBe(true)

    // ...and the tap left no key behind that could have recorded it. Read
    // through the `Storage` interface — see the how-to-play test above.
    const written = Array.from(
      { length: localStorage.length },
      (_, i) => localStorage.key(i) as string,
    )
    const allowed = ['daily-groove:v2:results', 'daily-groove:v1:prefs']
    expect(written.filter((key) => !allowed.includes(key))).toEqual([])
  })

  /**
   * The day's changes, bar by bar, worked out the way the card works them out.
   * `GROOVE.progression` is three chords, so bar four is a return to the first
   * — which is what the generator comps, and what the row has to print.
   */
  const BAR_CHORDS = barChords(GROOVE.progression)

  /** The symbols written over the track, in bar order, or null if there is no row. */
  const trackChords = () => {
    const row = screen.queryByTestId('chord-row')
    return row === null
      ? null
      : Array.from(row.querySelectorAll('[data-bar]')).map((cell) => cell.textContent)
  }

  it('prints no chord over the bars while the day is still on (E3 R2, AC2)', async () => {
    const user = userEvent.setup()
    const { container } = await renderPuzzle()

    // A fresh day: nothing over the track.
    expect(trackChords()).toBeNull()

    // Two attempts spent, neither correct — still nothing.
    await guess(user, 'C', wrongFlavour())
    await guess(user, 'G', wrongFlavour())
    expect(trackChords()).toBeNull()

    // ...and playing the groove does not print them either. This is the guard
    // that matters most: the progression names the root and the mode outright,
    // so a row here would answer both halves of the puzzle before the solve.
    await play(user)
    await advance(loopFraction(0.6))
    expect(trackChords()).toBeNull()
    for (const chord of BAR_CHORDS) {
      expect(screen.queryAllByText(chord), chord).toEqual([])
    }
    expect(container.textContent).not.toContain(GROOVE.progression)
  })

  it('writes the four symbols over the bars once the day is solved (E3 R1, AC1)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'C', wrongFlavour())
    expect(trackChords()).toBeNull()

    await guess(user, 'C', 'Aeolian')

    expect(trackChords()).toEqual(BAR_CHORDS)
    // Over the track, not somewhere else on the page.
    expect(screen.getByTestId('chord-row').nextElementSibling).toBe(
      screen.getByRole('progressbar'),
    )
  })

  it('names the answer beside the tempo only once the day is over', async () => {
    const user = userEvent.setup()
    const { container } = await renderPuzzle()

    // The meta line is the tempo and the day, and nothing that answers the
    // puzzle — not before a guess, and not after a wrong one.
    expect(container.textContent).not.toContain('C Aeolian')
    await guess(user, 'C', wrongFlavour())
    expect(container.textContent).not.toContain('C Aeolian')

    await guess(user, 'C', 'Aeolian')

    // One line under the groove's name, tempo first. Since F12 E3 the answer
    // joins the *end* of that line rather than the middle of it: the card is
    // handed a finished meta line ("<bpm> bpm · <day>", or "· shared groove")
    // and cannot take it apart to insert anything — which is exactly what stops
    // it deciding the line again. Same subject, same rendered node.
    expect(
      screen.getByText(
        // Strict again: the answer sits between the tempo and the day, exactly
        // where feature-11 put it. `metaLine` composes the whole line, so the
        // shared page's wording needed no room made for it here (F12 E3).
        new RegExp(`^${GROOVE.bpm} bpm · C Aeolian · `),
      ),
    ).toBeInTheDocument()
  })

  it('writes them for a day given up on too (E3 R3, AC3)', async () => {
    const wrong = wrongFlavour()
    const stored: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [
        miss('C', wrong, true),
        miss('G', wrong, false),
        miss('G', otherWrongFlavour(), false),
      ],
      solved: false,
      revealed: true,
    }
    mockStore.get.mockResolvedValue(stored)
    mockStore.getAll.mockResolvedValue([stored])

    await renderPuzzle()

    expect(trackChords()).toEqual(BAR_CHORDS)
  })

  it('reads the same over the track as it does on the lead sheet (E3 R1)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'C', 'Aeolian')

    const sheet = within(solutionPanel()).getByRole('img', { name: CHANGES_READ })
    const sheetBars = Array.from(sheet.querySelectorAll('[data-bar]')).map(
      (bar) => bar.textContent,
    )

    // One mapping, two drawings: the row over the bars and the sheet below
    // cannot disagree about which chord bar four is.
    expect(trackChords()).toEqual(sheetBars)
    expect(trackChords()).toEqual(CHANGES_READ.split(' · '))
  })

  /**
   * Steps A4 and A5. Epic 1 made `/groove/<uuid>` play the same puzzle with
   * `mode="shared"`; this is what that mode is allowed to change about the
   * page. Exactly two things: a notice above the card, and the words "shared
   * groove" where the date stands. Everything else — the header, the streak
   * pill, the how-to-play box, both cards and every control on them — is the
   * daily page, unchanged, and most of the assertions below are about that.
   */

  describe('the framing on a shared groove (F12 E3)', () => {

    const renderShared = (groove: Groove = GROOVE) =>
      renderPuzzle(<GroovePuzzle groove={groove} mode="shared" />)

    /** The notice above the card, found by its own opening words. */
    const notice = () => screen.queryByText(/this is a shared groove/i)

    /**
     * The groove card's meta line: the one paragraph on the page that opens
     * with a tempo. Located by what it says rather than by a test id, because
     * what it says is the whole subject of R1a.
     */
    const cardMeta = () =>
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          /^\d+ bpm/.test(element.textContent ?? ''),
      )

    it('reads "shared groove" where the date stands, and shows no date (R1a, R4, AC11)', async () => {
      await renderShared()

      expect(cardMeta().textContent).toBe(`${GROOVE.bpm} bpm · shared groove`)
      expect(cardMeta().textContent).not.toContain(dateLine(new Date()))
    })

    it('leaves the daily card’s line exactly as it was (R1a, R4, AC11)', async () => {
      await renderPuzzle()

      expect(cardMeta().textContent).toBe(
        `${GROOVE.bpm} bpm · ${dateLine(new Date())}`,
      )
      expect(notice()).toBeNull()
    })
  })
})
