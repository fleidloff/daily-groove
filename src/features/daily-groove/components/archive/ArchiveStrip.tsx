import { MiniCard, MiniCardGrid } from '@/components/surfaces/MiniCard'
import { PlayControl } from '@/components/controls/PlayControl'
import { SectionLabel } from '@/components/typography/SectionLabel'
import { Stack } from '@/components/layout/Stack'
import { Text } from '@/components/typography/Text'
import { outcomeMark, type ArchiveEntry, type Outcome } from '../../lib/presentation/archive'

/**
 * An archive entry plus the groove the puzzle resolved for it.
 *
 * `lib/archive` shapes a record into what the card *shows*; resolution is the
 * puzzle's job, and its answer rides along here so the strip can stay
 * presentational — it compares an id and calls a handler, it never resolves a
 * groove, holds a player, or reaches for a store.
 *
 * `null` (or absent) means the day's groove is no longer in the catalogue: a
 * real state, not an error, and the one that disables the card's control (R10).
 * Optional so an `ArchiveEntry[]` is still a valid `entries` value.
 */
export type ArchiveStripEntry = ArchiveEntry & {
  grooveId?: string | null
  /**
   * The groove's display name. Absent when the day's groove has left the
   * catalogue and cannot be resolved, in which case the card simply omits it.
   */
  grooveName?: string | null
}

type ArchiveStripProps = {
  /** Past days, most recent first — as `toArchiveEntries` returns them. */
  entries: ArchiveStripEntry[]
  /** The id of the groove sounding anywhere on the page, or null. */
  soundingId: string | null
  /** Press of a card's control. The caller owns playback; the strip does not. */
  onToggle: (entry: ArchiveStripEntry) => void
}

/** One week of history. Older days fall off the row rather than being counted. */
const SHOWN = 7

/**
 * Colour is a second channel here, never the only one: `outcomeMark` already
 * says "solved", "3 tries", "missed" or "In play" in words, so the tone adds
 * emphasis rather than meaning.
 */
const MARK_TONE: Record<Outcome, string> = {
  'first-try': 'text-accent',
  solved: 'text-accent',
  missed: 'text-text-faint',
  'in-play': 'text-warm',
}

/**
 * What an in-play card shows where its answer will go. Styled exactly like the
 * answer it stands in for, so the card keeps its height and the row of seven does
 * not go ragged when today joins it.
 */
const WITHHELD = '—'

/**
 * The control's accessible name says which day it plays, so seven of them in a
 * row are distinguishable to a screen reader (R6). An unresolvable day states
 * why its control does nothing rather than leaving a silent dead button (R10).
 */
function controlLabel(
  entry: ArchiveStripEntry,
  isSounding: boolean,
  playable: boolean,
): string {
  if (!playable) return `${entry.label}'s groove is unavailable`
  return `${isSounding ? 'Stop' : 'Play'} ${entry.label}'s groove`
}

/**
 * The days behind today, as a row of small cards.
 *
 * The canvas' sparkline is deliberately absent — there is no waveform behind it
 * — and so is its "All →" link, since no archive route exists. The count is
 * plain text instead of a dead anchor.
 *
 * A missed day still shows its answer: the day cannot be replayed, so
 * withholding it would mean the player never learns it. Today, while it is
 * still unsolved, is the opposite case — it arrives here with no answer at all
 * (`lib/archive` withholds it), and shows a placeholder instead.
 *
 * Every card carries a play control, today's included. Each one asks the same
 * question — is the sounding groove mine? — so exactly one control can ever
 * show the sounding affordance, and today's card agrees with the full-width
 * button above it without either knowing about the other (R5, R11).
 */
export function ArchiveStrip({
  entries,
  soundingId,
  onToggle,
}: ArchiveStripProps) {
  if (entries.length === 0) {
    return (
      <section>
        <Stack gap="md">
          <SectionLabel>Grooves you&rsquo;ve played</SectionLabel>
          <MiniCard>
            <Text tone="muted" size="sm">
              No grooves behind you yet. Today&rsquo;s is your first &mdash; come
              back tomorrow and it will be waiting here.
            </Text>
          </MiniCard>
        </Stack>
      </section>
    )
  }

  return (
    <section>
      <Stack gap="md">
        <SectionLabel>Grooves you&rsquo;ve played</SectionLabel>
        <MiniCardGrid>
          {entries.slice(0, SHOWN).map((entry) => {
            const playable = typeof entry.grooveId === 'string'
            const isSounding = playable && entry.grooveId === soundingId

            return (
              <MiniCard key={entry.date}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] text-text-muted">{entry.label}</span>
                  <span className={`text-[12px] ${MARK_TONE[entry.outcome]}`}>
                    {outcomeMark(entry)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block font-display text-[19px] leading-none text-text">
                      {entry.answer
                        ? `${entry.answer.root} ${entry.answer.flavour}`
                        : WITHHELD}
                    </span>
                    {/* The groove's own name, under the answer it turned out to
                        be. Safe on an unsolved today: a name like "Sunroom
                        Shuffle" says nothing about the root or the flavour, so
                        it does not undo the masking above (R6a). */}
                    {entry.grooveName ? (
                      <span className="mt-1 block truncate text-[12px] text-text-muted">
                        {entry.grooveName}
                      </span>
                    ) : null}
                  </div>
                  <PlayControl
                    size="sm"
                    isPlaying={isSounding}
                    disabled={!playable}
                    label={controlLabel(entry, isSounding, playable)}
                    onToggle={() => onToggle(entry)}
                  />
                </div>
              </MiniCard>
            )
          })}
        </MiniCardGrid>
      </Stack>
    </section>
  )
}
