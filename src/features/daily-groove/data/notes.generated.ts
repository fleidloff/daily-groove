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
