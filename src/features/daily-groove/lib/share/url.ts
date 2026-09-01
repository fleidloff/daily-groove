import type { Groove } from '../../types'

/**
 * The one route segment a shared groove lives under (R16).
 *
 * Declared here rather than spelled out at each call site, so the route folder
 * `src/app/groove/` and every link built for it agree by construction.
 */
export const GROOVE_PATH = '/groove'

/**
 * Where this groove lives: `/groove/<uuid>`.
 *
 * Root-relative, so it is usable as an `href` without knowing the origin. The
 * uuid is carried whole and is the *only* thing the path carries (R1a, AC14):
 * no root, no flavour, no scale, no chord, no progression — a link cannot spoil
 * the puzzle it opens, because there is nothing in it to read.
 */
export function grooveHref(groove: Groove): string {
  return `${GROOVE_PATH}/${groove.uuid}`
}

/**
 * The absolute URL of this groove against `origin` — what actually gets shared.
 *
 * The origin is passed in rather than read from `location`, because this module
 * is reachable from a server render where there is no `location` at all, and
 * because a caller that can name the origin can be tested without a shimmed
 * global.
 *
 * A trailing slash on the origin is normalised away, so `'https://x.test/'` and
 * `'https://x.test'` produce the same URL with exactly one separator. Anything
 * else would make two share buttons on the same page disagree about the link
 * for the same groove.
 */
export function shareUrlOf(groove: Groove, origin: string): string {
  return `${origin.replace(/\/+$/, '')}${grooveHref(groove)}`
}
