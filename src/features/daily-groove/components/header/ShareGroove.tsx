'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { InlineButton } from '@/components/controls/InlineButton'
import { Row } from '@/components/layout/Row'
import { Stack } from '@/components/layout/Stack'
import { header } from '@/lib/snippets'
import type { Groove } from '../../types'
import {
  browserShareDeps,
  shareLink,
  type ShareDeps,
  type ShareOutcome,
} from '../../lib/share/share'
import { shareUrlOf } from '../../lib/share/url'

type ShareGrooveProps = {
  groove: Groove
  deps?: ShareDeps
  origin?: string
}

const CONFIRMATION_MS = 2000

export function ShareGroove({ groove, deps, origin }: ShareGrooveProps) {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null)
  const [offered, setOffered] = useState<string | null>(null)

  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClear = useCallback(() => {
    if (clearTimer.current !== null) {
      clearTimeout(clearTimer.current)
      clearTimer.current = null
    }
  }, [])

  useEffect(() => cancelClear, [cancelClear])

  const handlePress = useCallback(() => {
    const url = shareUrlOf(groove, origin ?? window.location.origin)
    const capabilities = deps ?? browserShareDeps()

    void (async () => {
      const result = await shareLink(url, capabilities)
      cancelClear()
      setOffered(url)
      setOutcome(result)

      if (result === 'copied') {
        clearTimer.current = setTimeout(() => {
          clearTimer.current = null
          setOutcome(null)
        }, CONFIRMATION_MS)
      }
    })()
  }, [cancelClear, deps, groove, origin])

  return (
    <Stack gap="xs">
      <Row gap="sm" align="center">
        <InlineButton label={header.share} onPress={handlePress}>
          <svg
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 16 16"
            width="13"
            height="13"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 10.5V2.5" />
            <path d="M4.75 5.75 8 2.5l3.25 3.25" />
            <path d="M3 9.5v3.5a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V9.5" />
          </svg>
          {header.share}
        </InlineButton>

        <span
          aria-live="polite"
          className="text-[13px] leading-[1.45] text-text-muted"
        >
          {outcome === 'copied' ? header.linkCopied : ''}
        </span>
      </Row>

      {outcome === 'manual' && offered !== null && (
        <span className="select-all break-all text-[12px] leading-[1.45] text-text-muted">
          {offered}
        </span>
      )}
    </Stack>
  )
}
