/**
 * One of five files holding the composed puzzle's tests. **The grouping rule,
 * and where a new case goes, is documented at the top of
 * `GroovePuzzle.page.test.tsx`** — read it before adding one here.
 */
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DailyResult, Flavour, Groove, Root } from '../types'
// The shared setup — fixtures, the fake audio context, the render and the
// accessible-name queries — has one home (F14 E2 R5). Everything below the
// `vi.mock` block is imported from it rather than restated here.
import {
  advance,
  CAPTION,
  CAPTION_SOUNDS_OFF,
  CHANGES_READ,
  chipAdornment,
  chipLabel,
  flavourGroup,
  flavours,
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
import { beatSeconds } from '../lib/audio/beat'
import { REFERENCE_FADE_SECONDS } from '../lib/audio/level'
import { referenceOutput } from '../lib/audio/output'
import { answerOf, flavourPool, simpleRootOptions } from '../lib/theory/music'
import { FAMILIES, familyOf, type Family } from '../lib/theory/families'
import { scheduleLick, type ScheduledNote } from '../lib/theory/phrase'
import { simpleLickMode } from '../lib/theory/simpleModes'
import { createLocalPreferenceStore } from '../lib/persistence/preferences'
import { dateLine } from '../lib/presentation/date'
import { barChords } from '../lib/theory/changes'
import { GROOVES } from '../data/grooves.generated'
import { NOTES, PITCHES, type PitchSample } from '../data/notes.generated'
import { renderFeature } from '../testing/renderFeature'
import type { FakeContext, FakeSourceNode } from '../testing/fakeAudioContext'

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
   * The Major-family day. Simple mode's resolution is family-symmetric, so the
   * Dorian day above exercises the same code from the Minor side — but F16 E1
   * AC11 names a day *in the Major family*, and until this fixture existed that
   * scenario had never been played through the composed page. Same shape as the
   * sibling fixture in `GroovePuzzle.guessing.test.tsx`, and the same root, so
   * everything derived from the root is unchanged.
   */
  const MIXOLYDIAN: Groove = {
    ...GROOVE,
    flavour: 'Mixolydian',
    scale: 'C Mixolydian',
  }

  /**
   * Turn the preference on before the page reads it, through the same
   * `PreferenceStore` the hook behind the toggle uses. No hook and no component
   * is mocked: the page loads the preference the way it will in a browser.
   */
  async function enableSimpleMode() {
    await createLocalPreferenceStore().update({ simpleMode: true })
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

  /**
   * This groove's own quarter note, read from the fixture's tempo rather than
   * written out: the grid is derived from the tempo, so a literal here would
   * stop being about the same beat the moment the fixture changed (R8).
   */
  const BEAT = beatSeconds(GROOVE.bpm)

  /** A deliberately off-beat offset: a quarter of a beat past one. */
  const OFF_BEAT = BEAT * 0.25

  /** The graph time a source node was told to start at. */
  const startedAt = (node: (typeof fake.sources)[number]) =>
    (node.start.mock.calls[0] as [number])[0]

  const progressReads = () =>
    screen.getByRole('progressbar').getAttribute('aria-valuenow')

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

  // Step E4 — F16 E3 R6, R13, AC4, AC11. The wiring seen from the page: the
  // day's tempo reaches the grid, and the grid reaches the voice.
  it('selects at once and sounds on the next beat (F16 E3 R6, R13, AC4, AC11)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await play(user)
    await advance(OFF_BEAT)
    const tappedAt = fake.currentTime

    await user.click(within(rootGroup()).getByRole('button', { name: 'A' }))

    // Selection is the half that never waits: the chip is pressed before the
    // clock has moved a sample, let alone reached the beat (R13, AC11).
    expect(
      within(rootGroup()).getByRole('button', { name: 'A' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(fake.currentTime).toBe(tappedAt)

    const [, note] = await soundedNotes(2)
    // Three quarters of a beat away — the next beat boundary of this groove's
    // own tempo, not the moment of the tap (R6, AC4).
    expect(startedAt(note)).toBeCloseTo(tappedAt + BEAT * 0.75, 9)
    expect(startedAt(note)).toBeGreaterThan(tappedAt)
  })

  // Step E5 — F16 E3 R7, AC5. A stopped groove has no beat to wait for, whether
  // or not it has ever run.
  it('sounds without waiting while the loop is stopped (F16 E3 R7, AC5)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await advance(2)
    await user.click(within(rootGroup()).getByRole('button', { name: 'A' }))

    const [first] = await soundedNotes(1)
    expect(startedAt(first)).toBe(2)

    // And once it has run and been stopped again: still immediate.
    await play(user)
    await user.click(screen.getByRole('button', { name: 'Stop the loop' }))
    await advance(0.3)
    const tappedAt = fake.currentTime

    await user.click(within(rootGroup()).getByRole('button', { name: 'B' }))
    await waitFor(() => expect(fake.sources).toHaveLength(3))

    expect(startedAt(fake.sources[2])).toBe(tappedAt)
  })

  // Step D7 — R6, R13, AC5, AC11. The two voices share the context and nothing
  // else. This fails loudly if the transport is ever reused to play a note.
  it('leaves the groove untouched, and the groove leaves the note alone (D7, R6, R13, AC5, AC11)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await play(user)
    // Half a loop, and then off the beat: since F16 E3 a tap on the beat is
    // immediate and a tap between beats is scheduled, so the position is chosen
    // to make this case the scheduled one rather than to leave it to arithmetic.
    await advance(loopFraction(0.5) + OFF_BEAT)
    const groove = fake.sources[0]
    const at = progressReads()

    await user.click(within(rootGroup()).getByRole('button', { name: 'A' }))
    const [, note] = await soundedNotes(2)

    // The groove kept playing, from where it was: no stop, no restart, no
    // rewind, and one context between the two voices (R6, R14, AC5).
    expect(groove.stop).not.toHaveBeenCalled()
    expect(progressReads()).toBe(at)
    expect(
      screen.getByRole('button', { name: 'Stop the loop' }),
    ).toBeInTheDocument()
    expect(fake.contexts).toHaveLength(1)

    // And the other direction: stopping the groove does not cut the note, which
    // rings on to its natural end (R13, AC11; F16 E3 R11, AC9). The clock is
    // moved past the beat the note was scheduled for first, so the note being
    // spared is unambiguously one that is *sounding* — which is the whole of
    // what separates this case from the one below it.
    await advance(BEAT)
    expect(fake.currentTime).toBeGreaterThan(startedAt(note))

    await user.click(screen.getByRole('button', { name: 'Stop the loop' }))
    expect(groove.stop).toHaveBeenCalledTimes(1)
    expect(note.stop).not.toHaveBeenCalled()
  })

  // Step E6 — F16 E3 R12, AC10. The exact pair to the case above, and the only
  // thing separating them is whether the note had reached its start time.
  it('drops a note the stopped groove never reaches (F16 E3 R12, AC10)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await play(user)
    await advance(loopFraction(0.5) + OFF_BEAT)

    await user.click(within(rootGroup()).getByRole('button', { name: 'A' }))
    const [, note] = await soundedNotes(2)

    // Still pending: the beat it is waiting for is ahead of the clock.
    const when = startedAt(note)
    expect(when).toBeGreaterThan(fake.currentTime)

    await user.click(screen.getByRole('button', { name: 'Stop the loop' }))

    // Stopped before its own start time and faded to nothing, so it never
    // sounds — the beat it was queued for will not arrive.
    expect(note.stop).toHaveBeenCalled()
    expect((note.stop.mock.calls[0] as [number])[0]).toBeLessThan(when)
    expect(fake.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      expect.any(Number),
    )
  })

  // Step E7 — F16 E3 R9, R15, AC7. The regression guard that reading the
  // groove's clock stayed one-directional once the page composed it.
  it('leaves the groove exactly where it was (F16 E3 R9, R15, AC7)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await play(user)
    await advance(loopFraction(0.5))
    const groove = fake.sources[0]
    const at = progressReads()

    for (const root of ['A', 'B', 'D'] as const) {
      await user.click(within(rootGroup()).getByRole('button', { name: root }))
    }
    await waitFor(() => expect(fake.sources.length).toBeGreaterThanOrEqual(4))

    // Three taps in quick succession, and the groove is untouched: not stopped,
    // not restarted, not moved, and the control still offers the same press.
    expect(groove.stop).not.toHaveBeenCalled()
    expect(groove.start).toHaveBeenCalledTimes(1)
    expect(progressReads()).toBe(at)
    expect(
      screen.getByRole('button', { name: 'Stop the loop' }),
    ).toBeInTheDocument()
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

  /**
   * The mode row's own voice (F16 E1). The root row above sounds one note; a
   * mode chip sounds a short phrase in that mode, from the same root, at the
   * same tempo, through the same shared output — so most of what is asserted
   * here is that the second voice is the *same* instrument as the first and
   * not a parallel one.
   */
  describe('the mode row sounds a lick (F16 E1)', () => {
    /** Every mode the catalogue can play, as the page resolves the pool. */
    const POOL = flavourPool(GROOVES)

    /** The file one rendered pitch sits behind. */
    const pitchSrc = (midi: number) =>
      (PITCHES.find((pitch) => pitch.midi === midi) as PitchSample).audioSrc

    /**
     * The files a phrase needs, in the order the voice asks for them: note
     * order, with a repeated pitch asked for once. Which files exist is
     * `notes.generated.ts`'s business, so the URLs are read from it.
     */
    const phraseFiles = (notes: ScheduledNote[]) => {
      const wanted: string[] = []
      for (const note of notes) {
        const src = pitchSrc(note.midi)
        if (!wanted.includes(src)) wanted.push(src)
      }
      return wanted
    }

    /** Float noise from adding an origin to an offset is not the subject. */
    const round = (seconds: number) => Math.round(seconds * 1e9) / 1e9

    /** The graph time a node was told to stop at, as it was scheduled. */
    const stoppedAt = (node: FakeSourceNode) =>
      (node.stop.mock.calls[0] as [number])[0]

    /**
     * The phrase the graph was actually given, read back off its nodes: each
     * note's onset relative to the first, and its sounding length. The tail
     * ramp is the one declared fade, so the length comes back out of the stop
     * time by subtracting it.
     */
    const soundedPhrase = (nodes: FakeSourceNode[]) => {
      const origin = startedAt(nodes[0])
      return nodes.map((node) => ({
        offsetSeconds: round(startedAt(node) - origin),
        durationSeconds: round(
          stoppedAt(node) - startedAt(node) - REFERENCE_FADE_SECONDS,
        ),
      }))
    }

    /** The same shape, from the arithmetic `lib/theory/phrase.ts` owns. */
    const phraseShape = (notes: ScheduledNote[]) =>
      notes.map((note) => ({
        offsetSeconds: round(note.offsetSeconds),
        durationSeconds: round(note.durationSeconds),
      }))

    /** Wait for one phrase's nodes, and hand back only that phrase's. */
    const soundedLick = async (from: number, count: number) => {
      await waitFor(() => expect(fake.sources).toHaveLength(from + count))
      return fake.sources.slice(from)
    }

    const tapMode = (
      user: ReturnType<typeof userEvent.setup>,
      name: string,
    ) => user.click(within(flavourGroup()).getByRole('button', { name }))

    /** The whole guess card's text, for the two "nothing names a mode" cases. */
    const cardText = () =>
      screen.getByRole('heading', { name: 'What is it?' })
        .parentElement as HTMLElement

    // Step H1 — R1, R7, R32. It is also AC20: the groove has never been played
    // here, so nothing has been warmed and the phrase fetches its own pitches.
    it('sounds the tapped mode’s lick from the day’s root (H1, R1, R7, R32, AC20)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      const mode = flavours()[0]
      const phrase = scheduleLick({
        flavour: mode,
        root: GROOVE.root,
        bpm: GROOVE.bpm,
      })
      expect(phrase.length).toBeGreaterThan(0)

      await tapMode(user, mode)

      const nodes = await soundedLick(0, phrase.length)
      // One node per note, each one-shot and started rather than left waiting.
      for (const node of nodes) {
        expect(node.loop).toBe(false)
        expect(node.start).toHaveBeenCalledTimes(1)
      }
      // The right pitches, in the right places, for the right lengths — the
      // day's root and the day's tempo, resolved by `scheduleLick` and by
      // nothing in the page.
      expect(fetchedNotes()).toEqual(phraseFiles(phrase))
      expect(soundedPhrase(nodes)).toEqual(phraseShape(phrase))
      // Hearing is still selecting, and still not guessing (R2, R3).
      expect(
        within(flavourGroup()).getByRole('button', { name: mode }),
      ).toHaveAttribute('aria-pressed', 'true')
    })

    // Step H1 — R1, AC2. The handler is deliberately unguarded, exactly as the
    // root row's is: the chip already selected still sounds.
    it('sounds the selected mode again when it is tapped again (H1, R1, AC2)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      const mode = flavours()[0]
      const phrase = scheduleLick({
        flavour: mode,
        root: GROOVE.root,
        bpm: GROOVE.bpm,
      })

      await tapMode(user, mode)
      await soundedLick(0, phrase.length)
      await tapMode(user, mode)
      const again = await soundedLick(phrase.length, phrase.length)

      expect(soundedPhrase(again)).toEqual(phraseShape(phrase))
      // Heard twice, fetched once (R32).
      expect(fetchedNotes()).toEqual(phraseFiles(phrase))
    })

    // Step H2 — R15, R16, R17, R18, AC11, AC12, AC13. Simple mode's row offers
    // families, but a lick has to be *in* something, so each chip stands for
    // one real mode.
    it('sounds two real modes from simple mode’s two chips (H2, R15, R16, R17, R18, AC11, AC13)', async () => {
      await enableSimpleMode()
      const user = userEvent.setup()
      await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

      expect(chipTexts(flavourGroup())).toEqual(FAMILIES)

      const day = answerOf(DORIAN)
      const own = familyOf(day.flavour)
      const other = FAMILIES.find((family) => family !== own) as Family

      // The chip whose family matches the day plays the day's actual mode, so
      // the correct answer sounds like the groove the player is on (R15).
      const dayPhrase = scheduleLick({
        flavour: day.flavour,
        root: day.root,
        bpm: DORIAN.bpm,
      })
      await tapMode(user, own)
      expect(soundedPhrase(await soundedLick(0, dayPhrase.length))).toEqual(
        phraseShape(dayPhrase),
      )

      // The other chip plays a real mode of *its own* family, picked for the
      // day — never the day's own mode, which its family cannot contain (R16).
      const resolved = simpleLickMode({
        family: other,
        answer: day,
        pool: POOL,
        date: new Date(),
      })
      expect(resolved).not.toBeNull()
      expect(familyOf(resolved as Flavour)).toBe(other)
      expect(resolved).not.toBe(day.flavour)

      const otherPhrase = scheduleLick({
        flavour: resolved as Flavour,
        root: day.root,
        bpm: DORIAN.bpm,
      })
      await tapMode(user, other)
      expect(
        soundedPhrase(
          await soundedLick(dayPhrase.length, otherPhrase.length),
        ),
      ).toEqual(phraseShape(otherPhrase))

      // And neither mode is ever written down: the row still says Major and
      // Minor and the card names no mode at all (R18, AC13).
      expect(chipTexts(flavourGroup())).toEqual(FAMILIES)
      for (const mode of POOL) {
        expect(cardText()).not.toHaveTextContent(mode)
      }
    })

    // Step H2 — R15, R16, AC11. The mirror of the case above, on the day AC11
    // literally names: *a day whose mode is in the Major family*. The case
    // above plays a Dorian day, which is Minor-family, so the criterion's own
    // scenario had never been run through the composed page — both directions
    // are unit-tested over all twelve answers in `simpleModes.test.ts`, and
    // this is the page wiring on the side the criterion describes. It is
    // deliberately the same render, the same taps and the same comparison as
    // its Minor twin: the only thing that changes is the day.
    it('plays the day’s own mode from Major on a Major day (H2, R15, R16, AC11)', async () => {
      await enableSimpleMode()
      const user = userEvent.setup()
      await renderPuzzle(<GroovePuzzle groove={MIXOLYDIAN} />)

      const day = answerOf(MIXOLYDIAN)
      // The premise of the criterion, asserted rather than assumed: if the
      // families table ever regraded this mode, the case below would silently
      // stop being the Major-family scenario it is named for.
      expect(familyOf(day.flavour)).toBe('Major')
      expect(chipTexts(flavourGroup())).toEqual(FAMILIES)

      // `Major` is the chip whose family matches the day, so it plays the day's
      // actual mode — the correct answer sounds like the groove (R15).
      const dayPhrase = scheduleLick({
        flavour: day.flavour,
        root: day.root,
        bpm: MIXOLYDIAN.bpm,
      })
      expect(dayPhrase.length).toBeGreaterThan(0)
      await tapMode(user, 'Major')
      expect(soundedPhrase(await soundedLick(0, dayPhrase.length))).toEqual(
        phraseShape(dayPhrase),
      )
      // Its pitches too, not only its rhythm: R15 is about *which mode* the
      // chip is in, and the files asked for are what say so. Nothing had been
      // warmed — the groove was never played — so this is the phrase's own set.
      expect(fetchedNotes()).toEqual(phraseFiles(dayPhrase))

      // `Minor` plays a real mode of its own family, picked for the day, and
      // never the day's own — which its family cannot contain (R16).
      const resolved = simpleLickMode({
        family: 'Minor',
        answer: day,
        pool: POOL,
        date: new Date(),
      })
      expect(resolved).not.toBeNull()
      expect(familyOf(resolved as Flavour)).toBe('Minor')
      expect(resolved).not.toBe(day.flavour)

      const otherPhrase = scheduleLick({
        flavour: resolved as Flavour,
        root: day.root,
        bpm: MIXOLYDIAN.bpm,
      })
      await tapMode(user, 'Minor')
      expect(
        soundedPhrase(
          await soundedLick(dayPhrase.length, otherPhrase.length),
        ),
      ).toEqual(phraseShape(otherPhrase))
      // And its pitches: every file the Minor mode's phrase needs was asked
      // for. `arrayContaining` rather than equality because the first phrase's
      // files are already in the list and the voice fetches each pitch once.
      expect(fetchedNotes()).toEqual(
        expect.arrayContaining(phraseFiles(otherPhrase)),
      )
      // The two chips really did sound two different things, so a resolution
      // that collapsed to one mode could not pass by coincidence.
      expect(phraseShape(otherPhrase)).not.toEqual(phraseShape(dayPhrase))
    })

    // Step H2 — R17, AC12. Same day, same pair: the seed is the date, so a
    // reload hears what the first render heard.
    it('sounds the same pair on a second render of the same day (H2, R17, AC12)', async () => {
      await enableSimpleMode()
      const user = userEvent.setup()

      const day = answerOf(DORIAN)
      const other = FAMILIES.find(
        (family) => family !== familyOf(day.flavour),
      ) as Family
      const expected = phraseShape(
        scheduleLick({
          flavour: simpleLickMode({
            family: other,
            answer: day,
            pool: POOL,
            date: new Date(),
          }) as Flavour,
          root: day.root,
          bpm: DORIAN.bpm,
        }),
      )

      const first = await renderPuzzle(<GroovePuzzle groove={DORIAN} />)
      await tapMode(user, other)
      const heard = soundedPhrase(await soundedLick(0, expected.length))
      expect(heard).toEqual(expected)

      first.unmount()
      const before = fake.sources.length
      await renderPuzzle(<GroovePuzzle groove={DORIAN} />)
      await tapMode(user, other)
      expect(
        soundedPhrase(await soundedLick(before, expected.length)),
      ).toEqual(heard)
    })

    // Step H3 — R9, R11, AC7, AC8. The grid is the transport's, read one way:
    // the phrase lands on the groove's next beat and the groove never notices.
    it('starts the lick on the groove’s next beat, over an untouched groove (H3, R9, R11, AC7, AC8)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await play(user)
      await advance(OFF_BEAT)
      const groove = fake.sources[0]
      const tappedAt = fake.currentTime
      const at = progressReads()
      const before = fake.sources.length

      const mode = flavours()[0]
      const phrase = scheduleLick({
        flavour: mode,
        root: GROOVE.root,
        bpm: GROOVE.bpm,
      })
      await tapMode(user, mode)
      const nodes = await soundedLick(before, phrase.length)

      // Three quarters of a beat away — the next beat of this groove's own
      // tempo, and strictly ahead of the tap (AC8).
      expect(startedAt(nodes[0])).toBeCloseTo(tappedAt + BEAT * 0.75, 9)
      expect(startedAt(nodes[0])).toBeGreaterThan(tappedAt)
      // Every note after it keeps its written place against that origin.
      expect(soundedPhrase(nodes)).toEqual(phraseShape(phrase))

      // The groove is exactly where it was: not stopped, not restarted, not
      // moved, and one context between the two voices (AC7, R9).
      expect(groove.stop).not.toHaveBeenCalled()
      expect(groove.start).toHaveBeenCalledTimes(1)
      expect(progressReads()).toBe(at)
      expect(
        screen.getByRole('button', { name: 'Stop the loop' }),
      ).toBeInTheDocument()
      expect(fake.contexts).toHaveLength(1)
    })

    // Step H3 — R12, AC9. A stopped groove has no beat to wait for.
    it('sounds the lick at once while the loop is stopped (H3, R12, AC9)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await advance(2)
      const mode = flavours()[0]
      const phrase = scheduleLick({
        flavour: mode,
        root: GROOVE.root,
        bpm: GROOVE.bpm,
      })

      await tapMode(user, mode)
      const nodes = await soundedLick(0, phrase.length)

      expect(startedAt(nodes[0])).toBe(2)
    })

    // Step H3 — R10. The coupling is one-way in the other direction too:
    // stopping the groove cannot reach into a phrase already scheduled.
    it('leaves the lick alone when the groove stops (H3, R10)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await play(user)
      await advance(OFF_BEAT)
      const before = fake.sources.length

      const mode = flavours()[0]
      const phrase = scheduleLick({
        flavour: mode,
        root: GROOVE.root,
        bpm: GROOVE.bpm,
      })
      await tapMode(user, mode)
      const nodes = await soundedLick(before, phrase.length)

      await user.click(screen.getByRole('button', { name: 'Stop the loop' }))

      // Each node carries exactly the one stop the phrase scheduled for its
      // own tail. A second call would be the groove cutting it short.
      for (const node of nodes) {
        expect(node.stop).toHaveBeenCalledTimes(1)
        expect(stoppedAt(node)).toBeGreaterThan(startedAt(node))
      }
    })

    // Step H4 — R8, AC6. One reference sound at a time, and a second phrase is
    // the same takeover a second root is.
    it('lets one mode lick replace another (H4, R8, AC6)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      const [one, two] = flavours()
      const first = scheduleLick({
        flavour: one,
        root: GROOVE.root,
        bpm: GROOVE.bpm,
      })
      const second = scheduleLick({
        flavour: two,
        root: GROOVE.root,
        bpm: GROOVE.bpm,
      })

      await tapMode(user, one)
      const firstNodes = await soundedLick(0, first.length)
      await tapMode(user, two)
      const secondNodes = await soundedLick(first.length, second.length)

      // Every node of the first phrase was let go, and none of the second's.
      for (const node of firstNodes) {
        expect(node.stop.mock.calls.length).toBeGreaterThan(1)
      }
      for (const node of secondNodes) {
        expect(node.stop).toHaveBeenCalledTimes(1)
      }
      // And the output is held once, by the phrase that is sounding.
      expect(referenceOutput().isClaimed()).toBe(true)
    })

    // Step H4 — R8a, AC6a. The root row's ringing note is the other half of
    // the same instrument, so a mode tap silences it.
    it('silences a ringing root note when a mode is tapped (H4, R8a, AC6a)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await user.click(within(rootGroup()).getByRole('button', { name: 'A' }))
      await waitFor(() => expect(fake.sources).toHaveLength(1))
      const note = fake.sources[0]
      // The root row's note is scheduled with no stop of its own: it rings for
      // the length of the file. Anything that stops it is a takeover.
      expect(note.stop).not.toHaveBeenCalled()

      const mode = flavours()[0]
      const phrase = scheduleLick({
        flavour: mode,
        root: GROOVE.root,
        bpm: GROOVE.bpm,
      })
      await tapMode(user, mode)
      await soundedLick(1, phrase.length)

      // Faded, then stopped — not cut off mid-sample.
      expect(fake.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0,
        expect.any(Number),
      )
      expect(note.stop).toHaveBeenCalledTimes(1)
      expect(referenceOutput().isClaimed()).toBe(true)
    })

    // Step H4 — R8, AC6b. And the other direction, including the part of the
    // phrase that had not sounded yet: a note queued for a beat that is still
    // ahead is dropped as surely as one already ringing.
    it('silences a scheduled lick when a root is tapped (H4, R8, AC6b)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await play(user)
      await advance(OFF_BEAT)
      const before = fake.sources.length

      const mode = flavours()[0]
      const phrase = scheduleLick({
        flavour: mode,
        root: GROOVE.root,
        bpm: GROOVE.bpm,
      })
      await tapMode(user, mode)
      const nodes = await soundedLick(before, phrase.length)
      // Every one of them is still waiting for its beat.
      for (const node of nodes) {
        expect(startedAt(node)).toBeGreaterThan(fake.currentTime)
      }

      await user.click(within(rootGroup()).getByRole('button', { name: 'A' }))
      await waitFor(() =>
        expect(fake.sources).toHaveLength(before + phrase.length + 1),
      )

      for (const node of nodes) {
        await waitFor(() =>
          expect(node.stop.mock.calls.length).toBeGreaterThan(1),
        )
        // Stopped before its own start time, so it never sounds at all.
        expect((node.stop.mock.calls[1] as [number])[0]).toBeLessThan(
          startedAt(node),
        )
      }
      expect(referenceOutput().isClaimed()).toBe(true)
    })

    // Step H5 — R25. The caption is what names the behaviour, and both rows
    // sound now, so it offers both — in one sentence, naming no mode.
    it('offers both rows in one sentence, and names no mode (H5, R25)', async () => {
      await renderPuzzle()

      const text = screen.getByText(CAPTION).textContent as string
      expect(text).toContain('a root')
      expect(text).toContain('a mode')
      // One sentence, one dash, no wrap written into the copy.
      expect(text).not.toContain('\n')
      expect(text.split('—')).toHaveLength(2)
      for (const mode of POOL) expect(text).not.toContain(mode)
    })

    // Step H6 — R22, AC15. The chips are already locked on a finished day;
    // this is the guard that the new call did not route around that lock.
    it.each([
      ['solved', { solved: true, attempts: [SOLVING] }],
      ['given up on', { solved: false, revealed: true, attempts: [] }],
    ])('stays silent on a day that has been %s (H6, R22, AC15)', async (_, ending) => {
      const stored: DailyResult = {
        date: TODAY(),
        answer: { root: 'C', flavour: 'Aeolian' },
        ...ending,
      }
      mockStore.get.mockResolvedValue(stored)
      mockStore.getAll.mockResolvedValue([stored])

      const user = userEvent.setup()
      await renderPuzzle()

      const mode = wrongFlavour()
      const chip = () =>
        within(flavourGroup()).getByRole('button', { name: mode })
      const was = chip().getAttribute('aria-pressed')

      await user.click(chip())

      expect(fetchedNotes()).toEqual([])
      expect(fake.sources).toHaveLength(0)
      expect(chip()).toHaveAttribute('aria-pressed', was as string)
    })

    // Step H6 — R19, R20, R21, AC14. Selection is the half that must not
    // depend on the audio, and a phrase that cannot sound is silence: no
    // banner, no console-visible break.
    it('selects and stays quiet where Web Audio is unavailable (H6, R19, R20, R21, AC14)', async () => {
      vi.stubGlobal('AudioContext', undefined)
      const complained = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {})
      try {
        const user = userEvent.setup()
        await renderPuzzle()

        const mode = flavours()[0]
        await tapMode(user, mode)
        await act(async () => {
          await Promise.resolve()
          await Promise.resolve()
        })

        expect(
          within(flavourGroup()).getByRole('button', { name: mode }),
        ).toHaveAttribute('aria-pressed', 'true')
        expect(fake.sources).toHaveLength(0)
        expect(screen.queryByRole('alert')).toBeNull()
        expect(complained).not.toHaveBeenCalled()
      } finally {
        complained.mockRestore()
      }
    })

    // Step H7 — R33, R34. The licks warm on the same gate the root row does,
    // behind the groove the player actually pressed for.
    it('warms the pitches once the groove has decoded, never before (H7, R33)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      // Nothing is asked for until the player asks for something.
      expect(fake.fetchCalls).toBe(0)

      await play(user)
      await waitFor(() =>
        expect(fetchedNotes()).toHaveLength(NOTES.length + PITCHES.length),
      )

      // The groove's own file was asked for first; both voices' files followed.
      const urls = fetchedUrls()
      expect(urls[0]).toBe(GROOVE.audioSrc)
      expect(urls.indexOf(GROOVE.audioSrc)).toBeLessThan(
        urls.findIndex((url) => url.startsWith('/notes/')),
      )
      // Warming sounds nothing — the groove is still the only voice.
      expect(fake.sources).toHaveLength(1)
    })
  })

  /** Every reference note there is, in the order the module lists them. */
  const allNoteSrcs = () => NOTES.map((note) => note.audioSrc)

  // R18, R19, AC21. Warming is an optimisation that must never contend with
  // the groove the player actually pressed, so it waits for that fetch and
  // decode to finish before asking for anything of its own.
  /**
   * Everything one press warms. Since F16 E1 that is two voices' worth: the
   * root row's twelve notes and the mode row's twenty-four pitches, each voice
   * holding its own cache, so the twelve files the two sets share are asked for
   * once per voice.
   */
  const WARMED = NOTES.length + PITCHES.length

  it('warms the whole row once the groove has decoded, never before (I2, R18, R19)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    // Nothing is asked for until the player asks for something.
    expect(fetchedUrls()).toEqual([])

    await play(user)
    await waitFor(() => expect(fetchedNotes()).toHaveLength(WARMED))

    // The groove's own file was asked for first; the notes followed it.
    const urls = fetchedUrls()
    expect(urls[0]).toBe(GROOVE.audioSrc)
    expect(urls.indexOf(GROOVE.audioSrc)).toBeLessThan(
      urls.findIndex((url) => url.startsWith('/notes/')),
    )
    // The whole row, whatever the mode: simple mode's six are a subset (R7).
    for (const src of allNoteSrcs()) expect(fetchedNotes()).toContain(src)
    // Warming sounds nothing — the groove is still the only voice (R18).
    expect(fake.sources).toHaveLength(1)
  })

  it('warms once, not on every press (I2, R19)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await play(user)
    await waitFor(() => expect(fetchedNotes()).toHaveLength(WARMED))

    await user.click(screen.getByRole('button', { name: 'Stop the loop' }))
    await play(user)
    await settle()

    // Still the same set: the second press warms nothing, and neither does the
    // decoded buffer already in hand (R17, AC14).
    expect(fetchedNotes()).toHaveLength(WARMED)
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
   * The tap-sounds switch, seen from the composed page (F16 E2).
   *
   * Everything here runs through the real `useTapSounds` against the real
   * `createLocalPreferenceStore`: no hook is mocked and nothing reaches past
   * the feature's public surface, because a mocked hook path is a mocked
   * internal and the claim being made is that *the page* reads the preference.
   */
  describe('the tap sounds can be switched off (F16 E2)', () => {
    const soundSwitch = () => screen.getByRole('switch', { name: /tap sounds/i })
    const modeSwitch = () => screen.getByRole('switch', { name: /simple mode/i })

    const turnSoundsOff = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(soundSwitch())
    }

    /** Whether `b` comes after `a` in document order. */
    const precedes = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

    /** The adornment every root chip is wearing, in row order. */
    const marked = () =>
      within(rootGroup())
        .getAllByRole('button')
        .map((chip) => chipAdornment(chip))

    /** The accessible names the root row offers, in row order. */
    const rootNames = () =>
      within(rootGroup())
        .getAllByRole('button')
        .map((chip) => chipLabel(chip))

    const tapRoot = (
      user: ReturnType<typeof userEvent.setup>,
      root: string,
    ) => user.click(within(rootGroup()).getByRole('button', { name: root }))

    // Step E1 — R1, R2, AC1, AC2. The page reads the preference and hands it
    // to the card; a player who never touches the switch gets the app as it
    // behaved before it existed.
    it('offers the switch below the mode switch, on by default (E1, R1, R2, AC1, AC2)', async () => {
      await renderPuzzle()

      expect(soundSwitch()).toBeInTheDocument()
      expect(soundSwitch()).toHaveAttribute('aria-checked', 'true')
      expect(precedes(modeSwitch(), soundSwitch())).toBe(true)
      expect(precedes(soundSwitch(), rootGroup())).toBe(true)
    })

    // Step E2 — R9, R10, R11, AC4, AC9, AC10. The gate is where the handlers
    // are built, so a silenced tap fetches nothing and decodes nothing: not a
    // mute over audio that still loads.
    it('selects but fetches nothing on either row with the sounds off (E2, R9, R10, R11, AC4, AC9, AC10)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await turnSoundsOff(user)

      await tapRoot(user, 'E♭')

      expect(fetchedNotes()).toEqual([])
      expect(fake.sources).toHaveLength(0)
      expect(
        within(rootGroup()).getByRole('button', { name: 'E♭' }),
      ).toHaveAttribute('aria-pressed', 'true')

      // And the mode row, on the one flag: it is the half Epic 1 built, and
      // this is the guard it inherits.
      const mode = flavours()[0]
      await user.click(within(flavourGroup()).getByRole('button', { name: mode }))

      expect(fetchedNotes()).toEqual([])
      expect(fake.sources).toHaveLength(0)
      expect(
        within(flavourGroup()).getByRole('button', { name: mode }),
      ).toHaveAttribute('aria-pressed', 'true')
    })

    // Step E3 — R4, AC4. The handler is rebuilt from the current preference on
    // every render, which is what makes both directions immediate.
    it('sounds the next tap once the switch goes back on (E3, R4, AC4)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await turnSoundsOff(user)
      await tapRoot(user, 'E♭')
      expect(fetchedNotes()).toEqual([])

      await user.click(soundSwitch())
      expect(soundSwitch()).toHaveAttribute('aria-checked', 'true')

      await tapRoot(user, 'E♭')

      const [note] = await soundedNotes(1)
      expect(fetchedNotes()).toEqual([noteSrc('E♭')])
      expect(note.start).toHaveBeenCalledTimes(1)
      // Nothing was remounted on the way: one graph, whatever the switch did.
      expect(fake.contexts.length).toBeLessThanOrEqual(1)
    })

    // Step E4 — R12, AC11. A row that cannot sound must not promise that it
    // will — and the mark going away must not change what the row offers.
    it('takes the mark off the row and puts it back (E4, R12, AC11)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      const names = rootNames()
      expect(names).toHaveLength(12)
      expect(marked().every((glyph) => glyph === NOTE_GLYPH)).toBe(true)

      await turnSoundsOff(user)

      expect(marked()).toHaveLength(12)
      expect(marked().every((glyph) => glyph === null)).toBe(true)
      expect(rootNames()).toEqual(names)

      await user.click(soundSwitch())

      expect(marked().every((glyph) => glyph === NOTE_GLYPH)).toBe(true)
      expect(rootNames()).toEqual(names)
    })

    // Step E5 — R12a, AC11a. One line, in the same place, saying what happened
    // and how to undo it. The assertions about *where* it sits are the caption
    // case above, applied to the second wording, so a swap cannot quietly move
    // it while chasing the words.
    it('swaps the caption for one that says how to switch them back (E5, R12a, AC11a)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      expect(screen.getByText(CAPTION)).toBeInTheDocument()

      await turnSoundsOff(user)

      expect(screen.queryByText(CAPTION)).toBeNull()
      const caption = screen.getByText(CAPTION_SOUNDS_OFF)
      const control = screen.getByRole('button', { name: 'Play the loop' })
      expect(control.nextElementSibling).toBe(caption)
      expect(caption.parentElement).toBe(control.parentElement)
      expect(caption.className).toMatch(/text-text-muted/)
      expect(caption.className).toMatch(/text-\[13px\]/)
      // Still one line: it names the state and points at the switch, and it
      // does not explain what the sounds are for.
      expect(CAPTION_SOUNDS_OFF).not.toContain('\n')

      await user.click(soundSwitch())

      expect(screen.getByText(CAPTION)).toBeInTheDocument()
      expect(screen.queryByText(CAPTION_SOUNDS_OFF)).toBeNull()
    })

    // Step E6 — R6, AC6. The switch governs a chip's noise and reaches nothing
    // the transport owns; this is the guard that a later edit does not connect
    // them.
    it('leaves the groove playing, at the same position (E6, R6, AC6)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await play(user)
      await advance(loopFraction(0.5))
      const groove = fake.sources[0]
      const at = progressReads()
      const sounding = fake.sources.length

      const stillPlaying = () => {
        expect(progressReads()).toBe(at)
        expect(
          screen.getByRole('button', { name: 'Stop the loop' }),
        ).toBeInTheDocument()
        expect(fake.sources).toHaveLength(sounding)
        expect(groove.stop).not.toHaveBeenCalled()
      }

      await turnSoundsOff(user)
      stillPlaying()

      await user.click(soundSwitch())
      stillPlaying()
    })

    // Step E8 — R3, AC3. The composed proof that the preference is stored, and
    // that the second field did not open a second key.
    it('is still off after a reload (E8, R3, AC3)', async () => {
      const user = userEvent.setup()
      const first = await renderFeature()

      await turnSoundsOff(user)
      await settle()
      first.unmount()
      await renderFeature()

      expect(soundSwitch()).toHaveAttribute('aria-checked', 'false')
      expect(marked().every((glyph) => glyph === null)).toBe(true)
      expect(screen.getByText(CAPTION_SOUNDS_OFF)).toBeInTheDocument()

      // One key for both preferences: the field was additive, so no migration
      // and no second key (R7).
      const written = Array.from(
        { length: localStorage.length },
        (_, i) => localStorage.key(i) as string,
      )
      const allowed = ['daily-groove:v2:results', 'daily-groove:v1:prefs']
      expect(written.filter((key) => !allowed.includes(key))).toEqual([])
    })

    // Step E9 — R7, AC7. The case that actually matters: a player who already
    // had simple mode on must not lose it to a field they have never seen.
    it('loads a preference written before this switch existed (E9, R7, AC7)', async () => {
      localStorage.setItem(
        'daily-groove:v1:prefs',
        JSON.stringify({ simpleMode: true }),
      )
      const user = userEvent.setup()
      await renderFeature()

      expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
      expect(chipTexts(flavourGroup())).toEqual(FAMILIES)
      expect(soundSwitch()).toHaveAttribute('aria-checked', 'true')

      // ...and the sounds are really on, not merely reported as on.
      const root = rootNames()[0]
      await tapRoot(user, root)
      await soundedNotes(1)
    })

    // R8, AC8 — the two clauses no other tier reaches. `useTapSounds.test.ts`
    // holds the switch's *position* against an injected store that rejects, and
    // `preferences.test.ts` keeps the store resolving over hostile storage.
    // Neither of them can say whether the flip **took effect**, and nothing
    // anywhere said that **nothing is shown** for the failure — the page does
    // have an error surface, the groove's own banner and retry, and a
    // preference that could not be stored must never raise it. Both were true
    // of the code by construction, which is exactly the kind of thing a later
    // edit removes without failing anything.
    //
    // The failing store here is the real one over refusing storage — quota, a
    // disabled store, a private window, which is what R8 names — because that
    // is the only way a write failure is reachable through `index.ts`:
    // `GroovePuzzle` takes no store, so injecting one would mean mocking a
    // module path, and the whole point of this file is that it does not.
    it('still silences the taps, and says nothing, when the write fails (R8, AC8)', async () => {
      const refused = vi
        .spyOn(localStorage, 'setItem')
        .mockImplementation(() => {
          throw new DOMException('exceeded the quota', 'QuotaExceededError')
        })
      const complained = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        const user = userEvent.setup()
        await renderPuzzle()

        await turnSoundsOff(user)
        await settle()

        // The write really was attempted and really did fail...
        expect(refused).toHaveBeenCalled()
        // ...and the switch still moved, and stayed where the player put it.
        expect(soundSwitch()).toHaveAttribute('aria-checked', 'false')

        // It also took effect. This is the clause that matters most: a switch
        // that reads off while the taps keep sounding is the worst version of
        // this bug, and it is the one the hook seam cannot see.
        await tapRoot(user, 'E♭')
        await settle()
        expect(fetchedNotes()).toEqual([])
        expect(fake.sources).toHaveLength(0)
        expect(
          within(rootGroup()).getByRole('button', { name: 'E♭' }),
        ).toHaveAttribute('aria-pressed', 'true')
        // The mode row too — one gate, both rows.
        const mode = flavours()[0]
        await user.click(
          within(flavourGroup()).getByRole('button', { name: mode }),
        )
        await settle()
        expect(fetchedNotes()).toEqual([])
        expect(fake.sources).toHaveLength(0)
        // And the rest of the page agrees with the switch, so the position is
        // not merely being reported back in the one place it was set.
        expect(screen.getByText(CAPTION_SOUNDS_OFF)).toBeInTheDocument()
        expect(marked().every((glyph) => glyph === null)).toBe(true)

        // Nothing is shown for the failure: no banner, no retry, no message
        // anywhere on the page, and no console-visible break.
        expect(screen.queryByRole('alert')).toBeNull()
        expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
        expect(screen.queryByText(/quota|storage|could not|failed/i)).toBeNull()
        expect(complained).not.toHaveBeenCalled()
      } finally {
        complained.mockRestore()
        refused.mockRestore()
      }
    })

    // Step E10 — R5a, AC11b. It is a durable setting rather than a record of
    // how the day was played, and this card is the only place it can be
    // changed — so it does not settle when the mode toggle above it does.
    it.each([
      ['solved', { solved: true, attempts: [SOLVING] }],
      ['revealed', { solved: false, revealed: true, attempts: [] }],
    ])('still switches on a %s day, and stores it (E10, R5a, AC11b)', async (_name, ending) => {
      const stored: DailyResult = {
        date: TODAY(),
        answer: { root: 'C', flavour: 'Aeolian' },
        ...ending,
      }
      mockStore.get.mockResolvedValue(stored)
      mockStore.getAll.mockResolvedValue([stored])

      const user = userEvent.setup()
      await renderPuzzle()

      expect(modeSwitch()).toBeDisabled()
      expect(soundSwitch()).toBeEnabled()

      await turnSoundsOff(user)
      await settle()

      expect(soundSwitch()).toHaveAttribute('aria-checked', 'false')
      expect(await createLocalPreferenceStore().get()).toEqual({
        simpleMode: false,
        tapSounds: false,
      })
    })

    // Step E11 — R11. Twelve prefetched files for a row that has been switched
    // off is the same fetch R11 forbids, only earlier. The `warmed` ref is what
    // makes the second half true: the effect re-runs when the flag changes.
    it('warms nothing for a row that has been switched off (E11, R11)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await turnSoundsOff(user)
      await play(user)
      await settle()

      // The groove's own file is the only thing that was asked for.
      expect(fetchedNotes()).toEqual([])
      expect(fetchedUrls()).toEqual([GROOVE.audioSrc])

      await user.click(soundSwitch())

      await waitFor(() => expect(fetchedNotes()).toHaveLength(WARMED))
    })
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
