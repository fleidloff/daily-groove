import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DailyResult, Flavour, Groove, Root } from '../types'
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

const { mockStore } = await vi.hoisted(async () => {
  const { createMockStore } = await import('../testing/puzzleHarness')
  return { mockStore: createMockStore() }
})
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

let fake: FakeContext

describe('GroovePuzzle', () => {
  beforeEach(() => {
    resetMockStore(mockStore)
    ;({ fake } = installPuzzleAudio())
  })

  afterEach(() => {
    teardownPuzzleAudio()
  })

  const solutionPanel = () =>
    screen
      .getByRole('heading', { name: 'C Aeolian' })
      .closest('[role="status"]') as HTMLElement

  const DORIAN: Groove = { ...GROOVE, flavour: 'Dorian', scale: 'C Dorian' }

  const MIXOLYDIAN: Groove = {
    ...GROOVE,
    flavour: 'Mixolydian',
    scale: 'C Mixolydian',
  }

  async function enableSimpleMode() {
    await createLocalPreferenceStore().update({ simpleMode: true })
  }

  const simpleRoots = () => simpleRootOptions(new Date(), answerOf(DORIAN))

  const chipTexts = (group: HTMLElement) =>
    within(group).getAllByRole('button').map(chipLabel)

  it('shows an error with retry when playback rejects, the card stays (R7)', async () => {
    fake.failNextDecode()
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('button', { name: /^play the loop$/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(rootGroup()).toBeInTheDocument()
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
    expect(fake.contexts).toHaveLength(1)
    expect(fake.sources).toHaveLength(1)
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

    await play(user)
    expect(fake.sources).toHaveLength(1)
    expect(fake.sources[0].start).toHaveBeenCalledTimes(1)
    expect(fake.sources[0].loop).toBe(true)

    await advance(loopFraction(0.5))
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50',
    )

    await user.click(screen.getByRole('button', { name: 'Stop the loop' }))
    expect(fake.sources[0].stop).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    expect(
      await screen.findByRole('button', { name: 'Play the loop' }),
    ).toBeInTheDocument()

    await play(user)
    expect(fake.sources).toHaveLength(2)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    expect(fake.contexts).toHaveLength(1)
    const grooveFetches = vi
      .mocked(fetch)
      .mock.calls.filter((call) => String(call[0]) === GROOVE.audioSrc)
    expect(grooveFetches).toHaveLength(1)
    expect(fake.decodeCalls).toBe(fake.fetchCalls)
  })

  it('returns the progress track to the start on stop (E2 R6a, AC5a, AC6)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    expect(screen.getByTestId('progress-fill')).toHaveAttribute('width', '0%')

    await play(user)
    await advance(loopFraction(0.5))

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50',
    )
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '2',
    )

    await user.click(screen.getByRole('button', { name: 'Stop the loop' }))

    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    expect(screen.queryByTestId('progress-active')).not.toBeInTheDocument()
    expect(screen.getByTestId('progress-fill')).toHaveAttribute('width', '0%')

    await advance(loopFraction(0.25))
    expect(screen.getByTestId('progress-fill')).toHaveAttribute('width', '0%')
  })

  it('reads "■ Stop" while the groove sounds (E2 R4a, AC3a)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('button', { name: 'Play the loop' }))

    const control = await screen.findByRole('button', { name: 'Stop the loop' })
    expect(control).toHaveTextContent('■ Stop')
  })

  it('stacks the caption below the control rather than beside it (E2 R4, AC3)', async () => {
    await renderPuzzle()

    const play = screen.getByRole('button', { name: 'Play the loop' })
    expect(play).toHaveTextContent('▶ Play the groove')
    expect(play).toHaveClass('w-full')

    const region = play.parentElement as HTMLElement
    expect(region).toHaveClass('flex-col')
    expect(region).not.toHaveClass('flex-row')
    expect(play.nextElementSibling).toHaveTextContent(CAPTION)
  })

  it("moves the bar highlight with the player's position (D5, AC8, AC2, AC3)", async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await play(user)
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '0',
    )

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

  it('renders the groove card header, the tempo, the day and the transport (E1 R5, AC5)', async () => {
    await renderPuzzle()
    expect(
      screen.getByRole('heading', { name: GROOVE.name }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(`^${GROOVE.bpm} bpm · `)),
    ).toBeInTheDocument()
    expect(screen.getAllByText(new RegExp(dateLine(new Date())))).toHaveLength(1)
    expect(screen.queryByText('BPM')).not.toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: GROOVE.name }),
    ).not.toHaveTextContent('bpm')
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  const nameOf = (el: HTMLElement) => el.getAttribute('aria-label')

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

    expect(fetch).toHaveBeenCalledWith(GROOVE.audioSrc)
    expect(fake.sources).toHaveLength(1)
    expect(fake.sources[0].loop).toBe(true)
    expect(nameOf(todayControl())).toBe('Stop the loop')

    await user.click(todayControl())
    expect(fake.sources[0].stop).toHaveBeenCalledTimes(1)
    expect(fake.contexts).toHaveLength(1)
    expect(soundingControls()).toEqual([])
  })

  it('shows an inert loading control until the first sound (E2 R7a, AC8b, AC8c)', async () => {
    fake.deferNextDecode()
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('button', { name: 'Play the loop' }))

    const busy = await screen.findByRole('button', { name: 'Loading…' })
    expect(busy).toBeDisabled()
    expect(busy).toHaveTextContent('Loading…')
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
    expect(source.start).toHaveBeenCalledWith(0, 0.05)
  })

  const noteSrc = (root: Root) =>
    (NOTES.find((note) => note.root === root) as { audioSrc: string }).audioSrc

  const fetchedUrls = () =>
    (globalThis.fetch as unknown as Mock).mock.calls.map(([url]) => String(url))

  const fetchedNotes = () =>
    fetchedUrls().filter((url) => url.startsWith('/notes/'))

  const soundedNotes = async (count: number) => {
    await waitFor(() => expect(fake.sources).toHaveLength(count))
    return fake.sources
  }

  const BEAT = beatSeconds(GROOVE.bpm)

  const OFF_BEAT = BEAT * 0.25

  const startedAt = (node: (typeof fake.sources)[number]) =>
    (node.start.mock.calls[0] as [number])[0]

  const progressReads = () =>
    screen.getByRole('progressbar').getAttribute('aria-valuenow')

  it('selects the tapped root and sounds its note (D2, R1, R2, R3, AC1)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(within(rootGroup()).getByRole('button', { name: 'E♭' }))

    expect(
      within(rootGroup()).getByRole('button', { name: 'E♭' }),
    ).toHaveAttribute('aria-pressed', 'true')

    const [note] = await soundedNotes(1)
    expect(fetchedNotes()).toEqual([noteSrc('E♭')])
    expect(note.loop).toBe(false)
    expect(note.start).toHaveBeenCalledTimes(1)
  })

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
    expect(fetchedNotes()).toEqual([noteSrc('E♭')])
  })

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

  it('selects at once and sounds on the next beat (F16 E3 R6, R13, AC4, AC11)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await play(user)
    await advance(OFF_BEAT)
    const tappedAt = fake.currentTime

    await user.click(within(rootGroup()).getByRole('button', { name: 'A' }))

    expect(
      within(rootGroup()).getByRole('button', { name: 'A' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(fake.currentTime).toBe(tappedAt)

    const [, note] = await soundedNotes(2)
    expect(startedAt(note)).toBeCloseTo(tappedAt + BEAT * 0.75, 9)
    expect(startedAt(note)).toBeGreaterThan(tappedAt)
  })

  it('sounds without waiting while the loop is stopped (F16 E3 R7, AC5)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await advance(2)
    await user.click(within(rootGroup()).getByRole('button', { name: 'A' }))

    const [first] = await soundedNotes(1)
    expect(startedAt(first)).toBe(2)

    await play(user)
    await user.click(screen.getByRole('button', { name: 'Stop the loop' }))
    await advance(0.3)
    const tappedAt = fake.currentTime

    await user.click(within(rootGroup()).getByRole('button', { name: 'B' }))
    await waitFor(() => expect(fake.sources).toHaveLength(3))

    expect(startedAt(fake.sources[2])).toBe(tappedAt)
  })

  it('leaves the groove untouched, and the groove leaves the note alone (D7, R6, R13, AC5, AC11)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await play(user)
    await advance(loopFraction(0.5) + OFF_BEAT)
    const groove = fake.sources[0]
    const at = progressReads()

    await user.click(within(rootGroup()).getByRole('button', { name: 'A' }))
    const [, note] = await soundedNotes(2)

    expect(groove.stop).not.toHaveBeenCalled()
    expect(progressReads()).toBe(at)
    expect(
      screen.getByRole('button', { name: 'Stop the loop' }),
    ).toBeInTheDocument()
    expect(fake.contexts).toHaveLength(1)

    await advance(BEAT)
    expect(fake.currentTime).toBeGreaterThan(startedAt(note))

    await user.click(screen.getByRole('button', { name: 'Stop the loop' }))
    expect(groove.stop).toHaveBeenCalledTimes(1)
    expect(note.stop).not.toHaveBeenCalled()
  })

  it('drops a note the stopped groove never reaches (F16 E3 R12, AC10)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await play(user)
    await advance(loopFraction(0.5) + OFF_BEAT)

    await user.click(within(rootGroup()).getByRole('button', { name: 'A' }))
    const [, note] = await soundedNotes(2)

    const when = startedAt(note)
    expect(when).toBeGreaterThan(fake.currentTime)

    await user.click(screen.getByRole('button', { name: 'Stop the loop' }))

    expect(note.stop).toHaveBeenCalled()
    expect((note.stop.mock.calls[0] as [number])[0]).toBeLessThan(when)
    expect(fake.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      expect.any(Number),
    )
  })

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

    expect(groove.stop).not.toHaveBeenCalled()
    expect(groove.start).toHaveBeenCalledTimes(1)
    expect(progressReads()).toBe(at)
    expect(
      screen.getByRole('button', { name: 'Stop the loop' }),
    ).toBeInTheDocument()
  })

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

  describe('the mode row sounds a lick (F16 E1)', () => {
    const POOL = flavourPool(GROOVES)

    const pitchSrc = (midi: number) =>
      (PITCHES.find((pitch) => pitch.midi === midi) as PitchSample).audioSrc

    const phraseFiles = (notes: ScheduledNote[]) => {
      const wanted: string[] = []
      for (const note of notes) {
        const src = pitchSrc(note.midi)
        if (!wanted.includes(src)) wanted.push(src)
      }
      return wanted
    }

    const round = (seconds: number) => Math.round(seconds * 1e9) / 1e9

    const stoppedAt = (node: FakeSourceNode) =>
      (node.stop.mock.calls[0] as [number])[0]

    const soundedPhrase = (nodes: FakeSourceNode[]) => {
      const origin = startedAt(nodes[0])
      return nodes.map((node) => ({
        offsetSeconds: round(startedAt(node) - origin),
        durationSeconds: round(
          stoppedAt(node) - startedAt(node) - REFERENCE_FADE_SECONDS,
        ),
      }))
    }

    const phraseShape = (notes: ScheduledNote[]) =>
      notes.map((note) => ({
        offsetSeconds: round(note.offsetSeconds),
        durationSeconds: round(note.durationSeconds),
      }))

    const soundedLick = async (from: number, count: number) => {
      await waitFor(() => expect(fake.sources).toHaveLength(from + count))
      return fake.sources.slice(from)
    }

    const tapMode = (
      user: ReturnType<typeof userEvent.setup>,
      name: string,
    ) => user.click(within(flavourGroup()).getByRole('button', { name }))

    const cardText = () =>
      screen.getByRole('heading', { name: 'What is it?' })
        .parentElement as HTMLElement

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
      for (const node of nodes) {
        expect(node.loop).toBe(false)
        expect(node.start).toHaveBeenCalledTimes(1)
      }
      expect(fetchedNotes()).toEqual(phraseFiles(phrase))
      expect(soundedPhrase(nodes)).toEqual(phraseShape(phrase))
      expect(
        within(flavourGroup()).getByRole('button', { name: mode }),
      ).toHaveAttribute('aria-pressed', 'true')
    })

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
      expect(fetchedNotes()).toEqual(phraseFiles(phrase))
    })

    it('sounds two real modes from simple mode’s two chips (H2, R15, R16, R17, R18, AC11, AC13)', async () => {
      await enableSimpleMode()
      const user = userEvent.setup()
      await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

      expect(chipTexts(flavourGroup())).toEqual(FAMILIES)

      const day = answerOf(DORIAN)
      const own = familyOf(day.flavour)
      const other = FAMILIES.find((family) => family !== own) as Family

      const dayPhrase = scheduleLick({
        flavour: day.flavour,
        root: day.root,
        bpm: DORIAN.bpm,
      })
      await tapMode(user, own)
      expect(soundedPhrase(await soundedLick(0, dayPhrase.length))).toEqual(
        phraseShape(dayPhrase),
      )

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

      expect(chipTexts(flavourGroup())).toEqual(FAMILIES)
      for (const mode of POOL) {
        expect(cardText()).not.toHaveTextContent(mode)
      }
    })

    it('plays the day’s own mode from Major on a Major day (H2, R15, R16, AC11)', async () => {
      await enableSimpleMode()
      const user = userEvent.setup()
      await renderPuzzle(<GroovePuzzle groove={MIXOLYDIAN} />)

      const day = answerOf(MIXOLYDIAN)
      expect(familyOf(day.flavour)).toBe('Major')
      expect(chipTexts(flavourGroup())).toEqual(FAMILIES)

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
      expect(fetchedNotes()).toEqual(phraseFiles(dayPhrase))

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
      expect(fetchedNotes()).toEqual(
        expect.arrayContaining(phraseFiles(otherPhrase)),
      )
      expect(phraseShape(otherPhrase)).not.toEqual(phraseShape(dayPhrase))
    })

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

      expect(startedAt(nodes[0])).toBeCloseTo(tappedAt + BEAT * 0.75, 9)
      expect(startedAt(nodes[0])).toBeGreaterThan(tappedAt)
      expect(soundedPhrase(nodes)).toEqual(phraseShape(phrase))

      expect(groove.stop).not.toHaveBeenCalled()
      expect(groove.start).toHaveBeenCalledTimes(1)
      expect(progressReads()).toBe(at)
      expect(
        screen.getByRole('button', { name: 'Stop the loop' }),
      ).toBeInTheDocument()
      expect(fake.contexts).toHaveLength(1)
    })

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

      for (const node of nodes) {
        expect(node.stop).toHaveBeenCalledTimes(1)
        expect(stoppedAt(node)).toBeGreaterThan(startedAt(node))
      }
    })

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

      for (const node of firstNodes) {
        expect(node.stop.mock.calls.length).toBeGreaterThan(1)
      }
      for (const node of secondNodes) {
        expect(node.stop).toHaveBeenCalledTimes(1)
      }
      expect(referenceOutput().isClaimed()).toBe(true)
    })

    it('silences a ringing root note when a mode is tapped (H4, R8a, AC6a)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await user.click(within(rootGroup()).getByRole('button', { name: 'A' }))
      await waitFor(() => expect(fake.sources).toHaveLength(1))
      const note = fake.sources[0]
      expect(note.stop).not.toHaveBeenCalled()

      const mode = flavours()[0]
      const phrase = scheduleLick({
        flavour: mode,
        root: GROOVE.root,
        bpm: GROOVE.bpm,
      })
      await tapMode(user, mode)
      await soundedLick(1, phrase.length)

      expect(fake.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(
        0,
        expect.any(Number),
      )
      expect(note.stop).toHaveBeenCalledTimes(1)
      expect(referenceOutput().isClaimed()).toBe(true)
    })

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
        expect((node.stop.mock.calls[1] as [number])[0]).toBeLessThan(
          startedAt(node),
        )
      }
      expect(referenceOutput().isClaimed()).toBe(true)
    })

    it('offers both rows in one sentence, and names no mode (H5, R25)', async () => {
      await renderPuzzle()

      const text = screen.getByText(CAPTION).textContent as string
      expect(text).toContain('a root')
      expect(text).toContain('a mode')
      expect(text).not.toContain('\n')
      expect(text.split('—')).toHaveLength(2)
      for (const mode of POOL) expect(text).not.toContain(mode)
    })

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

    it('warms the pitches once the groove has decoded, never before (H7, R33)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      expect(fake.fetchCalls).toBe(0)

      await play(user)
      await waitFor(() =>
        expect(fetchedNotes()).toHaveLength(NOTES.length + PITCHES.length),
      )

      const urls = fetchedUrls()
      expect(urls[0]).toBe(GROOVE.audioSrc)
      expect(urls.indexOf(GROOVE.audioSrc)).toBeLessThan(
        urls.findIndex((url) => url.startsWith('/notes/')),
      )
      expect(fake.sources).toHaveLength(1)
    })
  })

  const allNoteSrcs = () => NOTES.map((note) => note.audioSrc)

  const WARMED = NOTES.length + PITCHES.length

  it('warms the whole row once the groove has decoded, never before (I2, R18, R19)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    expect(fetchedUrls()).toEqual([])

    await play(user)
    await waitFor(() => expect(fetchedNotes()).toHaveLength(WARMED))

    const urls = fetchedUrls()
    expect(urls[0]).toBe(GROOVE.audioSrc)
    expect(urls.indexOf(GROOVE.audioSrc)).toBeLessThan(
      urls.findIndex((url) => url.startsWith('/notes/')),
    )
    for (const src of allNoteSrcs()) expect(fetchedNotes()).toContain(src)
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

    expect(fetchedNotes()).toHaveLength(WARMED)
  })

  it('sounds a tap that lands before any warm (I2, R19a, AC21)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(within(rootGroup()).getByRole('button', { name: 'B' }))

    const [note] = await soundedNotes(1)
    expect(note.start).toHaveBeenCalledTimes(1)
    expect(fetchedNotes()).toEqual([noteSrc('B')])
  })

  it('reads the new caption under the play control (E2 R1a, R5, AC6)', async () => {
    await renderPuzzle()

    expect(screen.getByText(CAPTION)).toBeInTheDocument()
    expect(
      screen.queryByText('Play along. Find the note that feels like home.'),
    ).toBeNull()
  })

  it('keeps the caption below the control at full width (E2 R1a, AC6a)', async () => {
    await renderPuzzle()

    const play = screen.getByRole('button', { name: 'Play the loop' })
    const caption = screen.getByText(CAPTION)

    expect(play.nextElementSibling).toBe(caption)
    expect(caption.parentElement).toBe(play.parentElement)
    expect(play.parentElement).toHaveClass('flex-col')
    expect(play.parentElement).not.toHaveClass('flex-row')
    expect(caption.className).toMatch(/text-text-muted/)
    expect(caption.className).toMatch(/text-\[13px\]/)
  })

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

    first.unmount()
    await renderFeature()

    const after = marked()
    expect(after).toHaveLength(12)
    expect(after.every((glyph) => glyph === NOTE_GLYPH)).toBe(true)

    const written = Array.from(
      { length: localStorage.length },
      (_, i) => localStorage.key(i) as string,
    )
    const allowed = ['daily-groove:v2:results', 'daily-groove:v1:prefs']
    expect(written.filter((key) => !allowed.includes(key))).toEqual([])
  })

  describe('the tap sounds can be switched off (F16 E2)', () => {
    const soundSwitch = () => screen.getByRole('switch', { name: /tap sounds/i })
    const modeSwitch = () => screen.getByRole('switch', { name: /simple mode/i })

    const turnSoundsOff = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(soundSwitch())
    }

    const precedes = (a: Element, b: Element) =>
      Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

    const marked = () =>
      within(rootGroup())
        .getAllByRole('button')
        .map((chip) => chipAdornment(chip))

    const rootNames = () =>
      within(rootGroup())
        .getAllByRole('button')
        .map((chip) => chipLabel(chip))

    const tapRoot = (
      user: ReturnType<typeof userEvent.setup>,
      root: string,
    ) => user.click(within(rootGroup()).getByRole('button', { name: root }))

    it('offers the switch below the mode switch, on by default (E1, R1, R2, AC1, AC2)', async () => {
      await renderPuzzle()

      expect(soundSwitch()).toBeInTheDocument()
      expect(soundSwitch()).toHaveAttribute('aria-checked', 'true')
      expect(precedes(modeSwitch(), soundSwitch())).toBe(true)
      expect(precedes(soundSwitch(), rootGroup())).toBe(true)
    })

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

      const mode = flavours()[0]
      await user.click(within(flavourGroup()).getByRole('button', { name: mode }))

      expect(fetchedNotes()).toEqual([])
      expect(fake.sources).toHaveLength(0)
      expect(
        within(flavourGroup()).getByRole('button', { name: mode }),
      ).toHaveAttribute('aria-pressed', 'true')
    })

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
      expect(fake.contexts.length).toBeLessThanOrEqual(1)
    })

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
      expect(CAPTION_SOUNDS_OFF).not.toContain('\n')

      await user.click(soundSwitch())

      expect(screen.getByText(CAPTION)).toBeInTheDocument()
      expect(screen.queryByText(CAPTION_SOUNDS_OFF)).toBeNull()
    })

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

      const written = Array.from(
        { length: localStorage.length },
        (_, i) => localStorage.key(i) as string,
      )
      const allowed = ['daily-groove:v2:results', 'daily-groove:v1:prefs']
      expect(written.filter((key) => !allowed.includes(key))).toEqual([])
    })

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

      const root = rootNames()[0]
      await tapRoot(user, root)
      await soundedNotes(1)
    })

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

        expect(refused).toHaveBeenCalled()
        expect(soundSwitch()).toHaveAttribute('aria-checked', 'false')

        await tapRoot(user, 'E♭')
        await settle()
        expect(fetchedNotes()).toEqual([])
        expect(fake.sources).toHaveLength(0)
        expect(
          within(rootGroup()).getByRole('button', { name: 'E♭' }),
        ).toHaveAttribute('aria-pressed', 'true')
        const mode = flavours()[0]
        await user.click(
          within(flavourGroup()).getByRole('button', { name: mode }),
        )
        await settle()
        expect(fetchedNotes()).toEqual([])
        expect(fake.sources).toHaveLength(0)
        expect(screen.getByText(CAPTION_SOUNDS_OFF)).toBeInTheDocument()
        expect(marked().every((glyph) => glyph === null)).toBe(true)

        expect(screen.queryByRole('alert')).toBeNull()
        expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
        expect(screen.queryByText(/quota|storage|could not|failed/i)).toBeNull()
        expect(complained).not.toHaveBeenCalled()
      } finally {
        complained.mockRestore()
        refused.mockRestore()
      }
    })

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

    it('warms nothing for a row that has been switched off (E11, R11)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await turnSoundsOff(user)
      await play(user)
      await settle()

      expect(fetchedNotes()).toEqual([])
      expect(fetchedUrls()).toEqual([GROOVE.audioSrc])

      await user.click(soundSwitch())

      await waitFor(() => expect(fetchedNotes()).toHaveLength(WARMED))
    })
  })

  const BAR_CHORDS = barChords(GROOVE.progression)

  const trackChords = () => {
    const row = screen.queryByTestId('chord-row')
    return row === null
      ? null
      : Array.from(row.querySelectorAll('[data-bar]')).map((cell) => cell.textContent)
  }

  it('prints no chord over the bars while the day is still on (E3 R2, AC2)', async () => {
    const user = userEvent.setup()
    const { container } = await renderPuzzle()

    expect(trackChords()).toBeNull()

    await guess(user, 'C', wrongFlavour())
    await guess(user, 'G', wrongFlavour())
    expect(trackChords()).toBeNull()

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
    expect(screen.getByTestId('chord-row').nextElementSibling).toBe(
      screen.getByRole('progressbar'),
    )
  })

  it('names the answer beside the tempo only once the day is over', async () => {
    const user = userEvent.setup()
    const { container } = await renderPuzzle()

    expect(container.textContent).not.toContain('C Aeolian')
    await guess(user, 'C', wrongFlavour())
    expect(container.textContent).not.toContain('C Aeolian')

    await guess(user, 'C', 'Aeolian')

    expect(
      screen.getByText(
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

    expect(trackChords()).toEqual(sheetBars)
    expect(trackChords()).toEqual(CHANGES_READ.split(' · '))
  })

  describe('the framing on a shared groove (F12 E3)', () => {
    const renderShared = (groove: Groove = GROOVE) =>
      renderPuzzle(<GroovePuzzle groove={groove} mode="shared" />)

    const notice = () => screen.queryByText(/this is a shared groove/i)

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
