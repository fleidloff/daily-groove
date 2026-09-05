import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Answer, DailyResult } from '../types'
import { parseIsoDate } from '@/lib/date'
import { answerOf } from '@/lib/theory/music'
import { GROOVES } from './grooves.generated'
import { grooveByUuid } from '../lib/puzzle/grooveByUuid'
import { selectGrooveForDate } from '../lib/puzzle/selectGroove'
import { createLocalStore } from '../lib/persistence/storage'

type PastPuzzle = {
  date: string
  grooveId: string
  uuid: string
  answer: Answer
  scale: string
  chord: string
  progression: string
  progressionDegrees: number[]
  bpm: number
  audioSrc: string
}

type Fixture = {
  provenance: {
    commit: string
    subject: string
    why: string
    how: string
    taken: string
    span: string
    catalogueLength: number
    doNotRegenerate: string
    ifTheCatalogueGrows: string
  }
  days: PastPuzzle[]
}

const FIXTURE_PATH = join(
  process.cwd(),
  'src',
  'features',
  'daily-groove',
  'data',
  'pastPuzzles.fixture.json',
)

const PRE_FEATURE_COMMIT = '98a8d20f306544f19c572cc72914877165417a5e'

const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Fixture
const DAYS = fixture.days

// Why this reads the way it does: every failure here is a player's history being
// silently rewritten, and a diff of two strings does not say that. Two causes can
// rewrite it, and only one of them is a bug, so the messages below branch on which.
const CATALOGUE_AT_CAPTURE = fixture.provenance.catalogueLength
const GREW = GROOVES.length > CATALOGUE_AT_CAPTURE

const FROZEN_CAUSES = [
  'docs/music.md § What must never change names what does this: src/lib/hash.ts, MUSIC_LABEL',
  'and its draw order, the order of FLAVOURS and of each template’s own flavours list, and a',
  'groove’s uuid. Reordering or removing an entry in catalogue.json does it too —',
  'selectGrooveForDate indexes a seeded shuffle of the whole catalogue, so one entry that moves',
  'moves every one of the days below and every day before them.',
]

const GROWTH_RULED_OUT = [
  `The catalogue still ships ${CATALOGUE_AT_CAPTURE} grooves, the length this record was taken against, so growth`,
  'is not what did this. Growing the catalogue is the one sanctioned way these days move, and it is',
  'not in play here.',
]

const GROWTH_IS_NOT_THE_CAUSE = [
  `The catalogue has also grown, from ${CATALOGUE_AT_CAPTURE} to ${GROOVES.length}. That is sanctioned (feature-7 R6),`,
  'and it is not what broke this case: growth changes which day a groove falls on and nothing else,',
  'leaving every answer, every identity field and every uuid exactly where it was. Something frozen',
  'moved as well.',
]

const RESTORE = [
  `Restore what moved. This fixture was taken from ${PRE_FEATURE_COMMIT.slice(0, 7)}, the last commit`,
  'before feature-24, and it is the only record in the repo of what players are actually',
  'holding. Do not regenerate it from today’s tree: that makes it agree with whatever broke it.',
]

const FROZEN_MOVED = [
  '',
  ...FROZEN_CAUSES,
  '',
  ...(GREW ? GROWTH_IS_NOT_THE_CAUSE : GROWTH_RULED_OUT),
  '',
  ...RESTORE,
].join('\n')

const CATALOGUE_GREW = [
  '',
  `The catalogue has grown. This record was taken against ${CATALOGUE_AT_CAPTURE} grooves and the tree ships`,
  `${GROOVES.length}. selectGrooveForDate indexes a seeded shuffle of the whole catalogue, so one more entry`,
  'moves every past date, including every day below. Nothing frozen has to have moved for this to',
  'happen — npm run grooves:add is enough.',
  '',
  'This is expected, and it costs no player anything. Nothing in the app ever re-resolves a past',
  'date: selectGrooveForDate has two production callers and both pass new Date(). A stored result',
  'carries its own grooveId, and a share link resolves by uuid through grooveByUuid, so what a',
  'player is holding still opens the puzzle they played, with the same answer on it. Feature-7 R6',
  'settled this three features ago: “Days before the change keep whatever they were shown, because',
  'DailyResult.grooveId records what was actually played.”',
  '',
  'So do not restore the catalogue. Re-baseline this record instead — and take the new one from an',
  'archive of the tree as it stood before the growth, never from the tree that grew it:',
  '',
  '  git archive <the last commit before the growth> | tar -x -C <scratch>/pre',
  '  ln -s <repo>/node_modules <scratch>/pre/node_modules',
  '  npx vitest run --root <scratch>/pre --project app    # emit the days with THAT tree',
  '',
  'Regenerating from this tree would silently bless whatever moved in it, which is the exact failure',
  `this record exists to prevent. Span three full laps of the new size (${3 * GROOVES.length} days) so no groove is`,
  `left unwatched, and set provenance.catalogueLength to ${GROOVES.length}. The fixture’s own provenance block`,
  'carries this procedure too.',
].join('\n')

const WHAT_MOVED = GREW ? CATALOGUE_GREW : FROZEN_MOVED

const REASSIGNED = [
  ...(GREW
    ? [
        'A day this record was taken on now resolves to a different groove — because the catalogue grew.',
        '',
        'Each line is a day some browser is holding a result for. That result was written against the',
        'groove on the left; a catalogue of this size resolves the day to the groove on the right. Read',
        'the rest before changing anything: no player loses their result to this.',
      ]
    : [
        'A puzzle players have already solved has been reassigned.',
        '',
        'Each line is a day some browser is holding a result for. That result was written against',
        'the groove on the left; today’s catalogue resolves the day to the groove on the right. Every',
        'player who solved that day now has their answer, their attempts and their solved badge',
        'attached to a different question, and nothing in the app will ever tell them.',
      ]),
  WHAT_MOVED,
].join('\n')

const ANSWER_MOVED = [
  'The answer to a puzzle players have already solved has changed.',
  '',
  'The day still resolves to the same groove, but that groove’s root or mode is not the one the',
  'stored result was scored against. Their winning guess is now a wrong guess and their solved',
  'badge sits on top of it. This is the quietest of all the failures in this file: the share',
  'link still opens, the audio still plays, and the answer underneath it is a different one.',
  FROZEN_MOVED,
].join('\n')

const IDENTITY_MOVED = [
  'A groove players have already been shown is no longer the same groove.',
  '',
  'The day and the answer still line up, but the scale, the chord, the progression, the tempo or',
  'the audio file behind them moved. The reveal a player read, and the lead sheet they were',
  'shown, described something this catalogue no longer contains. R2 of feature-24 epic 3 lists',
  'exactly these fields as the ones a re-render may not touch.',
  FROZEN_MOVED,
].join('\n')

const LINK_BROKEN = [
  'A share link players already hold no longer opens the puzzle it was minted for.',
  '',
  'A shared groove is resolved by uuid alone — /groove/<uuid> — so a uuid that has moved or',
  'vanished is a link that opens the wrong puzzle or nothing at all. docs/music.md names a',
  'groove’s uuid as one of the four things that must never change, for this reason.',
  FROZEN_MOVED,
].join('\n')

const LAPS_BROKEN = GREW
  ? [
      'The catalogue has grown, so this record no longer spans whole laps of the rotation.',
      '',
      `It holds ${DAYS.length} days, three laps of the ${CATALOGUE_AT_CAPTURE} grooves it was taken against, and three laps`,
      `of today’s ${GROOVES.length} is ${3 * GROOVES.length}. This one is bookkeeping rather than a player-facing failure,`,
      'and the fix is the re-baseline below.',
      CATALOGUE_GREW,
    ].join('\n')
  : [
      'The record no longer spans whole laps of the rotation. Either days were removed from it',
      '— which shrinks what the checks below can see — or the catalogue changed length, which',
      'reassigns every past puzzle on its own. selectGrooveForDate shuffles a whole lap at a',
      'time, so a record that stops mid-lap stops exercising the swap in orderFor.',
    ].join('\n')

const UNWATCHED = GREW
  ? [
      'The catalogue ships a groove this record has never seen assigned to a day, so nothing here',
      'would notice if that groove’s answer moved. The catalogue has grown, which is why, and the',
      'record has to grow with it.',
      CATALOGUE_GREW,
    ].join('\n')
  : [
      'The catalogue ships a groove this record has never seen assigned to a day, so nothing',
      'here would notice if that groove’s answer moved. The catalogue is the length this record',
      'was taken against, so a groove was reordered, replaced or renamed rather than added, or',
      'the record was trimmed. Extend the record from a tree that predates the change, or put',
      'the catalogue back.',
    ].join('\n')

function storedResultFor(day: PastPuzzle): DailyResult {
  return {
    date: day.date,
    answer: day.answer,
    attempts: [
      { ...day.answer, correct: true, rootMatched: true, flavourMatched: true },
    ],
    solved: true,
    grooveId: day.grooveId,
  }
}

function resolvedFor(day: PastPuzzle) {
  return selectGrooveForDate(parseIsoDate(day.date), GROOVES)
}

function say(answer: Answer): string {
  return `${answer.root} ${answer.flavour}`
}

describe('the record of what players are holding', () => {
  it('was taken from the last commit before feature-24, not from this tree', () => {
    expect(fixture.provenance.commit).toBe(PRE_FEATURE_COMMIT)
    expect(fixture.provenance.how).toContain('git archive')
  })

  it('records the catalogue length it was taken against, so growth can be told apart', () => {
    expect(
      fixture.provenance.catalogueLength,
      [
        'provenance.catalogueLength is what the messages in this file branch on: a catalogue longer',
        'than this is growth, which feature-7 R6 sanctions, and anything else is one of the four',
        'frozen things having moved. It must equal the number of distinct grooves the record actually',
        'names, or the branch can be silenced by editing one number instead of re-baselining.',
      ].join('\n'),
    ).toBe(new Set(DAYS.map((day) => day.grooveId)).size)

    expect(fixture.provenance.ifTheCatalogueGrows).toContain('git archive')
  })

  it('covers three full laps of the rotation, so a lap boundary is crossed twice', () => {
    const dates = DAYS.map((day) => day.date)
    expect(DAYS.length, LAPS_BROKEN).toBe(3 * GROOVES.length)
    expect(new Set(dates).size, 'the record names the same day twice').toBe(DAYS.length)
    expect([...dates].sort(), 'the record is not in date order').toEqual(dates)
  })

  it('names every groove the catalogue ships, so no groove is left unwatched', () => {
    const recorded = new Set(DAYS.map((day) => day.grooveId))
    const shipped = GROOVES.map((groove) => groove.id)
    const unwatched = shipped.filter((id) => !recorded.has(id))
    expect(unwatched, UNWATCHED).toEqual([])
  })

  it('records a real stored result, shaped the way the app writes one', async () => {
    const store = createLocalStore()
    const day = DAYS[0]
    await store.save(storedResultFor(day))
    expect(await store.get(day.date)).toEqual(storedResultFor(day))
  })
})

describe('a stored result from before feature-24 still resolves', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('resolves every stored day to the groove it was solved on', () => {
    const reassigned = DAYS.filter(
      (day) => resolvedFor(day).id !== day.grooveId,
    ).map((day) => `${day.date}: solved on ${day.grooveId}, now resolves to ${resolvedFor(day).id}`)

    expect(reassigned, REASSIGNED).toEqual([])
  })

  it('keeps the answer behind every stored day', () => {
    const moved = DAYS.filter((day) => {
      const groove = resolvedFor(day)
      return (
        groove.id === day.grooveId &&
        (groove.root !== day.answer.root || groove.flavour !== day.answer.flavour)
      )
    }).map(
      (day) =>
        `${day.date} (${day.grooveId}): solved as ${say(day.answer)}, the answer is now ${say(answerOf(resolvedFor(day)))}`,
    )

    expect(moved, ANSWER_MOVED).toEqual([])
  })

  it('keeps the scale, chord, progression, tempo and audio the player was shown', () => {
    const moved: string[] = []
    for (const day of DAYS) {
      const groove = resolvedFor(day)
      if (groove.id !== day.grooveId) continue
      const fields: [string, unknown, unknown][] = [
        ['scale', day.scale, groove.scale],
        ['chord', day.chord, groove.chord],
        ['progression', day.progression, groove.progression],
        ['progressionDegrees', day.progressionDegrees.join(','), groove.progressionDegrees?.join(',')],
        ['bpm', day.bpm, groove.bpm],
        ['audioSrc', day.audioSrc, groove.audioSrc],
      ]
      for (const [name, was, now] of fields) {
        if (was !== now) {
          moved.push(`${day.date} (${day.grooveId}): ${name} was ${String(was)}, is now ${String(now)}`)
        }
      }
    }

    expect(moved, IDENTITY_MOVED).toEqual([])
  })

  it('opens every stored groove by its uuid, the way a share link does', () => {
    const broken = DAYS.filter((day) => {
      const groove = grooveByUuid(day.uuid)
      return (
        groove === undefined ||
        groove.id !== day.grooveId ||
        groove.root !== day.answer.root ||
        groove.flavour !== day.answer.flavour
      )
    }).map((day) => {
      const groove = grooveByUuid(day.uuid)
      if (groove === undefined) {
        return `${day.uuid} (${day.grooveId}, shared on ${day.date}): no groove in the catalogue has this uuid`
      }
      return `${day.uuid} (shared on ${day.date}): was ${day.grooveId} / ${say(day.answer)}, now opens ${groove.id} / ${say(answerOf(groove))}`
    })

    expect(broken, LINK_BROKEN).toEqual([])
  })

  it('resolves the same way after a round trip through the store the app writes to', async () => {
    const store = createLocalStore()
    for (const day of DAYS) await store.save(storedResultFor(day))

    const readBack = await store.getAll()
    expect(readBack).toHaveLength(DAYS.length)

    const reassigned = readBack
      .map((result) => {
        const groove = selectGrooveForDate(parseIsoDate(result.date), GROOVES)
        const same =
          groove.id === result.grooveId &&
          groove.root === result.answer.root &&
          groove.flavour === result.answer.flavour
        return same
          ? null
          : `${result.date}: stored ${result.grooveId} / ${say(result.answer)}, reopens as ${groove.id} / ${say(answerOf(groove))}`
      })
      .filter((line): line is string => line !== null)

    expect(reassigned, REASSIGNED).toEqual([])
  })
})
