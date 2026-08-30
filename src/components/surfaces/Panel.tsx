import type { ReactNode } from 'react'

type PanelProps = {
  children: ReactNode
}

type PanelColumnsProps = {
  children: ReactNode
}

/**
 * A full-width inverted surface: the accent gradient with light text on top.
 *
 * The gradient runs between the two accent tokens, so the night palette flips
 * the whole surface at the token layer with no variant here — there the accent
 * is the light green and `paper-tint` is the deep ink, and the inversion still
 * reads. The flat `bg-accent` underneath is the floor the gradient paints over,
 * so the surface is never bare if the gradient cannot render.
 */
export function Panel({ children }: PanelProps) {
  return (
    <section className="w-full rounded-card bg-accent bg-linear-160 from-accent to-accent-hover px-6 py-7 text-on-accent sm:px-10 sm:py-9">
      {children}
    </section>
  )
}

/**
 * The panel's column wrapper. Single-column is the base and the split is the
 * override, so a narrow viewport never has to undo a wide-viewport layout.
 */
export function PanelColumns({ children }: PanelColumnsProps) {
  return (
    <div className="grid grid-cols-1 gap-7 sm:gap-9 md:grid-cols-2">{children}</div>
  )
}
