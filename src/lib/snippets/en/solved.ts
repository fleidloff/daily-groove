import type { SolvedSnippets } from '../types'

const MODE_LINES: Record<string, string> = {
  Ionian: 'the plain major scale — nothing bent',
  Lydian: 'major with a ♯4',
  Mixolydian: 'major with a ♭7',
  'Lydian dominant': 'major with a ♯4 and a ♭7',
  'Phrygian dominant': 'major with a ♭2, a ♭6 and a ♭7',
  'Harmonic major': 'major with a ♭6',
  Aeolian: 'the plain minor scale — nothing bent',
  Dorian: 'minor with a 6 where the ♭6 would be',
  Phrygian: 'minor with a ♭2',
  'Harmonic minor': 'minor with a 7 where the ♭7 would be',
  'Melodic minor': 'minor with a 6 and a 7 where the ♭6 and ♭7 would be',
  Blues: 'the blues scale, not the 12-bar form — that ♭5 between the 4 and the 5',
}

export const solved = {
  changes: 'The changes',
  notesToLiveIn: 'Notes to live in',
  modeLine: ({ flavour }) => {
    const wanted = flavour.trim().toLowerCase()
    const key = Object.keys(MODE_LINES).find((k) => k.toLowerCase() === wanted)
    return key === undefined ? undefined : MODE_LINES[key]
  },
  heardIn: ({ track, artist }) => `You've heard this scale in “${track}” by ${artist}`,
  nextGrooveIn: ({ hours, minutes }) =>
    `Next groove at midnight in ${hours}h ${String(minutes).padStart(2, '0')}m`,
  nextGrooveReady: 'Today’s groove is ready — reload the page to play it.',
  concertPitch: ({ root, flavour }) => `${root} ${flavour} in concert pitch`,
} satisfies SolvedSnippets
