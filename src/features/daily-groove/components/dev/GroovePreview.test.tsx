import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Groove } from '../../types'
import { isoDate, nextDayStart, parseIsoDate } from '@/lib/date'
import { scheduleLick, type ScheduledNote } from '@/lib/theory/phrase'
import { beatSeconds } from '../../lib/audio/beat'
import { releaseAudioContext } from '../../lib/audio/context'
import { GROOVES } from '../../data/grooves.generated'
import { PITCHES, type PitchSample } from '../../data/notes.generated'
import { selectGrooveForDate } from '../../lib/puzzle/selectGroove'
import {
  installFakeAudioContext,
  type FakeContext,
  type FakeSourceNode,
} from '../../testing/fakeAudioContext'
import { GroovePreview } from './GroovePreview'

const TODAY = new Date(2026, 0, 15)
const CAP = 2 * GROOVES.length

const PLAY = 'Play groove'
const STOP = 'Stop groove'
const LICK_LABELS = ['Lick 1', 'Lick 2', 'Lick 3'] as const

// Longer than the longest loop in the catalogue, so deriveLoopWindow never
// clips a groove short of its own loop.
const BUFFER_SECONDS = 120

const grooveOn = (iso: string): Groove =>
  selectGrooveForDate(parseIsoDate(iso), GROOVES)

function daysFrom(start: Date, count: number): string[] {
  const out: string[] = []
  let date = start
  for (let index = 0; index < count; index += 1) {
    out.push(isoDate(date))
    date = nextDayStart(date)
  }
  return out
}

// The list runs until every groove has appeared, so it is at least as long as
// the catalogue: any day inside this span is on the page whatever the data does.
const CERTAIN_DAYS = daysFrom(TODAY, GROOVES.length)

const FIRST_ISO = CERTAIN_DAYS[0]
const FIRST = grooveOn(FIRST_ISO)

const OTHER_ISO = CERTAIN_DAYS.find(
  (iso) => grooveOn(iso).audioSrc !== FIRST.audioSrc,
) as string
const OTHER = grooveOn(OTHER_ISO)

let fake: FakeContext

const text = (element: Element) => (element.textContent ?? '').trim()

const rows = () =>
  screen
    .getAllByRole('button')
    .filter((button) => /^\d{4}-\d{2}-\d{2}/.test(text(button)))

const rowIso = (row: Element) => text(row).slice(0, 10)

function rowFor(iso: string): HTMLElement {
  const found = rows().find((row) => rowIso(row) === iso)
  if (found === undefined) throw new Error(`no row for ${iso}`)
  return found
}

const fetchedUrls = () =>
  (globalThis.fetch as unknown as Mock).mock.calls.map(([url]) => String(url))

const fetchedGrooves = () =>
  fetchedUrls().filter((url) => url.startsWith('/grooves/'))

const fetchedNotes = () => fetchedUrls().filter((url) => url.startsWith('/notes/'))

const pitchSrc = (midi: number) =>
  (PITCHES.find((pitch) => pitch.midi === midi) as PitchSample).audioSrc

const phraseFiles = (notes: ScheduledNote[]) => notes.map((note) => pitchSrc(note.midi))

const round = (seconds: number) => Math.round(seconds * 1e9) / 1e9

const startedAt = (node: FakeSourceNode) => (node.start.mock.calls[0] as [number])[0]

const stoppedAt = (node: FakeSourceNode) => (node.stop.mock.calls[0] as [number])[0]

async function settle() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function renderPreview(today: Date = TODAY) {
  const result = render(<GroovePreview today={today} />)
  await settle()
  return result
}

async function play(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: PLAY }))
  await screen.findByRole('button', { name: STOP })
}

async function soundedFrom(from: number, count: number) {
  await waitFor(() => expect(fake.sources).toHaveLength(from + count))
  return fake.sources.slice(from)
}

describe('GroovePreview', () => {
  beforeEach(() => {
    fake = installFakeAudioContext({ bufferSeconds: BUFFER_SECONDS })
  })

  afterEach(async () => {
    await releaseAudioContext()
    vi.unstubAllGlobals()
  })

  describe('the schedule it lists (D2)', () => {
    it('starts at today and runs one row per day with no gaps', async () => {
      await renderPreview()

      const listed = rows().map(rowIso)
      expect(listed.length).toBeGreaterThan(0)

      let date = TODAY
      for (const iso of listed) {
        expect(iso).toBe(isoDate(date))
        date = nextDayStart(date)
      }
    })

    it('lists every groove in the catalogue at least once', async () => {
      await renderPreview()

      const covered = new Set(rows().map((row) => grooveOn(rowIso(row)).uuid))
      expect(covered.size).toBe(GROOVES.length)

      const listed = rows().map(text)
      for (const groove of GROOVES) {
        expect(
          listed.some((row) => row.includes(groove.name)),
          groove.id,
        ).toBe(true)
      }
    })

    it('stops inside twice the catalogue', async () => {
      await renderPreview()

      expect(rows().length).toBeGreaterThanOrEqual(GROOVES.length)
      expect(rows().length).toBeLessThanOrEqual(CAP)
    })

    it('shows the day’s groove and what it is made of on every row', async () => {
      await renderPreview()

      for (const row of rows()) {
        const groove = grooveOn(rowIso(row))
        const reading = text(row)
        for (const part of [
          groove.name,
          groove.scale,
          groove.chord,
          groove.progression,
          String(groove.bpm),
        ]) {
          expect(reading, `${rowIso(row)} · ${part}`).toContain(part)
        }
      }
    })
  })

  describe('picking a groove and playing it (D3)', () => {
    it('sounds the groove of the row that was picked', async () => {
      const user = userEvent.setup()
      await renderPreview()

      await user.click(rowFor(FIRST_ISO))
      expect(rowFor(FIRST_ISO)).toHaveAttribute('aria-pressed', 'true')

      await play(user)

      const [node] = await soundedFrom(0, 1)
      expect(fetchedGrooves()).toEqual([FIRST.audioSrc])
      expect(node.start).toHaveBeenCalledTimes(1)
      expect(node.loop).toBe(true)
    })

    it('sounds the second groove when another row is picked', async () => {
      const user = userEvent.setup()
      expect(OTHER.audioSrc).not.toBe(FIRST.audioSrc)
      await renderPreview()

      await user.click(rowFor(FIRST_ISO))
      await play(user)
      const before = (await soundedFrom(0, 1)).length

      await user.click(rowFor(OTHER_ISO))
      expect(rowFor(OTHER_ISO)).toHaveAttribute('aria-pressed', 'true')
      expect(rowFor(FIRST_ISO)).toHaveAttribute('aria-pressed', 'false')

      await play(user)

      const [node] = await soundedFrom(before, 1)
      expect(fetchedGrooves()).toEqual([FIRST.audioSrc, OTHER.audioSrc])
      expect(node.start).toHaveBeenCalledTimes(1)
    })
  })

  describe('the three lick variations over the running groove (D4)', () => {
    it('sounds each variation of the groove’s own mode, on the beat', async () => {
      const user = userEvent.setup()
      const groove = FIRST
      const beat = beatSeconds(groove.bpm)

      const phrases = [0, 1, 2].map((variation) =>
        scheduleLick({
          flavour: groove.flavour,
          root: groove.root,
          bpm: groove.bpm,
          variation,
        }),
      )
      phrases.forEach((phrase, variation) => {
        expect(phrase.length, `variation ${variation}`).toBeGreaterThan(0)
      })
      expect(new Set(phrases.map((phrase) => JSON.stringify(phrase))).size).toBe(3)

      await renderPreview()
      await user.click(rowFor(FIRST_ISO))
      await play(user)
      await soundedFrom(0, 1)

      const fades: number[] = []
      let before = fake.sources.length

      for (const [variation, label] of LICK_LABELS.entries()) {
        // A quarter of a beat past a beat line, every time: the phrase is four
        // beats long, so a whole beat between presses keeps the same phase.
        fake.advance(variation === 0 ? beat * 0.25 : beat)
        const tappedAt = fake.currentTime

        await user.click(screen.getByRole('button', { name: label }))

        const phrase = phrases[variation]
        const nodes = await soundedFrom(before, phrase.length)
        const origin = startedAt(nodes[0])

        expect(origin, label).toBeCloseTo(tappedAt + beat * 0.75, 9)
        expect(origin, label).toBeGreaterThan(tappedAt)
        expect(
          nodes.map((node) => round(startedAt(node) - origin)),
          label,
        ).toEqual(phrase.map((note) => round(note.offsetSeconds)))

        nodes.forEach((node, index) => {
          fades.push(
            round(stoppedAt(node) - startedAt(node) - phrase[index].durationSeconds),
          )
        })

        for (const file of phraseFiles(phrase)) {
          expect(fetchedNotes(), `${label} · ${file}`).toContain(file)
        }

        before += phrase.length
      }

      expect(new Set(fades).size).toBe(1)
      expect(fades[0]).toBeGreaterThanOrEqual(0)
    })

    it('leaves the groove running while the licks sound', async () => {
      const user = userEvent.setup()
      const beat = beatSeconds(FIRST.bpm)
      const phrase = scheduleLick({
        flavour: FIRST.flavour,
        root: FIRST.root,
        bpm: FIRST.bpm,
        variation: 1,
      })
      await renderPreview()

      await user.click(rowFor(FIRST_ISO))
      await play(user)
      const [groove] = await soundedFrom(0, 1)

      fake.advance(beat * 0.25)
      await user.click(screen.getByRole('button', { name: LICK_LABELS[1] }))
      await soundedFrom(1, phrase.length)

      expect(groove.stop).not.toHaveBeenCalled()
      expect(groove.start).toHaveBeenCalledTimes(1)
      expect(screen.getByRole('button', { name: STOP })).toBeInTheDocument()
      expect(fake.contexts).toHaveLength(1)
    })
  })
})
