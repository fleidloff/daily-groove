'use client'

import { Card } from '@/components/surfaces/Card'
import { Heading } from '@/components/typography/Heading'
import { Row } from '@/components/layout/Row'
import { Stack } from '@/components/layout/Stack'

type HowToPlayProps = {
  /**
   * Asked to be taken off screen. Whether the box is showing is the page's
   * session state, not the box's, so the box never hides itself (R6).
   */
  onClose: () => void
}

/**
 * The four items, in this order and with these words (R4). They are the box's
 * own copy and nothing else reads them, so they live here rather than in a
 * shared copy module.
 */
const STEPS = [
  'Listen to the groove 🎧',
  'Jam along 🎸',
  'Guess the Root & Mode 🎯',
  'Come back every day for a new challenge ⏭',
]

/**
 * Each item is words followed by one trailing mark. Splitting at the last space
 * rather than holding two columns of copy keeps the strings above readable as
 * the sentences they are, and guarantees the rendered item reads back exactly
 * as written — the emoji is only ever wrapped, never re-typed (R14).
 */
function splitMark(step: string): { words: string; mark: string } {
  const cut = step.lastIndexOf(' ')
  return { words: step.slice(0, cut + 1), mark: step.slice(cut + 1) }
}

/**
 * The short how-to-play shown to a player who has never played or has been away
 * for over a month. It precedes the game it explains and never covers it (R5).
 *
 * On the recessed inset surface, so it reads as an aside rather than as a third
 * card competing with the groove and the guess — and not on the accent surface,
 * which would make the instructions the loudest thing on a new player's page
 * (R5a).
 *
 * A numbered list, 1 to 4: the order is the order you do them in, and a
 * newcomer reading four numbered lines knows there are exactly four things to
 * know (R4a). The numbers come from the list's own marker rather than from the
 * copy, so each item still reads back exactly as written in `STEPS`, and a
 * screen reader announces the position itself.
 *
 * The items carry the page's full ink at a size above body copy, and the
 * markers the accent — this is the first thing a new player reads, and it was
 * previously the quietest thing on the page (R4b). The emoji are decorative and
 * each is hidden from the accessibility tree, so an item's accessible name is
 * its words alone (R14).
 *
 * It holds no state and knows nothing about who the player is. Both are the
 * page's business; the box only draws and asks to be closed.
 */
export function HowToPlay({ onClose }: HowToPlayProps) {
  return (
    <Card tone="inset">
      <Stack gap="md">
        <Row gap="md" align="center" justify="between">
          <Heading level={2} size="sm">
            How to play
          </Heading>

          {/*
            A native button with its own name, not the design system's `Button`
            — that is the page's full-width call to action, and this is a small
            control in the box's corner. Reachable and operable by keyboard for
            free (R6).
          */}
          <button
            type="button"
            aria-label="Close how to play"
            onClick={onClose}
            className="inline-flex h-[22px] w-[22px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-border text-[13px] leading-none text-text-muted transition-colors hover:border-border-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            {/* Decoration: the name is on the button. */}
            <span aria-hidden="true">✕</span>
          </button>
        </Row>

        {/*
          `list-decimal` puts the numbers in the marker, not in the text, so
          `STEPS` stays the single source of each item's wording and the
          numbering cannot drift from the order. `marker:` styles them without a
          span of their own.
        */}
        <ol className="flex list-decimal flex-col gap-2 pl-6 marker:font-semibold marker:text-accent">
          {STEPS.map((step) => {
            const { words, mark } = splitMark(step)
            return (
              <li
                key={step}
                className="text-[16px] font-medium leading-[1.5] text-text"
              >
                {words}
                <span aria-hidden="true">{mark}</span>
              </li>
            )
          })}
        </ol>
      </Stack>
    </Card>
  )
}
