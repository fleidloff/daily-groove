import type { Answer, Attempt, Flavour, Groove, Root } from '../../types'
import { ROOTS } from '@/lib/theory/roots'
import { FAMILIES } from '@/lib/theory/families'
import { flavourOptions, simpleRootOptions } from '@/lib/theory/music'
import { GROOVES } from '../../data/grooves.generated'
import { selectCoaching } from './coaching'
import { confirmedHalves } from './confirmed'
import {
  selectFeedback,
  shouldOfferReveal,
  shouldShowNudge,
  type Feedback,
} from './feedback'
import { ruledOut } from './ruledOut'
import { shouldShowVerdict } from './verdict'

export type OptionState = 'open' | 'confirmed' | 'out'

export type OptionView<T extends string = string> = {
  value: T
  state: OptionState
}

type CheckTone = 'idle' | 'ready' | 'solved'

type CheckView = {
  label: string
  tone: CheckTone
  enabled: boolean
}

type HintView = {
  show: boolean
  feedback: Feedback | null
  coaching: Feedback | null
  eliminated: number | null
}

export type GuessCardViewInput = {
  groove: Groove
  answer: Answer
  attempts: readonly Attempt[]
  date: Date
  selectedRoot: Root | null
  selectedFlavour: Flavour | null
  solved: boolean
  revealed: boolean
  canCheck: boolean
  simple: boolean
  tapSounds: boolean
}

type GuessCardView = {
  roots: readonly OptionView<Root>[]
  flavours: readonly OptionView<Flavour>[]
  selectedRoot: Root | null
  selectedFlavour: Flavour | null
  check: CheckView
  hint: HintView
  giveUp: boolean
  over: boolean
}

export { metaLine } from './date'

function offered<T extends string>(
  value: T | null,
  options: readonly T[],
): T | null {
  return value !== null && options.includes(value) ? value : null
}

function optionStates<T extends string>(
  values: readonly T[],
  ruledOutList: readonly T[],
  confirmedList: readonly T[],
): OptionView<T>[] {
  const locked = values.filter((value) => confirmedList.includes(value))

  if (locked.length > 0) {
    return values.map((value) => ({
      value,
      state: locked.includes(value) ? 'confirmed' : 'out',
    }))
  }

  return values.map((value) => ({
    value,
    state: ruledOutList.includes(value) ? 'out' : 'open',
  }))
}

export function guessCardView(input: GuessCardViewInput): GuessCardView {
  const {
    groove,
    answer,
    attempts,
    date,
    solved,
    revealed,
    canCheck,
    simple,
    tapSounds,
  } = input

  const rootValues: readonly Root[] = simple
    ? simpleRootOptions(date, answer)
    : ROOTS
  const flavourValues: readonly Flavour[] = simple
    ? FAMILIES
    : flavourOptions(date, groove, GROOVES)

  const narrowing = ruledOut({ attempts, answer, roots: rootValues, date })
  const confirmed = confirmedHalves([...attempts])

  const selectedRoot = offered(input.selectedRoot, rootValues)
  const selectedFlavour = offered(input.selectedFlavour, flavourValues)

  const bothOffered = selectedRoot !== null && selectedFlavour !== null
  const enabled = canCheck && bothOffered && !revealed

  const label = solved
    ? 'Solved'
    : bothOffered
      ? `Check ${selectedRoot} ${selectedFlavour}`
      : selectedRoot !== null
        ? 'Pick a mode'
        : selectedFlavour !== null
          ? 'Pick a root'
          : 'Pick a root and a mode'

  const over = solved || revealed

  return {
    roots: optionStates(rootValues, narrowing.roots, confirmed.roots),
    flavours: optionStates(flavourValues, narrowing.flavours, confirmed.flavours),
    selectedRoot,
    selectedFlavour,
    check: {
      label,
      tone: solved ? 'solved' : enabled ? 'ready' : 'idle',
      enabled,
    },
    hint: {
      show: !over,
      feedback: shouldShowVerdict(attempts)
        ? selectFeedback([...attempts], solved)
        : null,
      coaching: selectCoaching({ attempts, tapSounds, simple }),
      eliminated: shouldShowNudge(
        narrowing.eliminatedCount,
        solved,
        confirmed.roots.length > 0,
      )
        ? narrowing.eliminatedCount
        : null,
    },
    giveUp: shouldOfferReveal([...attempts], solved, revealed) && !revealed,
    over,
  }
}
