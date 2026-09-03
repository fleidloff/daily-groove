const RENDERED = {
  ionian: 'Ionian',
  aeolian: 'Aeolian',
  dorian: 'Dorian',
  mixolydian: 'Mixolydian',
  lydian: 'Lydian',
  phrygian: 'Phrygian',
  'harmonic-minor': 'Harmonic minor',
  blues: 'Blues',
  'melodic-minor': 'Melodic minor',
  'lydian-dominant': 'Lydian dominant',
  'phrygian-dominant': 'Phrygian dominant',
  'harmonic-major': 'Harmonic major',
} as const

const APP_ONLY = { locrian: 'Locrian' } as const

export type FlavourSlug = keyof typeof RENDERED
export type ScaleSlug = FlavourSlug | keyof typeof APP_ONLY

export const FLAVOURS: FlavourSlug[] = Object.keys(RENDERED) as FlavourSlug[]

export const DISPLAY_NAMES: Record<ScaleSlug, string> = {
  ...RENDERED,
  ...APP_ONLY,
}

const SLUGS: Record<string, ScaleSlug> = Object.fromEntries(
  Object.entries(DISPLAY_NAMES).map(([slug, display]) => [
    display,
    slug as ScaleSlug,
  ]),
)

export function displayFlavour(slug: ScaleSlug): string {
  const display = DISPLAY_NAMES[slug]
  if (!display) {
    throw new Error(`displayFlavour: unknown flavour "${slug}"`)
  }
  return display
}

export function slugOf(display: string): ScaleSlug {
  const slug = SLUGS[display]
  if (!slug) {
    throw new Error(`slugOf: unknown flavour "${display}"`)
  }
  return slug
}
