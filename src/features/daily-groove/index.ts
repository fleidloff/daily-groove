// The daily-groove feature's only public surface. The route composes only what
// is exported here; internals in lib/, components/, and hooks/ stay private.
export { GroovePuzzle } from './components/GroovePuzzle'
export type {
  Answer,
  Attempt,
  DailyResult,
  Flavour,
  Groove,
  Root,
} from './types'
