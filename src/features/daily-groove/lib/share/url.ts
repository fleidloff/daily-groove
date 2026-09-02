import type { Groove } from '../../types'

export const GROOVE_PATH = '/groove'

export function grooveHref(groove: Groove): string {
  return `${GROOVE_PATH}/${groove.uuid}`
}

export function shareUrlOf(groove: Groove, origin: string): string {
  return `${origin.replace(/\/+$/, '')}${grooveHref(groove)}`
}
