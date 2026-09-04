import { puzzle } from '@/lib/snippets'
import { writtenRoot, type InstrumentKey } from '@/lib/theory/transpose'
import type { Answer, Groove } from '../../types'

const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long' })
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
})

export function dateLine(date: Date): string {
  return `${WEEKDAY.format(date)}, ${DAY_MONTH.format(date)}`
}

export function metaLine(
  groove: Groove,
  date: Date | null,
  answer: Answer | null = null,
  instrumentKey: InstrumentKey = 'C',
): string {
  return [
    puzzle.bpm({ bpm: groove.bpm }),
    ...(answer
      ? [`${writtenRoot(answer.root, instrumentKey)} ${answer.flavour}`]
      : []),
    date ? dateLine(date) : puzzle.sharedGroove,
  ].join(' · ')
}
