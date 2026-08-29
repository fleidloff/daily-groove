/**
 * The curated vocabulary groove names are built from.
 *
 * One rule governs every entry: a name must never leak the answer. So no word
 * here may be a note name (A-G, with either accidental spelling) or a mode
 * name (major, minor, dorian, blues, ...), checked as a whole word by
 * name.test.ts. That test is what keeps the rule true as the list grows —
 * add words freely, but run it.
 *
 * Both lists are kept well past two dozen entries so a catalogue of eight
 * grooves has room to pair without collisions.
 */

export const ADJECTIVES: readonly string[] = [
  'Velvet',
  'Dusty',
  'Molten',
  'Hazy',
  'Midnight',
  'Amber',
  'Crooked',
  'Humid',
  'Glassy',
  'Restless',
  'Tender',
  'Salted',
  'Neon',
  'Wandering',
  'Copper',
  'Patient',
  'Smoky',
  'Tilted',
  'Plush',
  'Rambling',
  'Sunken',
  'Quiet',
  'Rusted',
  'Slanted',
  'Feathered',
  'Marbled',
  'Drowsy',
  'Gilded',
]

export const NOUNS: readonly string[] = [
  'Pocket',
  'Shuffle',
  'Lantern',
  'Ravine',
  'Boulevard',
  'Cassette',
  'Awning',
  'Ferry',
  'Tangle',
  'Parlour',
  'Meadow',
  'Orbit',
  'Alley',
  'Harbour',
  'Lullaby',
  'Carousel',
  'Thicket',
  'Drizzle',
  'Cabin',
  'Signal',
  'Tumble',
  'Veranda',
  'Sparrow',
  'Lagoon',
  'Trolley',
  'Canyon',
  'Basement',
  'Mirage',
]

/** Every word in the vocabulary, for the tests that police it. */
export const WORDS: readonly string[] = [...ADJECTIVES, ...NOUNS]
