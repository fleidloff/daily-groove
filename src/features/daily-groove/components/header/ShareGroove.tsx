'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { InlineButton } from '@/components/controls/InlineButton'
import { Row } from '@/components/layout/Row'
import { Stack } from '@/components/layout/Stack'
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
  /**
   * The browser capabilities to offer the link through. Defaults to the real
   * browser's, read at press time — the prop exists so a test never has to shim
   * `navigator`.
   */
  deps?: ShareDeps
  /**
   * The origin to build the link on. Defaults to the page's own, read at press
   * time — the prop exists so a test never has to shim `window.location`.
   */
  origin?: string
}

/** How long the copy confirmation stays before it clears itself (R14). */
const CONFIRMATION_MS = 2000

/**
 * Hands the player this groove's link (R3, R7, R8).
 *
 * It owns three things and no more: the press, the transient confirmation, and
 * the URL shown when the browser will do neither. *Which* route the link takes
 * is `lib/share/share.ts`'s decision — this component maps the outcome it
 * reports to what the player sees, and `shareLink` never rejects, so there is no
 * failure branch here to write.
 *
 * Nothing is read from the browser during render. Both the origin and the
 * capabilities are gathered when the control is pressed: a page rendered on the
 * server has no `location` at all, and capability detection at press time is a
 * feature test rather than a user-agent sniff (PRD assumption). Each is also a
 * prop, so every outcome is reachable in a test without a global in sight.
 *
 * The confirmation, its timer and its live region live here rather than in
 * `InlineButton`: a design-system control that owns a timer hands that timer to
 * everyone who ever renders it (Decision log, Q1).
 */
export function ShareGroove({ groove, deps, origin }: ShareGrooveProps) {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null)
  /** The link the last press offered — rendered only when it must be read. */
  const [offered, setOffered] = useState<string | null>(null)

  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClear = useCallback(() => {
    if (clearTimer.current !== null) {
      clearTimeout(clearTimer.current)
      clearTimer.current = null
    }
  }, [])

  // A pending clear must not outlive the tree it would set state on.
  useEffect(() => cancelClear, [cancelClear])

  const handlePress = useCallback(() => {
    const url = shareUrlOf(groove, origin ?? window.location.origin)
    const capabilities = deps ?? browserShareDeps()

    // `shareLink` resolves for every path a browser can take, so the outcome is
    // simply awaited: no `catch`, and no error state to render.
    void (async () => {
      const result = await shareLink(url, capabilities)
      cancelClear()
      setOffered(url)
      setOutcome(result)

      // Only the copy confirmation is transient. The URL shown on `manual`
      // persists, because the player has to read it and copy it by hand (R11).
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
        {/* One word, in every state the page can be in: before the first
            guess, between guesses, after a solve and after a reveal (R2). */}
        <InlineButton label="Share" onPress={handlePress}>
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
          Share
        </InlineButton>

        {/* On the page before there is anything to say, so a screen reader
            announces the change rather than a new node (R6, AC9). */}
        <span
          aria-live="polite"
          className="text-[13px] leading-[1.45] text-text-muted"
        >
          {outcome === 'copied' ? 'Link copied' : ''}
        </span>
      </Row>

      {/* The last resort: neither a sheet nor the clipboard was available or
          permitted, so the link itself is the answer (R11, R13). `select-all`
          is what makes it one click to take rather than a careful drag. It is
          not an error, and is not announced as one. */}
      {outcome === 'manual' && offered !== null && (
        <span className="select-all break-all text-[12px] leading-[1.45] text-text-muted">
          {offered}
        </span>
      )}
    </Stack>
  )
}
