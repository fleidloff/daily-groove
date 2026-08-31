import { Heading } from '@/components/typography/Heading'
import { Text } from '@/components/typography/Text'
import { Row } from '@/components/layout/Row'
import { Stack } from '@/components/layout/Stack'
import { APP_NAME, TAGLINE } from '@/lib/branding'
import { HelpToggle } from './HelpToggle'
import { StreakBadge } from './StreakBadge'

type GrooveHeaderProps = {
  streak: number
  /**
   * The question mark at the end of the tagline was pressed. The header only
   * reports it: whether the how-to-play box is on screen is the page's session
   * state, not the header's (F8 E3 R8).
   *
   * `null` when there is nothing to ask for — the box is already on screen — and
   * the question mark is then not rendered at all (F8 E3 R10). No handler, no
   * control: the header is told once, not twice.
   */
  onShowHelp: (() => void) | null
}

/**
 * The page masthead: the app's name, the one-line pitch beneath it, and the
 * streak pill on the right — on the right at every width, including the stacked
 * one below `sm`, where it sits at the end of its own line rather than centred.
 *
 * It shows no date. The groove card has carried the day beside the tempo since
 * feature-7, so the header's copy was the duplicate — dropping it leaves the top
 * of the page as name-then-pitch and makes this a pure function of the streak,
 * with no clock to read and no fake timers to test it (F8 E1 R11, R12, R13).
 *
 * The tagline is `Text`, not a smaller `Heading`: a 110-character sentence in
 * the hand-lettered face is a smear, and a second heading would add a level to
 * the document outline that the page does not have (F8 E1 R4, R5).
 *
 * The question mark sits *inside* that paragraph, after the final full stop, so
 * it follows the last character wherever the sentence wraps rather than floating
 * beside the block. A `button` is phrasing content, so it is valid there, and
 * `Text` renders the paragraph around both (F8 E3 R8).
 *
 * It is absent while the box is on screen: a control asking for something you
 * are already looking at is noise. The page says so by passing no handler
 * (F8 E3 R10).
 */
export function GrooveHeader({ streak, onShowHelp }: GrooveHeaderProps) {
  return (
    <header>
      <Row gap="lg" align="center" justify="between" collapseBelow="sm">
        {/* Below `sm` the Row is a column, so its `align="center"` is the
            *horizontal* one and would centre both sides. Each anchors itself
            for the stacked case and hands the alignment back to the Row once
            it is a row again (F8 E2 R10a). */}
        <div className="min-w-0 self-start sm:self-auto">
          <Stack gap="xs">
            <Heading level={1} size="xl">
              {APP_NAME}
            </Heading>
            <Text tone="muted">
              {TAGLINE}{' '}
              {onShowHelp && <HelpToggle onShow={onShowHelp} />}
            </Text>
          </Stack>
        </div>

        <div className="self-end sm:self-auto">
          <StreakBadge streak={streak} />
        </div>
      </Row>
    </header>
  )
}
