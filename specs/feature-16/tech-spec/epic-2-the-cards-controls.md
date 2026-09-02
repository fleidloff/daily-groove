# Tech spec — Epic 2: The card's controls

PRD: [../prd/epic-2-the-cards-controls.md](../prd/epic-2-the-cards-controls.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Four pieces, in a line from the store outwards. `preferences.ts` grows a second
field and loses its whole-object writer: `PreferenceStore.set(prefs)` becomes
`PreferenceStore.update(patch)`, a read-modify-write that leaves every field the
patch does not name exactly as it was — which makes "two writers clobbering each
other" unrepresentable rather than something both hooks have to remember.
`useTapSounds` sits beside `useSimpleMode` with the same `store` seam, the same
optimistic update and the same swallowed write failure. The switch itself is
extracted first: `ModeToggle`'s markup moves verbatim into a design-system
`Switch`, and both `ModeToggle` and the new `TapSoundsToggle` become five-line
callers of it. The gate is one line in `GroovePuzzle` where the root handler is
built, so a tap with the sounds off never reaches the voice and nothing is
fetched or decoded.

The *Check* half is one prop — `size="lg"` on the `Button` `GuessCard` already
renders — plus the three things that follow it: that the longest label the
control can show still fits, that the three tones still read apart at 17px, and
that `PlayControl` is untouched.

Two things are deliberately *not* built. There is no `disabled` prop on
`TapSoundsToggle` at all: R5a says the switch never settles, and a control with
no way to be locked cannot be locked by a later edit. And nothing new is added
to the feature's `index.ts` — the preference is internal to the slice, and the
slice stays as removable as it was.

## Architecture

### The dependency shape

```
GroovePuzzle ──▶ useTapSounds ──▶ PreferenceStore.update
     │                                    ▲
     │ tapSounds (bool)                   │
     ▼                             useSimpleMode
  GuessCard ──▶ TapSoundsToggle ──▶ @/components/controls/Switch
            └─▶ ModeToggle ────────▶ (the same primitive)
```

Every arrow already exists as a direction the app is allowed to draw. The new
one is `src/features/daily-groove/components/puzzle/*` → `src/components/controls/Switch`,
which is a feature reaching the design system — the arrow the guidelines are
built around. `Switch` imports nothing but React, so the design system stays a
leaf with respect to the feature, and `globals.test.ts` guards I2, I4 and I5 stay
green: no feature import, no `className` escape hatch, and no domain word — the
word "Tap sounds" is a prop the caller passes, not a string the primitive holds.

### Where the gate goes, and why there

`GroovePuzzle` builds the root handler today by handing `playRoot` straight to
`GuessCard` as `onHearRoot`. The gate wraps that:

```tsx
const hearRoot = useCallback(
  (root: Root) => {
    if (!tapSounds) return
    playRoot(root)
  },
  [tapSounds, playRoot],
)
```

Not inside `useReferenceNote`, and not inside `lib/audio/reference.ts`. A gate in
the voice would be a mute over audio that still fetches and decodes on the way to
being thrown away (R11), and it would be two gates once Epic 1's lick voice
exists. One gate, at the place both handlers are built, is what makes R11 true by
construction and what makes Epic 1's job one line.

The background warm is gated by the same flag for the same reason. Warming twelve
files for a row that has been switched off is the same fetch R11 forbids, only
earlier — and the `warmed` ref means flipping the switch back on while the groove
plays warms the row then.

### What the card owns, and what Epic 1 owns

`GuessCard.tsx` is the file both epics touch, in different places. This epic owns
**the toggle stack above the chip rows** — a nested `<Stack gap="sm">` holding
`ModeToggle` then `TapSoundsToggle` — **the root row's `adornment`**, and **the
check control below the rows**. Epic 1 owns the mode `ChipGroup`'s props. The
`tapSounds` prop this epic adds is the contract between them: it drives the root
row's mark today and the mode row's mark when Epic 1 lands, and neither epic adds
a second flag.

The caption under the play control lives in `GroovePuzzle.tsx`. This epic lifts
it into two module constants and puts a ternary between them —
`CAPTION_SOUNDS_ON` is the wording Epic 1 will edit, `CAPTION_SOUNDS_OFF` is this
epic's. A two-line seam in one file, which is the whole of the caption
coordination the two epics need.

### Validation goes per field

The stored blob is validated field by field rather than as a whole. Today a blob
whose `simpleMode` is not a boolean resets *everything* to defaults; with two
fields that rule would let one corrupt field erase a good one, which is the
inverse of R7. Per-field validation gives R7 for free — a blob written before
`tapSounds` existed has a good `simpleMode` and no `tapSounds`, so it loads with
simple mode intact and the sounds on — and it keeps every case
`preferences.test.ts` already pins landing where it landed before.

### Waves, in one sentence each

Track A (the store and its two hooks) and Track B (the `Switch` primitive) are
independent of each other and of everything else, so they go first. Track C (the
bigger *Check*) owns `GuessCard.tsx` and has no dependency at all, so it goes
first too — and Track D, which owns the same file, therefore goes second rather
than colliding with it. Track E needs both A's hook and D's props for real, so it
goes third.

## Contracts

Frozen. Tracks build against these rather than against each other.

### C1 — the preference and its store

```ts
// src/features/daily-groove/lib/persistence/preferences.ts

export type Preferences = {
  /** Simple mode: six roots and a major-or-minor second row (E5 R2, R4). */
  simpleMode: boolean
  /**
   * Whether tapping a root or a mode chip sounds. On unless the player turned
   * it off (F16 E2 R2), and a setting rather than a record of the day (R5a).
   */
  tapSounds: boolean
}

export type PreferenceStore = {
  get(): Promise<Preferences>
  /**
   * Merge a subset of the preferences into what is stored, leaving every field
   * the patch does not name exactly as it was found.
   *
   * The whole-object `set` it replaces is gone deliberately: with two fields and
   * two independent writers, a writer that passes a complete object erases the
   * field it has never heard of. A merge makes that unrepresentable rather than
   * something both hooks have to remember (R7).
   */
  update(patch: Partial<Preferences>): Promise<void>
}

export function createLocalPreferenceStore(): PreferenceStore
```

- Defaults: `{ simpleMode: false, tapSounds: true }`.
- Key: `'daily-groove:v1:prefs'`, unchanged. The field is additive and loads
  under the existing version, so no migration and no second key (R7).
- `get()` never throws and never rejects. `update()` never throws and never
  rejects; a failed write resolves `undefined` (R8).

### C2 — the hook

```ts
// src/features/daily-groove/hooks/useTapSounds.ts
import type { PreferenceStore } from '../lib/persistence/preferences'

export type UseTapSounds = {
  /** Whether a chip tap sounds. `true` until the stored value has loaded. */
  tapSounds: boolean
  /** Turn the tap sounds on or off. Never locked by the day being over (R5a). */
  setTapSounds: (on: boolean) => void
  /** The stored preference has been read. */
  loaded: boolean
}

export function useTapSounds(store?: PreferenceStore): UseTapSounds
```

`store` is the injection seam, exactly as `useSimpleMode`'s is: tests hand in a
stand-in rather than `vi.mock`-ing the module path. The default is the same
module-singleton `createLocalPreferenceStore()`.

### C3 — the design-system switch

```ts
// src/components/controls/Switch.tsx

type SwitchProps = {
  /** The visible words, and the control's accessible name. */
  label: string
  checked: boolean
  /** Asked for the state the player wants, not the one they are leaving. */
  onChange(checked: boolean): void
  /** Settled: the browser declines the click, the key press and the focus. */
  disabled?: boolean
}

export function Switch(props: SwitchProps): ReactElement
```

Its markup and every class string are `ModeToggle`'s, moved verbatim. That is
what lets `ModeToggle.test.tsx` pass **untouched** across the extraction — the
existing file is the proof that the treatment survived, so it is not rewritten.

### C4 — the two feature switches

```ts
// src/features/daily-groove/components/puzzle/TapSoundsToggle.tsx
type TapSoundsToggleProps = {
  /** Whether tapping a chip sounds. The prop is the only truth. */
  on: boolean
  onChange(on: boolean): void
}
```

No `disabled`. R5a is structural here rather than a default: a control with no
way to be locked cannot be locked by a later edit. Label: **`Tap sounds`**.

```ts
// src/features/daily-groove/components/puzzle/ModeToggle.tsx — unchanged props
type ModeToggleProps = { simple: boolean; onChange(simple: boolean): void; disabled?: boolean }
```

### C5 — `GuessCard`'s two new props

```ts
// added to GuessCardProps
  /**
   * Whether tapping a chip sounds. Drives the rows' `♪` and nothing else here —
   * the gate itself is in `GroovePuzzle`, where the handlers are built (R11).
   *
   * **Handed to Epic 1 as the contract**: the mode row's adornment reads the
   * same prop, and the mode handler passes through the same gate. Neither epic
   * adds a second flag.
   */
  tapSounds: boolean
  /** Asked for the state the player wants. Never locked by the day (R5a). */
  onToggleTapSounds(on: boolean): void
```

### C6 — the two captions

Frozen strings, because Track E asserts them and the harness carries a copy.

```ts
// src/features/daily-groove/components/GroovePuzzle.tsx — module constants
const CAPTION_SOUNDS_ON =
  'Find the note that feels like home — Play along with your instrument or tap a root to hear it.'
const CAPTION_SOUNDS_OFF =
  'Tap sounds are off — switch them back on under Simple mode.'
```

`CAPTION_SOUNDS_ON` is verbatim what is on screen today, so the harness's
existing `CAPTION` export is unchanged; the harness gains
`CAPTION_SOUNDS_OFF` beside it. Epic 1 owns the on-wording, this epic owns the
off-wording (PRD *Dependencies*).

### C7 — the gate

```ts
// src/features/daily-groove/components/GroovePuzzle.tsx
const hearRoot: (root: Root) => void   // returns immediately when !tapSounds
```

Epic 1's `hearFlavour` is built beside it, reading the same `tapSounds`.

## Tracks

### Track A — Two fields in the store, and the two hooks that write it

- **Goal** — `Preferences` carries `tapSounds`, `PreferenceStore.update` merges,
  a pre-existing blob loads with simple mode intact and the sounds on, and both
  hooks write through the merge.
- **Owns** —
  `src/features/daily-groove/lib/persistence/preferences.ts` and its test,
  `src/features/daily-groove/hooks/useSimpleMode.ts` and its test,
  `src/features/daily-groove/hooks/useTapSounds.ts` and its test, and **one line
  each** in `src/features/daily-groove/components/GroovePuzzle.sounding.test.tsx`
  and `.../GroovePuzzle.guessing.test.tsx` — the `enableSimpleMode` helper's
  `createLocalPreferenceStore().set({ simpleMode: true })`, which becomes
  `.update({ simpleMode: true })`. Those two files are Track E's in Wave 3;
  Track A touches nothing else in them.
- **Role** — `implementer`
- **Depends on** — nothing.
- **Parallel with** — Track B, Track C
- **Done when** — `npm test` is green, including `useSimpleMode.test.ts` with its
  assertions widened from `set` to `update` and nothing else about simple mode
  changed.

The store and both its callers are one track because the seam change ripples
through them atomically: the moment `set` is gone, `useSimpleMode` no longer
typechecks. Splitting them would put a red tree between two waves.

### Track B — The switch, extracted into the design system

- **Goal** — `src/components/controls/Switch.tsx` exists, is tested against its
  own contract with no domain vocabulary anywhere in the file or its test, and is
  registered in the design system's structure test.
- **Owns** — `src/components/controls/Switch.tsx`,
  `src/components/controls/Switch.test.tsx`,
  `src/components/structure.test.ts`
- **Role** — `implementer`
- **Depends on** — nothing. It reads `ModeToggle.tsx` for the markup to move, but
  writes no file in the feature; the rewiring is Track D's.
- **Parallel with** — Track A, Track C
- **Done when** — its own tests pass and `npm test` is green with `ModeToggle`
  still rendering its own copy of the markup. The extraction is additive in this
  wave; nothing is deleted until Track D lands.

### Track C — *Check* comes up to *Play*'s size

- **Goal** — the call to action renders at the play control's size, the longest
  label it can show renders in full, and its three tones stay distinguishable.
- **Owns** — `src/features/daily-groove/components/puzzle/GuessCard.tsx`,
  `src/features/daily-groove/components/puzzle/GuessCard.test.tsx`
- **Role** — `implementer`
- **Depends on** — nothing. `Button` already declares `lg`.
- **Parallel with** — Track A, Track B
- **Done when** — its three cases pass and `npm test` is green.

It owns `GuessCard.tsx` in Wave 1 and Track D owns it in Wave 2, which is the
only reason the two are in different waves: the change is one prop and has no
dependency on anything Track D does. If the lead would rather run one track over
that file, merge C into D and keep the step numbering — nothing else moves.

### Track D — The second switch on the card

- **Goal** — a `Tap sounds` switch sits directly below the simple-mode toggle,
  both toggles are thin callers of `Switch`, the sounds switch stays live when
  the day ends, and the root row's mark follows `tapSounds`.
- **Owns** —
  `src/features/daily-groove/components/puzzle/TapSoundsToggle.tsx` and its test,
  `src/features/daily-groove/components/puzzle/ModeToggle.tsx` (its test is
  **not** edited),
  `src/features/daily-groove/components/puzzle/GuessCard.tsx` and its test,
  `src/features/daily-groove/structure.test.ts`
- **Role** — `implementer`
- **Depends on** — Track B's `Switch`, **real**. Its assertions are the rendered
  switch, and the only way to render one without the primitive is to mock a
  design-system path, which `docs/testing.md` rules out. Also Track C, for the
  file.
- **Parallel with** — nothing in this epic.
- **Done when** — `GuessCard.test.tsx`, `TapSoundsToggle.test.tsx`,
  `ModeToggle.test.tsx` (untouched) and both structure tests pass.

### Track E — The page: the gate, the mark, the caption

- **Goal** — the page reads the preference, gates both the tap and the warm on
  it, hands it to the card, and swaps the caption; every composed acceptance
  criterion is proven through `index.ts`.
- **Owns** — `src/features/daily-groove/components/GroovePuzzle.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.sounding.test.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.guessing.test.tsx`,
  `src/features/daily-groove/testing/puzzleHarness.tsx`
- **Role** — `implementer`
- **Depends on** — Track A's `useTapSounds` **real** (a mocked hook path is a
  mocked internal), and Track D's `GuessCard` props.
- **Parallel with** — nothing in this epic.
- **Done when** — every step below passes, `npm test` is green, and
  `npm run lint` and `npx tsc --noEmit` are clean.

## Execution waves

- **Wave 1 (parallel):** Track A, Track B, Track C — three disjoint file sets.
- **Wave 2:** Track D — needs `Switch` for real, and `GuessCard.tsx` after C.
- **Wave 3:** Track E — needs `useTapSounds` for real and `GuessCard`'s props.
- **Wave 4:** Integration and verification.

**Two scheduling facts for the lead.**

1. **Track A's two one-line edits in the composed test files are not a
   collision.** They land in Wave 1; Track E owns those files in Wave 3. Between
   the two, the helpers read `update({ simpleMode: true })` and nothing else
   about them changes.
2. **Epic 1 must not run Track E concurrently with its own `GroovePuzzle.tsx`
   work.** Both epics add a handler and a caption line to the same component.
   They do not conflict in substance — different handlers, different halves of
   one ternary — so whichever lands second rebases. The roadmap puts all three
   epics in one wave; this is the one file where that needs a hand.

## Implementation

### Track A — Two fields in the store, and the two hooks that write it

#### Step A1 — A player with nothing stored gets the sounds on

Covers: R2, AC2

- **Test first** — `src/features/daily-groove/lib/persistence/preferences.test.ts`:
  replace the `defaults to off when nothing was ever stored` case's expectation
  with `expect(await store.get()).toEqual({ simpleMode: false, tapSounds: true })`.
  Run it: fails with
  `expected { simpleMode: false } to deeply equal { simpleMode: false, tapSounds: true }`.
- **Implement** — `preferences.ts`: add `tapSounds: boolean` to `Preferences`
  with the doc comment from contract C1, and make `defaultPreferences()` return
  `{ simpleMode: false, tapSounds: true }`.
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step A2 — `update` merges, and leaves the other field where it was

Covers: R7, R3

- **Test first** — same file: rewrite the two round-trip cases against `update`,
  and add the merge case that is the point of the method.
  `await store.update({ simpleMode: true })` then
  `expect(await store.get()).toEqual({ simpleMode: true, tapSounds: true })`;
  then `await store.update({ tapSounds: false })` and
  `expect(await store.get()).toEqual({ simpleMode: true, tapSounds: false })` —
  the second write must not have reset the first. Then
  `await store.update({ simpleMode: false })` and expect
  `{ simpleMode: false, tapSounds: false }`. Run it: fails with
  `store.update is not a function`.
- **Implement** — `preferences.ts`: delete `set` from `PreferenceStore` and from
  `createLocalPreferenceStore`, and add
  `async update(patch: Partial<Preferences>) { writePreferences({ ...readPreferences(), ...patch }) }`.
  `readPreferences` is the existing validated read, so a merge onto an absent or
  corrupt blob merges onto the defaults.
- **Green when** — all four expectations pass.
- **Refactor** — none. Do not keep `set` beside `update`: a whole-object writer
  is exactly the erasure R7 forbids, and leaving one on the seam leaves the bug
  one call site away.

#### Step A3 — A blob written before the field existed loads with simple mode intact

Covers: R7, AC7

- **Test first** — same file: `localStorage.setItem('daily-groove:v1:prefs', JSON.stringify({ simpleMode: true }))`,
  then `expect(await createLocalPreferenceStore().get()).toEqual({ simpleMode: true, tapSounds: true })`.
  Add the converse: after `update({ tapSounds: false })` on that same legacy
  blob, `get()` is `{ simpleMode: true, tapSounds: false }` — the new write did
  not drop the field it never wrote. Run it: fails with
  `expected { simpleMode: false, tapSounds: true } to deeply equal { simpleMode: true, tapSounds: true }`,
  because the whole-object validator rejects a blob with no `tapSounds`.
- **Implement** — `preferences.ts`: replace the whole-object shape check in
  `readPreferences` with a per-field one — reject only a non-object, then read
  each field, keeping it when it is a boolean and taking the default when it is
  not.
- **Green when** — both expectations pass.
- **Refactor** — none.

#### Step A4 — A corrupt or wrong-shaped blob still falls back, field by field

Covers: R7, R8

- **Test first** — same file: widen the existing
  `defaults to off when the stored blob is the wrong shape` case so every
  expectation reads `{ simpleMode: false, tapSounds: true }` — `{ nope: true }`,
  `{ simpleMode: 'yes' }`, `['simpleMode']` and `null` all land there. Add
  `{ simpleMode: true, tapSounds: 'no' }` → `{ simpleMode: true, tapSounds: true }`:
  one bad field must not cost the good one. Widen the corrupt-JSON case the same
  way. Run it: the new case fails with
  `expected { simpleMode: false, tapSounds: true } to deeply equal { simpleMode: true, tapSounds: true }`
  if the validator still resets the whole object.
- **Implement** — already done by A3 if the per-field read is right; otherwise
  fix the field the case names.
- **Green when** — every case passes.
- **Refactor** — none.

#### Step A5 — A hostile storage never throws into the UI

Covers: R8

- **Test first** — same file: in the existing hostile-storage block, change the
  write case to
  `await expect(createLocalPreferenceStore().update({ tapSounds: false })).resolves.toBeUndefined()`
  with `setItem` throwing, and keep the `getItem` case with its expectation
  widened to both fields. Add: with `getItem` throwing, `update({ tapSounds: false })`
  still resolves — the merge reads before it writes, and the read is the throw.
  Run it: fails with `store.update is not a function`, then with the thrown
  `SecurityError` escaping if the merge reads outside the existing guard.
- **Implement** — `update` merges onto `readPreferences()`, which already
  swallows a throwing read, and writes through `writePreferences`, which already
  swallows a throwing write. No new try/catch.
- **Green when** — all three cases resolve.
- **Refactor** — none.

#### Step A6 — `useSimpleMode` writes a patch, not a whole object

Covers: R7

- **Test first** — `src/features/daily-groove/hooks/useSimpleMode.test.ts`: change
  `makeStore` to hold `{ simpleMode: false, tapSounds: true }` by default and to
  implement `update` as `saved = { ...saved, ...patch }`; change the two write
  assertions to `expect(store.update).toHaveBeenCalledWith({ simpleMode: true })`
  and `expect(saved()).toEqual({ simpleMode: true, tapSounds: true })`. Add one
  case: with the store holding `{ simpleMode: false, tapSounds: false }`,
  `setSimple(true)` leaves `saved().tapSounds` `false`. Run it: fails with
  `store.set is not a function`.
- **Implement** — `useSimpleMode.ts`: `store.update({ simpleMode: next })` in
  place of `store.set({ simpleMode: next })`. Nothing else in the hook moves.
- **Green when** — every existing case passes with its widened expectation, and
  the new one passes.
- **Refactor** — none. The hook's shape, its optimistic update and its swallowed
  rejection are unchanged, which is what the roadmap asks for.

#### Step A7 — `useTapSounds` starts on and adopts what is stored

Covers: R2, R3, AC2

- **Test first** — `src/features/daily-groove/hooks/useTapSounds.test.ts`: with an
  in-memory store holding the defaults, `result.current.tapSounds` is `true`
  before the load resolves and `true` after `loaded` turns `true`. With a store
  holding `{ simpleMode: false, tapSounds: false }`, it is `false` once loaded.
  Run it: fails with
  `Failed to resolve import "./useTapSounds"`.
- **Implement** — `hooks/useTapSounds.ts`: copy `useSimpleMode`'s structure —
  module-singleton `defaultStore`, `store` parameter, `useState(true)` for the
  value and `useState(false)` for `loaded`, the same unmount-guarded async load
  with the same `react-hooks/set-state-in-effect` disable comment and the same
  reason in it.
- **Green when** — both cases pass.
- **Refactor** — none. Two hooks with one shape rather than a generic
  `usePreference<K>`: the roadmap asks for a hook beside `useSimpleMode`, and a
  generic over a two-field type is more machinery than the second field is worth.

#### Step A8 — Flipping it updates immediately and writes through

Covers: R1, R3, R4

- **Test first** — same file: after `setTapSounds(false)` inside `act`,
  `result.current.tapSounds` is `false`,
  `expect(store.update).toHaveBeenCalledWith({ tapSounds: false })`, and the
  saved blob is `{ simpleMode: false, tapSounds: false }` — `simpleMode`
  untouched. Then `setTapSounds(true)` and assert both directions. Seed the store
  with `{ simpleMode: true, tapSounds: true }` in one case and assert
  `saved().simpleMode` is still `true` afterwards. Run it: fails with
  `expected "spy" to be called with arguments: [ { tapSounds: false } ]`.
- **Implement** — `setTapSounds` sets local state first, then
  `void Promise.resolve(store.update({ tapSounds: on })).catch(() => {})`.
- **Green when** — every assertion passes.
- **Refactor** — none.

#### Step A9 — A store that rejects on write does not cost the player the switch

Covers: R8, AC8

- **Test first** — same file: a store whose `update` throws
  `new Error('QuotaExceededError')`. After `setTapSounds(false)`,
  `result.current.tapSounds` is `false`, and no unhandled rejection is reported.
  Run it: fails with an unhandled rejection if the `.catch` is missing.
- **Implement** — the swallowed `.catch` from A8, with `useSimpleMode`'s comment
  explaining that `createLocalPreferenceStore` already swallows its own failures
  and this guards an injected store that does not.
- **Green when** — the value holds and the suite reports no rejection.
- **Refactor** — none.

#### Step A10 — A load that resolves after unmount sets no state

Covers: R8 (hygiene)

- **Test first** — same file: mirror `useSimpleMode`'s last case — a store whose
  `get` is released manually, unmounted before release, `loaded` still `false`.
  Run it: fails with a React `setState on an unmounted component` warning, or
  with `loaded` `true`.
- **Implement** — the `active` flag in the effect's cleanup, as `useSimpleMode`
  has it.
- **Green when** — the case passes.
- **Refactor** — none.

#### Step A11 — The two composed test helpers seed through the merge

Covers: R7 (caller update)

- **Test first** — none of its own. `npm test` is the test: after A2,
  `GroovePuzzle.sounding.test.tsx` and `GroovePuzzle.guessing.test.tsx` fail to
  compile with
  `Property 'set' does not exist on type 'PreferenceStore'`.
- **Implement** — in each file's `enableSimpleMode` helper, change
  `await createLocalPreferenceStore().set({ simpleMode: true })` to
  `await createLocalPreferenceStore().update({ simpleMode: true })`. One line
  each; touch nothing else in either file.
- **Green when** — `npm test` is green and `npx tsc --noEmit` is clean.
- **Refactor** — none.

### Track B — The switch, extracted into the design system

#### Step B1 — A labelled switch that reports its state

Covers: R13, R14, AC12

- **Test first** — `src/components/controls/Switch.test.tsx`:
  `render(<Switch label="Notifications" checked={false} onChange={vi.fn()} />)`;
  assert `screen.getByRole('switch', { name: /notifications/i })` is in the
  document, that it has `aria-checked="false"`, that `checked` renders
  `aria-checked="true"`, and that it carries `type="button"` so it never submits
  a form. Run it: fails with
  `Failed to resolve import "./Switch" from "src/components/controls/Switch.test.tsx"`.
- **Implement** — `src/components/controls/Switch.tsx`: `'use client'`, the
  `SwitchProps` type from contract C3, and `ModeToggle`'s `<button>` with its
  class string copied character for character — `role="switch"`,
  `aria-checked={checked}`, `disabled`, `onClick={() => onChange(!checked)}`, the
  `flex w-full items-center justify-between gap-3 rounded-control …` base and the
  `disabled ? 'opacity-60' : 'cursor-pointer hover:border-border-strong'` branch.
  The label span keeps `text-[14px] leading-[1.4] text-text-muted` and renders
  `{label}`.
- **Green when** — all four assertions pass.
- **Refactor** — none. Deliberately no `size`, no `tone`, no `id`: one shape, and
  the only two callers want the same one.

#### Step B2 — It reports the state it is asking for and holds none of its own

Covers: R13

- **Test first** — same file: clicking with `checked={false}` calls `onChange`
  with `true`; clicking with `checked` calls it with `false`; clicking twice with
  `checked={false}` calls it with `true` **both** times and leaves
  `aria-checked="false"`. Run it: fails with
  `expected "spy" to be called with arguments: [ true ]` if the button latches
  locally.
- **Implement** — no local state; the handler reads the prop.
- **Green when** — all three pass.
- **Refactor** — none.

#### Step B3 — Keyboard reachable, and operable by space and enter

Covers: R13, AC12

- **Test first** — same file: `await user.tab()` focuses it;
  `await user.keyboard(' ')` calls `onChange(true)`;
  `await user.keyboard('{Enter}')` calls `onChange(true)`. Run it: fails with
  `expected "spy" to be called with arguments: [ true ]` if the element is not a
  native button.
- **Implement** — already a native `<button>`; no keydown handler is added, which
  is the point.
- **Green when** — all three pass.
- **Refactor** — none.

#### Step B4 — The track is decoration, and moves with `checked`

Covers: R14

- **Test first** — same file: `container.querySelector('[aria-hidden="true"]')`
  is not null; its `className` matches `/bg-accent/` when `checked` and
  `/bg-border-strong/` when not; and the accessible name is the label alone, so
  the state is never announced twice
  (`expect(screen.getByRole('switch').textContent).toContain('Notifications')`
  and the accessible name query in B1 still resolves). Run it: fails with
  `expected null not to be null` before the track exists.
- **Implement** — the two nested spans from `ModeToggle`, verbatim, including the
  `left-[21px]` / `left-[3px]` knob positions and the `aria-hidden="true"`.
- **Green when** — both states pass.
- **Refactor** — none.

#### Step B5 — Settled declines the press and drops the affordances; live keeps them

Covers: R14, R5a (by contrast)

- **Test first** — same file: with `disabled`, the button is `toBeDisabled()`, a
  click calls nothing, `await user.tab()` does not focus it, and its `className`
  does not match `/\bcursor-pointer\b/` or `/hover:border-border-strong/` but
  does match `/\bopacity-60\b/`. Without the prop it is enabled, clicks through,
  and carries the two affordances and not `opacity-60`. Run it: fails with
  `expected element to be disabled`.
- **Implement** — the native `disabled` attribute and the class branch, both
  copied from `ModeToggle`. Default `false`.
- **Green when** — both halves pass.
- **Refactor** — none.

#### Step B6 — The design system knows it exists, and it names no domain

Covers: R14

- **Test first** — `src/components/structure.test.ts`: add `'Switch'` to
  `COMPONENTS.controls`. Run it before creating the files and
  `places every component in its role folder beside its own test` fails with
  `expected [ 'controls/Switch.tsx', 'controls/Switch.test.tsx' ] to deeply equal []`;
  run it with the files present and the name missing from the list and
  `has no component file its role folder does not list` fails with
  `expected [ 'controls/Switch' ] to deeply equal []`.
- **Implement** — the list entry, and keep both new files free of `flavour`,
  `groove`, `chord`, `progression`, `bpm`, `streak` and every mode name, and free
  of a `className` or `style` prop — `globals.test.ts` guards I4 and I5 read both
  files from disk. `Notifications` as the test label is chosen for exactly that.
- **Green when** — `src/components/structure.test.ts` and
  `src/app/globals.test.ts` are green.
- **Refactor** — none.

### Track C — *Check* comes up to *Play*'s size

#### Step C1 — The call to action renders at the play control's size

Covers: R15, R18, AC13

- **Test first** — `src/features/daily-groove/components/puzzle/GuessCard.test.tsx`:
  render `<GuessCard {...props({ selectedRoot: 'G', selectedFlavour: 'Dorian', canCheck: true })} />`
  **and** `<PlayControl isPlaying={false} onToggle={vi.fn()} />` from
  `@/components/controls/PlayControl` in the same test. Extract the size-bearing
  classes from each button —
  `const sizeOf = (el: HTMLElement) => (el.className.match(/py-\[\d+px\]|text-\[\d+px\]/g) ?? []).sort()` —
  and assert `sizeOf(check)` equals `sizeOf(play)` and equals
  `['py-[22px]', 'text-[17px]']`. Run it: fails with
  `expected [ 'py-[15px]', 'text-[15px]' ] to deeply equal [ 'py-[22px]', 'text-[17px]' ]`.
- **Implement** — `GuessCard.tsx`: add `size="lg"` to the check `<Button>`. That
  is the whole change; `PlayControl` is not edited by any track in this epic, and
  the literal it is compared against comes from rendering it rather than from a
  copy, so R18 is proven rather than assumed.
- **Green when** — the assertion passes, and `src/components/structure.test.ts`'s
  existing `expect(source).toContain('size="lg"')` pin on `PlayControl` is still
  green.
- **Refactor** — none. The give-up control below keeps the default `md`: it is
  not the call to action, and the PRD's *Out of scope* forbids other hierarchy
  changes.

#### Step C2 — The longest label the control can show renders in full

Covers: R16, AC14

- **Test first** — same file: derive the longest label from the data rather than
  writing it out — take every distinct `flavour` in `GROOVES`, take `ROOTS`, and
  build `Check ${root} ${flavour}` for the longest of each. Assert the longest is
  `'Check E♭ Phrygian dominant'` (26 characters), so a future mode name longer
  than `Phrygian dominant` trips this case rather than a phone. Then render the
  card with that pair selected and assert the button's `textContent` is that
  string exactly, that it lives in a single text node (`button.childNodes` has
  length `1`), and that its `className` matches none of
  `/\btruncate\b/`, `/\btext-ellipsis\b/`, `/\boverflow-hidden\b/`,
  `/\bwhitespace-nowrap\b/` — the label is neither cut nor clipped. Run it: with
  a `Phrygian dominant`-length mode added to the fixture list and no data-derived
  budget, it fails with
  `expected 'Check E♭ Phrygian dominant' to be 'Check E♭ Lydian dominant'`.
- **Implement** — nothing in the component. This step pins the input to the
  layout question; the layout itself is checked in the demo (see *Integration*),
  because jsdom measures no text.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step C3 — Waiting, live and solved still read apart at the larger size

Covers: R17, AC15

- **Test first** — same file: render the card three times — `canCheck: false`
  (idle), `canCheck: true` with both chips chosen (ready), and `solved: true`
  (solved) — and collect the check button's `className` each time. Assert the
  three strings are distinct (`new Set(...).size === 3`), that all three contain
  `py-[22px]`, and that each contains its tone's own token: `bg-surface-inset`,
  `bg-accent`, `bg-accent-soft` respectively. Run it: fails with
  `expected 'bg-surface-inset text-text-faint' to contain 'py-[22px]'` before the
  prop is added.
- **Green when** — all three pass, and the existing label cases
  (`Pick a root and a mode`, `Check …`, `Solved`) are untouched.
- **Refactor** — none.

### Track D — The second switch on the card

#### Step D1 — `TapSoundsToggle` is a switch that says what it switches

Covers: R1, R13, R14, AC12

- **Test first** —
  `src/features/daily-groove/components/puzzle/TapSoundsToggle.test.tsx`:
  `screen.getByRole('switch', { name: /tap sounds/i })` is in the document;
  `aria-checked` is `'true'` with `on` and `'false'` without; a click with
  `on={false}` calls `onChange(true)` and with `on` calls `onChange(false)`;
  clicking twice with `on={false}` calls `onChange(true)` twice, so it latches
  nothing; `await user.tab()` focuses it and space and enter each call
  `onChange(true)`. Run it: fails with
  `Failed to resolve import "./TapSoundsToggle"`.
- **Implement** — `TapSoundsToggle.tsx`: `'use client'`, the props from contract
  C4, and one line of JSX —
  `<Switch label="Tap sounds" checked={on} onChange={onChange} />`, imported from
  `@/components/controls/Switch`. A docstring saying what it governs and what it
  does not: the sounds a root or mode chip makes, never the groove — the play
  control is how the band is silenced (R6).
- **Green when** — every assertion passes.
- **Refactor** — none.

#### Step D2 — It has no way to be locked

Covers: R5a

- **Test first** — same file: read the component's own source from disk —
  `readFileSync(join(process.cwd(), 'src/features/daily-groove/components/puzzle/TapSoundsToggle.tsx'), 'utf8')` —
  and assert it does not match `/^\s{2}disabled\??:/m` and does not contain
  `disabled=`. Run it: fails with `expected '…disabled?: boolean…' not to match …`
  if the prop was copied across from `ModeToggle`. The rule is about a prop that
  cannot exist, not about a default, so it is read from source the way
  `structure.test.ts` reads `PlayControl`'s prop list.
- **Implement** — leave the prop out. `Switch`'s own `disabled` defaults to
  `false`, so the switch is live for the whole day (R5a).
- **Green when** — the assertion passes.
- **Refactor** — none.

#### Step D3 — Both toggles become thin callers of one primitive

Covers: R14

- **Test first** — `src/features/daily-groove/components/puzzle/ModeToggle.test.tsx`
  is **not edited**. It already asserts the role, the name, `aria-checked`, the
  `type="button"`, the keyboard, the disabled behaviour, the track's
  `bg-accent`, and the three affordance classes in both directions. Run it after
  rewiring: it fails the moment any class string differs from what it asserts,
  e.g.
  `expected 'flex w-full items-center …' to match /\bcursor-pointer\b/`.
- **Implement** — `ModeToggle.tsx`: replace the body with
  `<Switch label="Simple mode" checked={simple} onChange={onChange} disabled={disabled} />`,
  keeping the props, the defaults and every line of the docstring that is still
  true; move the markup rationale (why a `role="switch"` rather than a two-chip
  row, why a native button) into `Switch`'s docstring and leave the
  domain reasoning here.
- **Green when** — `ModeToggle.test.tsx` passes untouched. That is the whole
  proof that the extraction preserved the treatment; if a class has to move, the
  extraction is wrong, not the test.
- **Refactor** — delete the copied markup from `ModeToggle.tsx`. Two components
  rendering one primitive is the state R14 asks for.

#### Step D4 — The sounds switch sits directly below the simple-mode toggle

Covers: R1, R14, AC1

- **Test first** — `GuessCard.test.tsx`: add
  `const soundSwitch = () => screen.getByRole('switch', { name: /tap sounds/i })`
  beside the existing `modeSwitch`, and add `tapSounds: true` and
  `onToggleTapSounds: vi.fn()` to the `props()` factory. Assert
  `precedes(modeSwitch(), soundSwitch())`, `precedes(soundSwitch(), rootGroup())`,
  and that the two share a parent —
  `expect(soundSwitch().parentElement).toBe(modeSwitch().parentElement)` — so
  they are one stack rather than two things that happen to be adjacent. Extend
  the existing keyboard case: the visited order is mode switch, then sounds
  switch, then the first root, then the first flavour. Run it: fails with
  `Unable to find an accessible element with the role "switch" and name /tap sounds/i`.
- **Implement** — `GuessCard.tsx`: add the two props from contract C5, and wrap
  `ModeToggle` and a new `TapSoundsToggle` in a `<Stack gap="sm">` above the chip
  rows. `onChange={disarming(onToggleTapSounds)}` — every interactive handler on
  this card goes through `disarming`, and flipping a preference is doing
  something else with the card, so it cancels an armed give-up exactly as the
  mode toggle does.
- **Green when** — all four assertions pass, and every existing `GuessCard` case
  is green with the widened `props()` factory.
- **Refactor** — none.

#### Step D5 — The sounds switch stays live when the day is over

Covers: R5a, AC11b

- **Test first** — same file: with `solved: true`, `modeSwitch()` is
  `toBeDisabled()` and `soundSwitch()` is `toBeEnabled()`; a click on the sounds
  switch calls `onToggleTapSounds` with `false`. Repeat with `revealed: true`.
  Run it: fails with `expected element to be enabled` if the switch was given the
  card's `over`.
- **Implement** — pass no `disabled` to `TapSoundsToggle`. Comment the *why* at
  the call site, because the asymmetry with the line above it is the surprising
  part: the mode is a record of how the day was played and settles with the card,
  and the sounds are a setting the guess card is the only home for (R5a).
- **Green when** — both terminal states pass.
- **Refactor** — none.

#### Step D6 — The mark on the root row follows the preference

Covers: R12, AC11

- **Test first** — same file: with `tapSounds: true`, every root chip's
  `chipAdornment` is `'♪'`; with `tapSounds: false`, every one of them is `null`,
  and the chips' accessible names are unchanged (`chipLabel` still yields the
  twelve roots) — the mark going away must not change what the row offers. Run
  it: fails with `expected '♪' to be null`.
- **Implement** — `GuessCard.tsx`: the root `ChipGroup` takes
  `adornment={tapSounds ? '♪' : undefined}`. `Chip` renders the span only when
  the string is truthy, so `undefined` removes the mark and nothing else.
- **Green when** — both directions pass.
- **Refactor** — none. Leave the mode `ChipGroup` alone: Epic 1 owns its props
  and will read the same `tapSounds`.

#### Step D7 — Flipping it changes nothing else on the card

Covers: R5, AC5

- **Test first** — same file: render with `dots: ['spent','unspent','unspent']`,
  a `ROOT_MATCHED` feedback, `selectedRoot: 'G'`, `selectedFlavour: 'Dorian'` and
  `canCheck: true`. Capture the dot states, the feedback text and the check
  button's accessible name; click the sounds switch; assert all three are
  identical and that `onSelectRoot`, `onSelectFlavour` and `onCheck` were never
  called. Run it: fails with `expected "spy" not to be called` if the switch was
  wired through a selection handler.
- **Green when** — the case passes.
- **Refactor** — none.

#### Step D8 — The feature's structure test names the new component

Covers: R1

- **Test first** — `src/features/daily-groove/structure.test.ts`: add
  `'TapSoundsToggle'` to `REGIONS.puzzle`. Run it with the file on disk and the
  name missing and
  `names every component that exists in a region directory` fails with
  `expected [ 'puzzle/TapSoundsToggle' ] to deeply equal []`; run it with the name
  present and no test file beside the component and
  `places every other component in its region beside its own test` fails with
  `expected [ 'puzzle/TapSoundsToggle.test.tsx' ] to deeply equal []`.
- **Implement** — the list entry, with a one-line comment saying which epic put
  it there, as the other entries carry.
- **Green when** — the feature structure test is green.
- **Refactor** — none.

### Track E — The page: the gate, the mark, the caption

Every case below renders the composed puzzle through `renderPuzzle` or
`renderFeature` and reaches nothing past `index.ts`. Cases about *sound* go in
`GroovePuzzle.sounding.test.tsx`; cases about the *guessing surface* — attempts,
dots, the control — go in `GroovePuzzle.guessing.test.tsx`. That is the grouping
rule documented at the top of `GroovePuzzle.page.test.tsx`.

Two helpers are added to `GroovePuzzle.sounding.test.tsx` beside the existing
ones:

```ts
const soundSwitch = () => screen.getByRole('switch', { name: /tap sounds/i })
const turnSoundsOff = async (user: UserEvent) => { await user.click(soundSwitch()) }
```

and `CAPTION_SOUNDS_OFF` is exported from `testing/puzzleHarness.tsx` with the
frozen string from contract C6.

#### Step E1 — The page reads the preference, and the sounds are on by default

Covers: R1, R2, AC1, AC2

- **Test first** — `GroovePuzzle.sounding.test.tsx`: after `renderPuzzle()`,
  `soundSwitch()` is in the document with `aria-checked="true"`, it sits below
  the simple-mode switch in document order, and a root tap still sounds — the
  existing `selects the tapped root and sounds its note` case is unchanged and
  must stay green. Run it: fails with
  `Unable to find an accessible element with the role "switch" and name /tap sounds/i`.
- **Implement** — `GroovePuzzle.tsx`: call
  `const { tapSounds, setTapSounds } = useTapSounds()` beside `useSimpleMode`,
  and pass `tapSounds={tapSounds} onToggleTapSounds={setTapSounds}` to
  `GuessCard`. Both hooks are called unconditionally, above the `if (!hydrated)`
  return.
- **Green when** — the new case and every existing sounding case pass.
- **Refactor** — none.

#### Step E2 — With the sounds off, a tap selects and fetches nothing

Covers: R9, R11, AC4, AC9, AC10

- **Test first** — same file: `renderPuzzle()`, click the sounds switch off, then
  click the `E♭` root chip. Assert `fetchedNotes()` is `[]`, `fake.sources` has
  length `0`, and the chip has `aria-pressed="true"`. Then click a mode chip and
  assert the same two audio facts and that it is selected — the mode row is
  silent today, so this case is the guard Epic 1 inherits. Run it: fails with
  `expected [ '/notes/note-e-flat.mp3' ] to deeply equal []`.
- **Implement** — `GroovePuzzle.tsx`: build `hearRoot` as contract C7 defines it
  and pass it as `onHearRoot`. The early return is before `playRoot`, so no
  fetch, no decode, no node.
- **Green when** — both halves pass.
- **Refactor** — none. Do not put the check inside `useReferenceNote` or
  `reference.ts`: that is the mute-pretending-to-be-a-setting the PRD names, and
  it would be two gates once Epic 1 lands.

#### Step E3 — Flipping it back on mid-puzzle sounds the next tap

Covers: R4, AC4

- **Test first** — same file: off, tap `E♭` (silent, per E2), click the switch
  back on, tap `E♭` again. Assert `soundSwitch()` is `aria-checked="true"`,
  `fetchedNotes()` is `[noteSrc('E♭')]` and one source started. Nothing was
  remounted: `fake.contexts` still has length at most `1`. Run it: fails with
  `expected [] to deeply equal [ '/notes/note-e-flat.mp3' ]` if the gate latched.
- **Implement** — nothing beyond E2; the handler is rebuilt from the current
  `tapSounds` on every render, which is what makes both directions immediate.
- **Green when** — the case passes.
- **Refactor** — none.

#### Step E4 — The mark goes and comes back on the page

Covers: R12, AC11

- **Test first** — same file: after `renderPuzzle()`, every root chip's
  `chipAdornment` is `NOTE_GLYPH`; after clicking the switch off, every one is
  `null`; after clicking it back on, every one is `NOTE_GLYPH` again, and the
  row still holds twelve chips with the same accessible names throughout. Run it:
  fails with `expected '♪' to be null`.
- **Implement** — nothing beyond D6 and E1; the prop is already flowing.
- **Green when** — all three phases pass.
- **Refactor** — none.

#### Step E5 — The caption says the sounds are off, and how to turn them back on

Covers: R12a, AC11a

- **Test first** — same file: after `renderPuzzle()`, `screen.getByText(CAPTION)`
  resolves. Click the switch off: `screen.queryByText(CAPTION)` is `null` and
  `screen.getByText(CAPTION_SOUNDS_OFF)` resolves. Assert the off caption is
  still the play control's next sibling, still in the same stack, and still
  carries `text-text-muted` and `text-[13px]` — the existing
  `keeps the caption below the control at full width` case's assertions, applied
  to the second wording, so a swap cannot quietly move it. Click the switch back
  on and assert `CAPTION` is back and `CAPTION_SOUNDS_OFF` is gone. Run it: fails
  with
  `Unable to find an element with the text: Tap sounds are off — switch them back on under Simple mode.`
- **Implement** — `GroovePuzzle.tsx`: lift the caption into the two module
  constants from contract C6 and render
  `<Text tone="muted" size="sm">{tapSounds ? CAPTION_SOUNDS_ON : CAPTION_SOUNDS_OFF}</Text>`.
  Add `CAPTION_SOUNDS_OFF` to `testing/puzzleHarness.tsx` beside `CAPTION`, with
  the same "verbatim, and why" docstring the existing constant carries.
- **Green when** — every phase passes and the existing caption cases are green.
- **Refactor** — none. Two constants and one ternary rather than a
  `lib/presentation/` selector: the caption is one sentence with two states, and
  a module for it would be a third place for the two epics to disagree.

#### Step E6 — The groove keeps playing, at the same position

Covers: R6, AC6

- **Test first** — same file: `renderPuzzle()`, `play(user)`,
  `advance(loopFraction(0.5))`, then click the sounds switch. Assert the
  progressbar still reads `aria-valuenow="50"`, the transport still offers
  `Stop the loop`, `fake.sources` has the same length it had before the click,
  and `fake.sources[0].stop` was never called. Flip it back on and assert the
  same four. Run it: fails with
  `expected "stop" to have been called 0 times, but it was called 1 time` if the
  switch reaches the transport.
- **Implement** — nothing. The hook holds its own state and the transport reads
  none of it; this case is the guard that a later edit does not connect them.
- **Green when** — both directions pass.
- **Refactor** — none.

#### Step E7 — Flipping it is not an attempt

Covers: R5, AC5

- **Test first** — `GroovePuzzle.guessing.test.tsx`: render, make one wrong guess
  so a dot is spent and the feedback line has said something, then click the
  sounds switch twice. Assert `dotStates()` is unchanged, the feedback text is
  unchanged, the check control's accessible name is unchanged, and the selected
  root and mode chips are still the ones that were selected. Then check the
  guess that was already staged and assert the attempt count went from one to
  two, not three. Run it: fails with
  `expected [ 'spent', 'spent', 'unspent' ] to deeply equal [ 'spent', 'unspent', 'unspent' ]`
  if flipping the switch reached the session.
- **Implement** — nothing. Same reasoning as E6.
- **Green when** — the case passes.
- **Refactor** — none.

#### Step E8 — It survives a reload

Covers: R3, AC3

- **Test first** — `GroovePuzzle.sounding.test.tsx`: `renderFeature()`, click the
  sounds switch off, `settle()`, `unmount()`, `renderFeature()` again. Assert
  `soundSwitch()` reads `aria-checked="false"`, that the root chips carry no
  mark, and that the off caption is on screen. Assert the keys written are still
  only `['daily-groove:v2:results', 'daily-groove:v1:prefs']`, as the existing
  glyph case does — the second preference must not have opened a second key. Run
  it: fails with `expected "true" to be "false"`.
- **Implement** — nothing beyond Track A; this is the composed proof of A2 and
  A8.
- **Green when** — all four assertions pass.
- **Refactor** — none.

#### Step E9 — A preference written before this switch existed still loads

Covers: R7, AC7

- **Test first** — same file: write the legacy blob directly —
  `localStorage.setItem('daily-groove:v1:prefs', JSON.stringify({ simpleMode: true }))` —
  then `renderFeature()`. Assert the simple-mode switch reads
  `aria-checked="true"` and the mode row offers `Major` and `Minor`, that the
  sounds switch reads `aria-checked="true"`, and that a root tap sounds. Run it:
  fails with `expected "false" to be "true"` while the whole-object validator
  resets a blob with no `tapSounds`.
- **Implement** — nothing beyond A3; this is its composed proof, and the one that
  matters, because AC7 is about the player who already had simple mode on.
- **Green when** — every assertion passes.
- **Refactor** — none.

#### Step E10 — It still works once the day is over

Covers: R5a, AC11b

- **Test first** — same file: seed `mockStore` with a solved `DailyResult` the
  way the existing `stays silent on a day that has been solved` case does, render,
  and assert `soundSwitch()` is enabled while the simple-mode switch is disabled.
  Click it off, `settle()`, and assert the stored blob now reads
  `{ simpleMode: false, tapSounds: false }` via
  `await createLocalPreferenceStore().get()`. Repeat for a revealed day. Run it:
  fails with `expected element to be enabled`.
- **Implement** — nothing beyond D5. The guess card is still rendered once the
  day ends — one row lower — so the switch is still reachable.
- **Green when** — both terminal states pass.
- **Refactor** — none.

#### Step E11 — Nothing is warmed for a row that has been switched off

Covers: R11

- **Test first** — same file: `renderPuzzle()`, click the sounds switch off,
  `play(user)`, `settle()`. Assert `fetchedNotes()` is `[]` — the groove's own
  file is the only thing fetched. Then click the switch back on and assert the
  row warms:
  `await waitFor(() => expect(fetchedNotes()).toHaveLength(NOTES.length))`. Run
  it: fails with `expected 12 to be 0`.
- **Implement** — `GroovePuzzle.tsx`: add `if (!tapSounds) return` to the warm
  effect above the `warmed.current = true` line, and add `tapSounds` to its
  dependency array. The `warmed` ref is what makes the second half true — the
  effect re-runs when the flag changes and warms then.
- **Green when** — both halves pass, and the two existing warm cases
  (`warms the whole row once the groove has decoded, never before` and
  `warms once, not on every press`) are green, since the default is on.
- **Refactor** — none.

## Integration and verification

1. **The tracks meet in Track E's steps.** There is no separate wiring step:
   E1 is the wire-up, and E2–E11 are the epic's composed acceptance criteria.
2. **Run the full suite and the checks around it** — `npm test`,
   `npx tsc --noEmit`, `npm run lint`, `npm run build`. `npm run test:gen` is not
   this epic's tier: no track owns a file under `scripts/grooves/`.
3. **Removability, by inspection.** Nothing was added to
   `src/features/daily-groove/index.ts`, and the only new inbound reference is
   the feature importing `@/components/controls/Switch`. Deleting the feature
   folder and its route still leaves a building app — with one orphaned
   design-system primitive, which is the correct direction for the arrow.

### The demo path, run by hand

- **The switch.** Load `/`. Under *Simple mode* there is a second switch,
  *Tap sounds*, on. Tap roots along the row and hear them. Flip it off: the `♪`
  disappears from the row, the caption under the play control reads
  *Tap sounds are off — switch them back on under Simple mode.*, and tapping
  roots is silent while still selecting them. Press play first and repeat: the
  groove keeps going, at the same place in the bar, through both flips.
- **Durability.** With the sounds off, reload. Still off, still unmarked, still
  the second caption. Open the browser's storage panel and confirm one key,
  `daily-groove:v1:prefs`, holding both fields.
- **Backwards compatibility.** In the console, set that key to
  `{"simpleMode":true}` and reload. Simple mode is on, the sounds are on, and
  nothing was reset.
- **A private window**, where storage may refuse: the switch still moves, still
  takes effect, and no error is shown.
- **After the day ends.** Solve or give up. The simple-mode switch is dimmed and
  inert; the *Tap sounds* switch is not, and flipping it there survives a reload.
- **Keyboard and screen reader**, both switches: tab to each, toggle with space
  and with enter, and hear each announced as a switch with its own name and
  state.
- **The button.** At **360px** wide, with the longest pair the day offers
  selected, *Check …* and *Play the groove* are the same height and the same type
  size, and the label sits on one line. Walk the three states — nothing chosen,
  both chosen, solved — and confirm each reads differently at the larger size.
  Then check **320px**: see the assumption below before treating a wrap there as
  a bug.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A8, D1, D4, D8, E1 |
| R2 | A1, A7, E1 |
| R3 | A2, A7, A8, E8 |
| R4 | A8, E3 |
| R5 | D7, E7 |
| R5a | B5, C4 (contract), D2, D5, E10 |
| R6 | D1 (docstring), E6 |
| R7 | A2, A3, A4, A6, A11, E9 |
| R8 | A5, A9, A10 |
| R9 | E2 |
| R10 | E2 (the mode half — Epic 1 inherits the gate) |
| R11 | E2, E11 |
| R12 | D6, E4 |
| R12a | E5 |
| R13 | B1, B2, B3, D1 |
| R14 | B1, B4, B5, B6, D3, D4 |
| R15 | C1 |
| R16 | C2 |
| R17 | C3 |
| R18 | C1 |
| AC1 | D4, E1 |
| AC2 | A1, A7, E1 |
| AC3 | E8 |
| AC4 | E2, E3 |
| AC5 | D7, E7 |
| AC6 | E6 |
| AC7 | A3, E9 |
| AC8 | A9 |
| AC9 | E2 |
| AC10 | E2 |
| AC11 | D6, E4 |
| AC11a | E5 |
| AC11b | D5, E10 |
| AC12 | B1, B3, D1 |
| AC13 | C1 |
| AC14 | C2 |
| AC15 | C3 |

## Assumptions

- **The field is `tapSounds` and the switch says *Tap sounds*.** Positive
  wording, matching `simpleMode`, where on means the thing named is in effect
  (PRD *Assumptions*). "Tap" rather than "chip" because the player taps; "sounds"
  rather than "sound" because it is the row's noises, not the groove's audio.
- **`set` is removed rather than kept beside `update`.** A whole-object writer on
  a two-field store is the erasure R7 forbids, one call site away. The cost is
  three lines of caller churn (Step A11 and the two hooks), and reversing it is
  adding a method back.
- **Validation goes per field.** The observable behaviour of every case
  `preferences.test.ts` already pins is unchanged; what changes is that one
  corrupt field no longer resets the other. That is what R7 asks for in the case
  it names and what it would want in the case it does not.
- **`useTapSounds` holds `true` before the stored value has loaded.** The default
  is on, so the pre-load value is the default, and the window is one microtask
  wide — shorter than the three-flush hydration gate the puzzle already waits
  behind before it paints a card at all. A player with the sounds stored off
  cannot reach a chip inside it.
- **The narrowest supported width is 360px.** `Check E♭ Phrygian dominant` is
  26 characters; in DM Sans at 17px that is roughly 223px, against 240px of inner
  button width at 360px (360 − 40 page padding − 48 card padding − 32 button
  padding) and 200px at 320px. So it fits on a 360px phone and would wrap on a
  320px one, where at today's 15px it just fits. If 320px has to hold, the fix is
  a shorter label at the base breakpoint, and that is a change to what the
  control says — a PRD question, not something this spec should decide quietly.
  Recorded here rather than as an open question because it is one string to
  change, discovered in a two-minute demo.
- **`ModeToggle.test.tsx` is the extraction's acceptance test.** Rather than
  writing fresh cases for the rewired component, the existing file is required to
  pass untouched. If a class string has to move for it to pass, the extraction is
  wrong.
- **The give-up control keeps the default `md`.** It is not the call to action,
  and the PRD forbids other changes to the page's hierarchy.
- **`disarming` wraps the new switch.** Flipping a preference is doing something
  else with the card, which is the documented way back out of an armed give-up.
- **The warm is gated too.** R11 is written about the tap, but "the switch is a
  setting, not a mute over audio that still loads" is the reason, and twelve
  prefetched files for a silent row is that reason at a different moment.

## Decision log

### Cycle 1 — 2026-09-02

**D1. How do two writers share a one-object store?**
Decision: **replace `PreferenceStore.set(prefs)` with `update(patch)`** — a
read-modify-write on the seam, so round-tripping is a property of the store
rather than a rule each hook has to remember. The alternatives were a
last-read-`Preferences` ref inside each hook (correct, but re-implemented per
hook and wrong the moment a third writer appears) and keeping `set` beside
`update` (which leaves the erasure one call site away).
Changed: contract C1, Steps A2, A5, A6, A8, A11.

**D2. Is the switch extracted into the design system, or copied?**
Decision: **extracted** — `src/components/controls/Switch.tsx`, with both feature
toggles as thin callers. The PRD makes this conditional on the second switch
being a copy of the first, and it is: same shape, same alignment, same treatment,
different words (R14). Copying would put one visual treatment in two files that
drift.
Changed: contract C3, Track B in full, Steps D1 and D3.

**D3. Where does the tap gate live?**
Decision: **in `GroovePuzzle`, where the handler is built** — not in
`useReferenceNote` and not in `reference.ts`. R11 requires that nothing is
fetched or decoded, which a gate inside the voice cannot promise, and Epic 1's
mode handler is built in the same place, so one gate serves both.
Changed: contract C7, Steps E2 and E11, and the contract handed to Epic 1.

**D4. Does the *Check* work wait for the switch work?**
Decision: **no** — it is its own track in Wave 1, and the switch track takes
`GuessCard.tsx` in Wave 2. The two changes are in different parts of the
component and neither depends on the other; serialising them by file ownership
costs nothing and gets the epic's second deliverable moving on day one.
Changed: Tracks C and D, the wave list.

---

**No open questions.** Every architectural decision this epic needs is settled
above; the one judgement call left — the narrowest width the larger label has to
fit — is a string change discovered in the demo, and is recorded as an assumption
rather than held as a question. The spec is ready to implement.
