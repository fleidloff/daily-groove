import { Lettering } from '@/components/typography/Lettering'

type LeadSheetProps = {
  chords: string[]
  numerals?: string[]
}

const SHEET =
  'relative grid grid-cols-4 items-stretch border-r-[3px] border-current/60'

const BAR =
  'relative whitespace-nowrap border-l border-current/60 ' +
  'pl-1 pr-1 pt-1 pb-9 sm:pl-3 sm:pr-4'

const NUMERAL = 'absolute bottom-2 left-1 sm:left-3'

export function LeadSheet({ chords, numerals }: LeadSheetProps) {
  return (
    <div
      role="img"
      aria-label={chords
        .map((chord, bar) =>
          numerals?.[bar] ? `${chord} ${numerals[bar]}` : chord,
        )
        .join(' · ')}
      className={SHEET}
    >
      {chords.map((chord, bar) => (
        <div key={bar} data-bar={bar} className={BAR}>
          <Lettering size="sm" sizeAbove="md">
            {chord}
          </Lettering>
          {numerals?.[bar] ? (
            <span data-numeral="" className={NUMERAL}>
              <Lettering size="xs" sizeAbove="sm">
                {numerals[bar]}
              </Lettering>
            </span>
          ) : null}
        </div>
      ))}
      <span
        data-double-bar=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-[3px] border-r border-current/60"
      />
    </div>
  )
}
