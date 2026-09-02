/**
 * GENERATED FILE - DO NOT EDIT.
 *
 * Written by `npm run notes` (scripts/grooves/notes-manifest.ts) from the
 * sample pack. Any edit here is lost on the next render; change the generator
 * and re-render instead.
 */

import type { Root } from '@/lib/groove'

/** One reference note per chromatic root, rendered from the sample pack. */
export type ReferenceNote = {
  root: Root
  /** URL under /notes, e.g. "/notes/note-c-sharp.mp3" */
  audioSrc: string
  /** Sounding pitch, scientific: C4 is 60. */
  midi: number
}

export const NOTES: ReferenceNote[] = [
  {
    root: 'C',
    audioSrc: '/notes/note-c.mp3',
    midi: 60,
  },
  {
    root: 'C♯',
    audioSrc: '/notes/note-c-sharp.mp3',
    midi: 61,
  },
  {
    root: 'D',
    audioSrc: '/notes/note-d.mp3',
    midi: 62,
  },
  {
    root: 'E♭',
    audioSrc: '/notes/note-e-flat.mp3',
    midi: 63,
  },
  {
    root: 'E',
    audioSrc: '/notes/note-e.mp3',
    midi: 64,
  },
  {
    root: 'F',
    audioSrc: '/notes/note-f.mp3',
    midi: 65,
  },
  {
    root: 'F♯',
    audioSrc: '/notes/note-f-sharp.mp3',
    midi: 66,
  },
  {
    root: 'G',
    audioSrc: '/notes/note-g.mp3',
    midi: 67,
  },
  {
    root: 'A♭',
    audioSrc: '/notes/note-a-flat.mp3',
    midi: 68,
  },
  {
    root: 'A',
    audioSrc: '/notes/note-a.mp3',
    midi: 69,
  },
  {
    root: 'B♭',
    audioSrc: '/notes/note-b-flat.mp3',
    midi: 70,
  },
  {
    root: 'B',
    audioSrc: '/notes/note-b.mp3',
    midi: 71,
  },
]

/** Every pitch the render produces, C4 to B5. What a lick is sequenced from. */
export type PitchSample = {
  /** Scientific pitch, e.g. 'C4', 'C♯5'. Unique across the set. */
  id: string
  root: Root
  /** 4 or 5. */
  octave: number
  /** Sounding pitch, scientific: C4 is 60. 60..83. */
  midi: number
  /** URL under /notes, e.g. "/notes/note-c-sharp-5.mp3" */
  audioSrc: string
}

export const PITCHES: PitchSample[] = [
  {
    id: 'C4',
    root: 'C',
    octave: 4,
    midi: 60,
    audioSrc: '/notes/note-c.mp3',
  },
  {
    id: 'C♯4',
    root: 'C♯',
    octave: 4,
    midi: 61,
    audioSrc: '/notes/note-c-sharp.mp3',
  },
  {
    id: 'D4',
    root: 'D',
    octave: 4,
    midi: 62,
    audioSrc: '/notes/note-d.mp3',
  },
  {
    id: 'E♭4',
    root: 'E♭',
    octave: 4,
    midi: 63,
    audioSrc: '/notes/note-e-flat.mp3',
  },
  {
    id: 'E4',
    root: 'E',
    octave: 4,
    midi: 64,
    audioSrc: '/notes/note-e.mp3',
  },
  {
    id: 'F4',
    root: 'F',
    octave: 4,
    midi: 65,
    audioSrc: '/notes/note-f.mp3',
  },
  {
    id: 'F♯4',
    root: 'F♯',
    octave: 4,
    midi: 66,
    audioSrc: '/notes/note-f-sharp.mp3',
  },
  {
    id: 'G4',
    root: 'G',
    octave: 4,
    midi: 67,
    audioSrc: '/notes/note-g.mp3',
  },
  {
    id: 'A♭4',
    root: 'A♭',
    octave: 4,
    midi: 68,
    audioSrc: '/notes/note-a-flat.mp3',
  },
  {
    id: 'A4',
    root: 'A',
    octave: 4,
    midi: 69,
    audioSrc: '/notes/note-a.mp3',
  },
  {
    id: 'B♭4',
    root: 'B♭',
    octave: 4,
    midi: 70,
    audioSrc: '/notes/note-b-flat.mp3',
  },
  {
    id: 'B4',
    root: 'B',
    octave: 4,
    midi: 71,
    audioSrc: '/notes/note-b.mp3',
  },
  {
    id: 'C5',
    root: 'C',
    octave: 5,
    midi: 72,
    audioSrc: '/notes/note-c-5.mp3',
  },
  {
    id: 'C♯5',
    root: 'C♯',
    octave: 5,
    midi: 73,
    audioSrc: '/notes/note-c-sharp-5.mp3',
  },
  {
    id: 'D5',
    root: 'D',
    octave: 5,
    midi: 74,
    audioSrc: '/notes/note-d-5.mp3',
  },
  {
    id: 'E♭5',
    root: 'E♭',
    octave: 5,
    midi: 75,
    audioSrc: '/notes/note-e-flat-5.mp3',
  },
  {
    id: 'E5',
    root: 'E',
    octave: 5,
    midi: 76,
    audioSrc: '/notes/note-e-5.mp3',
  },
  {
    id: 'F5',
    root: 'F',
    octave: 5,
    midi: 77,
    audioSrc: '/notes/note-f-5.mp3',
  },
  {
    id: 'F♯5',
    root: 'F♯',
    octave: 5,
    midi: 78,
    audioSrc: '/notes/note-f-sharp-5.mp3',
  },
  {
    id: 'G5',
    root: 'G',
    octave: 5,
    midi: 79,
    audioSrc: '/notes/note-g-5.mp3',
  },
  {
    id: 'A♭5',
    root: 'A♭',
    octave: 5,
    midi: 80,
    audioSrc: '/notes/note-a-flat-5.mp3',
  },
  {
    id: 'A5',
    root: 'A',
    octave: 5,
    midi: 81,
    audioSrc: '/notes/note-a-5.mp3',
  },
  {
    id: 'B♭5',
    root: 'B♭',
    octave: 5,
    midi: 82,
    audioSrc: '/notes/note-b-flat-5.mp3',
  },
  {
    id: 'B5',
    root: 'B',
    octave: 5,
    midi: 83,
    audioSrc: '/notes/note-b-5.mp3',
  },
]
