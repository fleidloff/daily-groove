// The daily-groove feature's only public surface. The route composes only what
// is exported here; internals in lib/, components/, and hooks/ stay private.
export { GroovePuzzle } from './components/GroovePuzzle'
// Feature-12: a shared groove is reached by uuid, and a groove knows the URL it
// lives at. Both are the feature's business, so the route and the share control
// ask for them here rather than re-deriving `/groove/<uuid>` for themselves.
export { grooveByUuid } from './lib/puzzle/grooveByUuid'
// Whether a shared link points at the groove `/` is already serving. The route
// asks, because where to send the player is the route's decision, not the
// puzzle's — the feature only knows which groove belongs to which day.
export { isTodaysGroove } from './lib/puzzle/isTodaysGroove'
export { grooveHref, shareUrlOf } from './lib/share/url'
export type {
  Answer,
  Attempt,
  DailyResult,
  Flavour,
  Groove,
  Root,
} from './types'
