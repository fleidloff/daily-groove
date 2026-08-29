import { MiniCard, MiniCardGrid } from '@/components/MiniCard'
import { SectionLabel } from '@/components/SectionLabel'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'
import { outcomeMark, type ArchiveEntry, type Outcome } from '../lib/archive'

type ArchiveStripProps = {
  /** Past days, most recent first — as `toArchiveEntries` returns them. */
  entries: ArchiveEntry[]
  /** Every past day played, not just the ones shown. */
  total: number
}

/** The design's row holds six cards; the rest live only in the total. */
const SHOWN = 6

/**
 * Colour is a second channel here, never the only one: `outcomeMark` already
 * says "solved", "3 tries" or "missed" in words, so the tone adds emphasis
 * rather than meaning.
 */
const MARK_TONE: Record<Outcome, string> = {
  'first-try': 'text-accent',
  solved: 'text-accent',
  missed: 'text-text-faint',
}

/**
 * The days behind today, as a row of small cards.
 *
 * The canvas' sparkline is deliberately absent — there is no waveform behind it
 * — and so is its "All →" link, since no archive route exists. The count is
 * plain text instead of a dead anchor.
 *
 * A missed day still shows its answer: the day cannot be replayed, so
 * withholding it would mean the player never learns it.
 */
export function ArchiveStrip({ entries, total }: ArchiveStripProps) {
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
        <SectionLabel action={<span className="text-text-muted">All {total}</span>}>
          Grooves you&rsquo;ve played
        </SectionLabel>
        <MiniCardGrid>
          {entries.slice(0, SHOWN).map((entry) => (
            <MiniCard key={entry.date}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[13px] text-text-muted">{entry.label}</span>
                <span className={`text-[12px] ${MARK_TONE[entry.outcome]}`}>
                  {outcomeMark(entry)}
                </span>
              </div>
              <span className="font-display text-[19px] leading-none text-text">
                {`${entry.answer.root} ${entry.answer.flavour}`}
              </span>
            </MiniCard>
          ))}
        </MiniCardGrid>
      </Stack>
    </section>
  )
}
