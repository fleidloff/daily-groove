'use client'

import { Card } from '@/components/surfaces/Card'
import { Heading } from '@/components/typography/Heading'
import { Row } from '@/components/layout/Row'
import { Stack } from '@/components/layout/Stack'
import { Text } from '@/components/typography/Text'

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
 * The drum samples' licence condition, in the words the licence names.
 *
 * The kit is MuldjordKit, CC BY 4.0, and unlike the CC0 material in the pack
 * that licence obliges a credit — one that follows the *rendered grooves*, not
 * just the source files, because a groove is a derivative work of the samples it
 * is built from. So it has to be visible to a player, not only to someone
 * reading `scripts/grooves/samples/provenance.json`.
 *
 * The wording is fixed by the kit's own terms and is not ours to paraphrase.
 *
 * Linked out, which needed feature-12's link rule narrowing to say what it
 * always meant: the page offers exactly one way to *navigate the app*, and on a
 * shared groove that one is the way back to today. A credit pointing off-site is
 * not navigation, and `GroovePuzzle.test.tsx` now distinguishes the two rather
 * than counting anchors.
 */
const DRUM_CREDIT = 'Drum samples provided by DrumGizmo.org'
const DRUM_CREDIT_URL = 'https://drumgizmo.org'
const DRUM_CREDIT_LICENCE = 'CC BY 4.0'
const DRUM_CREDIT_LICENCE_URL = 'https://creativecommons.org/licenses/by/4.0/'

/** Shared by both credit links: quiet, underlined, and keyboard-visible. */
const CREDIT_LINK =
  'underline decoration-border-strong underline-offset-2 transition-colors hover:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

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

        {/*
          Outside the ordered list, and quiet: this is a licence condition, not a
          fifth thing to do. `faint` at `sm` is the page's smallest register,
          which is where a credit belongs — present and legible, never competing
          with the four steps above it.

          It lives here because the how-to-play box is the one panel a player can
          always get back to: the header's help control re-opens it whenever it is
          closed, so the credit is reachable from every state of the page rather
          than only on a first visit.
        */}
        <Text tone="faint" size="sm">
          <a
            href={DRUM_CREDIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={CREDIT_LINK}
          >
            {DRUM_CREDIT}
          </a>
          {' · '}
          <a
            href={DRUM_CREDIT_LICENCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={CREDIT_LINK}
          >
            {DRUM_CREDIT_LICENCE}
          </a>
        </Text>
      </Stack>
    </Card>
  )
}
