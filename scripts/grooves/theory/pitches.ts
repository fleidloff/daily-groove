import type { MusicMeta, NoteEvent, VoiceName } from '../types.ts'
import type { Harmony } from './harmony.ts'
import { pitchesOf } from '../../../src/lib/theory/scales.ts'

export type PitchFailure = { voice: VoiceName; midi: number; timeSec: number }

const BEATS_PER_BAR = 4

const APPROACH_WINDOW = 1 / 8

const APPROACH_SLACK = 1 / 32

function isApproachNote(event: NoteEvent, midi: number, change: BarChange): boolean {
  return event.voice === 'bass' && semitoneDistance(midi, change.nextRootMidi) === 1
}

type BarChange = { bar: number; nextRootMidi: number }

export function offScalePitches(
  events: NoteEvent[],
  music: MusicMeta,
  harmony: Harmony,
): PitchFailure[] {
  const allowed = admittedPitchClasses(music, harmony)
  const barSec = (60 / music.bpm) * BEATS_PER_BAR
  const bars = Math.max(1, Math.round(music.loopBars))
  const loopSec = barSec * bars
  const changes = chordChanges(music, harmony, bars)

  const slackSec = barSec * APPROACH_SLACK
  const windowSec = barSec * APPROACH_WINDOW

  const claimed = new Set<number>()
  const failures: PitchFailure[] = []

  const ordered = [...events].sort((a, b) => a.timeSec - b.timeSec)

  for (const event of ordered) {
    if (event.midi === undefined) continue
    if (allowed.has(pitchClass(event.midi))) continue

    const change =
      event.timeSec < loopSec
        ? (changes.find(({ bar }) => {
            const barEnd = (bar + 1) * barSec
            return (
              event.timeSec >= barEnd - windowSec - slackSec &&
              event.timeSec < barEnd + slackSec
            )
          }) ?? null)
        : null

    if (change && !claimed.has(change.bar) && isApproachNote(event, event.midi, change)) {
      claimed.add(change.bar)
      continue
    }

    failures.push({ voice: event.voice, midi: event.midi, timeSec: event.timeSec })
  }

  return failures
}

function admittedPitchClasses(music: MusicMeta, harmony: Harmony): Set<number> {
  const allowed = new Set(pitchesOf(music.root, music.flavour))
  for (const chord of [harmony.chordMidi, ...harmony.progressionMidi]) {
    for (const midi of chord ?? []) allowed.add(pitchClass(midi))
  }
  return allowed
}

function chordChanges(music: MusicMeta, harmony: Harmony, bars: number): BarChange[] {
  const chords = harmony.progressionMidi
  if (chords.length === 0) return []
  const figure = music.bars > 0 ? Math.round(music.bars) : bars
  const chordIndex = (bar: number) => (((bar % figure) + figure) % figure) % chords.length

  const changes: BarChange[] = []
  for (let bar = 0; bar < bars; bar++) {
    const next = chordIndex(bar + 1)
    if (next === chordIndex(bar)) continue
    const nextRootMidi = chords[next][0]
    if (nextRootMidi === undefined) continue
    changes.push({ bar, nextRootMidi })
  }
  return changes
}

function semitoneDistance(a: number, b: number): number {
  const interval = pitchClass(Math.round(a) - Math.round(b))
  return Math.min(interval, 12 - interval)
}

function pitchClass(midi: number): number {
  return ((Math.round(midi) % 12) + 12) % 12
}
