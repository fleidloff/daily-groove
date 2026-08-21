# Architecture

The app is built as vertical feature slices. Two directories carry the rules:

- `src/components` — the design system: generic, reusable building blocks.
- `src/features/<feature>` — one self-contained feature per folder.

Everything else is glue: `src/app` for routing, `src/lib` for cross-cutting utilities.

## src/components — the design system

- Every basic component lives here. Basic components never live in `src/app` or
  inside a feature.
- Components are reusable by construction: driven by props, no app state, no
  knowledge of any feature or domain concept.
- **A file in `src/components` must never import from `src/features`.** This is the
  rule that keeps the design system reusable and features removable.
- Name them generically — `Button`, `Card`, `DataTable`, not `CheckoutButton`.
  Domain naming belongs to the feature.

## src/features — vertical slices

Each feature owns everything it needs, in one folder:

```
src/features/<feature>/
├── components/   feature-specific UI, composed from src/components
├── hooks/
├── lib/          business logic and data access
├── *.test.ts(x)  colocated with the code under test
└── index.ts      the feature's only public surface
```

- Feature-specific components stay in the feature. Promote one to `src/components`
  only when a second feature needs it *and* the domain naming can be stripped out.
- Import a feature only through its `index.ts`. No deep imports into a feature.

## Every feature must be removable

The standard: **delete `src/features/<feature>/`, delete its route folder under
`src/app`, remove its one registration entry — and the app still builds and runs.**

To keep that true:

- **No feature imports another feature.** If two features need the same thing, it
  moves up into `src/components` or `src/lib`. It is never shared sideways.
- A feature's only inbound references are its route(s) in `src/app` and, where it
  must appear in shared UI, a single registration point such as a nav entry. Those
  references should be countable on one hand.
- Feature state, types, and styles stay inside the feature folder.

Before merging a feature, ask: could I `rm -rf` this folder and still get a clean
build? If not, something leaked.

See also: [testing.md](testing.md).
