import { GROOVES } from '../../data/grooves.generated'
import type { Groove } from '../../types'

export function grooveByUuid(uuid: string): Groove | undefined {
  const wanted = uuid.toLowerCase()
  return GROOVES.find((groove) => groove.uuid.toLowerCase() === wanted)
}
