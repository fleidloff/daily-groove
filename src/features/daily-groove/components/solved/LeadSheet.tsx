import { Lettering } from '@/components/typography/Lettering'

type LeadSheetProps = {
  chords: string[]
  numerals?: string[]
}

const BAR = 'relative border-l border-current/60 pl-3 pr-4 pt-1 pb-9'

export function LeadSheet({ chords, numerals }: LeadSheetProps) {
  return (
    <div
      role="img"
      aria-label={chords
        .map((chord, bar) =>
          numerals?.[bar] ? `${chord} ${numerals[bar]}` : chord,
        )
        .join(' · ')}
      className="relative grid grid-cols-2 sm:grid-cols-4 items-stretch border-r-[3px] border-current/60"
    >
      {chords.map((chord, bar) => (
        <div key={bar} data-bar={bar} className={BAR}>
          <Lettering size="md">{chord}</Lettering>
          {numerals?.[bar] ? (
            <span data-numeral="" className="absolute bottom-2 left-3">
              <Lettering size="sm">{numerals[bar]}</Lettering>
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
