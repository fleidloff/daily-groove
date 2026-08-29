/**
 * The design system's closed spacing scale.
 *
 * Primitives take a value from this union rather than a length or a utility
 * class, so a caller can never smuggle an arbitrary spacing decision into a
 * component from the outside.
 */
export type Space = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
