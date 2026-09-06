import type { ReactNode } from 'react'
import { Row } from '@/components/layout/Row'

type GrooveControlsProps = {
  share?: ReactNode
  transpose?: ReactNode
}

export function GrooveControls({ share, transpose }: GrooveControlsProps) {
  if (!share && !transpose) return null

  return (
    <Row gap="sm" align="center" justify="end">
      {transpose}
      {share}
    </Row>
  )
}
