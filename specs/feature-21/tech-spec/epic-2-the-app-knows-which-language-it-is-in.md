# Tech spec — Epic 2: The app knows which language it is in

PRD: [../prd/epic-2-the-app-knows-which-language-it-is-in.md](../prd/epic-2-the-app-knows-which-language-it-is-in.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

Three files are added and one line changes.

`src/lib/language.ts` is the **pure** half: the supported list, the default, the
`Language` type and `resolveLanguage(raw: string | null): Language` — a plain
function of its argument. No storage, no DOM, no React, and after Q1's answer,
no imports at all. It clears all three absolute bars in
`docs/coding-guidelines.md` §Shared code the way `src/lib/groove.ts` does.

`src/app/language.ts` is the **impure** half: the storage key, and
`readChosenLanguage()`, which pulls the raw string out of `localStorage`, hands
it to `resolveLanguage`, and writes the answer back when it differs from what was
there. The whole defensive shape of
`src/features/daily-groove/lib/persistence/preferences.ts` — try/catch around the
accessor, around `getItem`, around `setItem` — minus the JSON layer, because the
key holds a bare tag.

`src/app/LanguageContext.tsx` is a `'use client'` provider calling that read once
in a `useState` lazy initialiser, plus a hook that throws outside the provider —
`PuzzleSessionContext.tsx`'s shape with one value instead of seven.
`src/app/layout.tsx` wraps `{children}` in it and stays a server component.

Nothing renders from it. R9 is the epic's honest state and this spec gives it a
test: no file under `src/` imports the hook, and that case is the one the
translation feature deletes on its first day.

**The epic is serial, and that is honest.** The `src/app/` half imports the
`src/lib/` half, so it is a second wave. Two build tracks and a verifier is the
whole shape; a third build track would be invented parallelism over roughly 150
lines of code.
## Architecture

```
src/lib/language.ts          PURE — zero imports, no browser API, no React
  SUPPORTED_LANGUAGES · Language · DEFAULT_LANGUAGE · resolveLanguage(raw)
        ▲
        │ resolveLanguage, DEFAULT_LANGUAGE
        │
src/app/language.ts          IMPURE — the storage adapter
  LANGUAGE_STORAGE_KEY · readChosenLanguage()  ──▶  localStorage
        ▲
        │ readChosenLanguage
        │
src/app/LanguageContext.tsx  'use client'
  LanguageProvider · useLanguageContext
        ▲
        │
src/app/layout.tsx           server — metadata, <html lang="en">
  <body><LanguageProvider>{children}</LanguageProvider></body>
        └─ all three entry routes, one mount
```

### Where the split falls, and why it is a seam rather than a compromise

Q1 chose to keep `src/lib/`'s purity bar absolute and move the impurity out. The
line the split falls on is a real one: **the vocabulary of languages is domain
knowledge; where a browser keeps the chosen one is product glue.** The first
would still be true if this app did not exist; the second is a `localStorage` key
this app invented. That is `docs/architecture.md`'s own test for what earns a
place in `src/lib/`, applied rather than argued around.

`src/app/` is where the impure half goes because it is glue by definition, it is
already client/server aware, and it already holds the layout that mounts the
provider. Both files sit flat at `src/app/`, not in a new folder: a folder under
`src/app/` reads as a route segment even when it holds no `page.tsx`, and
`src/app/globals.test.ts`, `src/app/layout.test.ts` and
`src/app/groove/[uuid]/SharedGroove.tsx` are the precedent for non-route files
living beside the routes.

### The repair predicate is `resolved !== raw`, and that is the whole seam

`resolveLanguage` returns only a tag, and the caller writes back exactly when the
tag differs from what it read:

| raw | `resolveLanguage(raw)` | `resolved !== raw` | what `readChosenLanguage` does |
| :-- | :-- | :-- | :-- |
| `null` | `'en'` | true | writes `en`, returns `en` (R4) |
| `'en'` | `'en'` | false | returns `en`, writes nothing (R4/AC3) |
| `'de'`, `'EN'`, `''`, `'{"language":"en"}'` | `'en'` | true | writes `en`, returns `en` (R5) |

No second export, no `{ value, repaired }` envelope, no enum. Step A3 and Step A4
assert the predicate directly, so the pure half carries the whole repair rule and
the impure half carries only the I/O.

### Why the mount covers all three routes

`src/app/layout.tsx` is the only `layout.tsx` in the tree. In the App Router the
root layout wraps every route segment, so the provider mounted around `{children}`
is above `src/app/page.tsx`, `src/app/groove/[uuid]/page.tsx` and
`src/app/groove/not-found.tsx` without any of them naming it. R8 is therefore a
structural property, and Step B5 asserts it as one: one root layout, and no route
file mounting a provider of its own.

### Why the read is a `useState` initialiser

`useState(() => readChosenLanguage())` runs its initialiser exactly once per
mount. `useMemo(…, [])` does not promise that — React may discard and recompute a
memo — and a read in the render body runs on every render, which is what AC6
rules out. The provider renders during SSR too: there `localStorage` does not
exist, `readChosenLanguage`'s own try/catch returns `en`, and nothing is written.
The client's hydration render then runs the initialiser again, reads for real,
and writes.

### Why there is no hydration mismatch, and how that is proven

The provider emits **no DOM node of its own** — it renders `{children}` inside a
context — so its server output and its client output are equal by construction
whatever the two resolutions are. Step B6 proves it the hard way rather than
asserting it: the server pass is rendered with the `localStorage` accessor
throwing (what the server actually sees), the client is then given a real storage
seeded with `de`, and `hydrateRoot` runs with both an `onRecoverableError` spy
and a `console.error` spy. Both stay empty. This technique was run against a
throwaway probe in this tree before the spec was written; it passes.

### The three boundary tests this epic has to clear

- **`src/lib/leaf.test.ts`** globs every file under `src/lib/` and rejects any
  `@/` specifier. `src/lib/language.ts` has **zero import statements**, so it
  passes trivially — and Step A5 asserts that zero directly, the way
  `src/lib/groove.test.ts` already does for `groove.ts`, because zero imports is
  the property the generator depends on.
- **`scripts/grooves/boundary.test.ts` needs no edit, and `src/lib/language.ts`
  must NOT be added to its list.** Its fifth case collects the `src/lib/`
  specifiers that files under `scripts/` *actually import* and asserts set
  equality with exactly five paths (`groove.ts`, `hash.ts`,
  `theory/{names,roots,scales}.ts`). The list is a record of real imports, not an
  allowlist of permitted ones: adding a sixth entry would make the case demand a
  generator import that does not and must not exist, and it would fail. No
  generator file imports the language module, so the set stays at five and the
  file is untouched. Verified green on this tree: 5 tests passed. Step A5 adds
  the same claim from the app side, so AC1a has a witness in the tier this epic
  owns.
- **`scripts/tiers.ts`'s `GENERATOR_IMPORTS`** is untouched for the same reason:
  `src/lib/language.ts` is not a generator import, so edits to it stay app-tier
  and `npm test` is the whole gate.

### What Q1's answer bought

`src/lib/` keeps a bar that means something, and the tests get materially
simpler. `resolveLanguage` is a function of `string | null`, so AC2, AC3, AC4 and
the resolution half of AC5 are plain unit tests with no storage faking at all.
The `Object.defineProperty` accessor swap survives in exactly one step — B2 — and
only for the case that is genuinely about storage throwing.
## Contracts

Frozen. Track B builds against these; changing one mid-flight breaks the wave.

### The pure half — `src/lib/language.ts`

```ts
export const SUPPORTED_LANGUAGES = ['en'] as const

export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const DEFAULT_LANGUAGE: Language = 'en'

/**
 * A function of its argument. No storage, no DOM, no clock.
 * The caller repairs when `resolveLanguage(raw) !== raw`.
 */
export function resolveLanguage(raw: string | null): Language
```

Four exports, and no fifth. The membership predicate stays a module-private
helper: `resolveLanguage` is the only question anyone has today, and a picker's
`isSupportedLanguage` is the picker's feature to add. **The file has zero import
statements.**

### The impure half — `src/app/language.ts`

```ts
export const LANGUAGE_STORAGE_KEY = 'daily-groove:v1:language'

/** Reads, resolves, repairs and writes back. Synchronous. Never throws. */
export function readChosenLanguage(): Language
```

Imports `resolveLanguage` and `type Language` from `@/lib/language`. No
`'use client'` directive — it is a plain module, and the directive belongs on the
component boundary that consumes it.

### The provider — `src/app/LanguageContext.tsx`

```tsx
'use client'

export function LanguageProvider(props: { children: ReactNode }): ReactNode

/** Throws outside <LanguageProvider>. */
export function useLanguageContext(): Language
```

Imports `readChosenLanguage` from `./language` and `type Language` from
`@/lib/language`.

### Fixed across both halves

- The key follows `daily-groove:v1:prefs` and `daily-groove:v2:results`. A bare
  tag, no JSON envelope, no version field. It lives on the `src/app/` side
  because a storage key is product glue, not domain knowledge.
- `LanguageProvider` takes **no** `value` prop. Tests seed real `localStorage`
  rather than injecting — `docs/testing.md`'s rule, and the reason
  `preferences.test.ts` has no mock in it.
- Hook thrown message, exact:
  `useLanguageContext must be used inside <LanguageProvider>`.
- The resolution, split across the seam:

```
resolveLanguage(raw)                      src/lib — pure
  raw === null                → 'en'
  raw ∈ SUPPORTED_LANGUAGES   → raw
  anything else               → 'en'

readChosenLanguage()                      src/app — I/O
  storage unreachable / getItem throws  → DEFAULT_LANGUAGE   (nothing written)
  resolved = resolveLanguage(raw)
  resolved !== raw                      → write resolved
  setItem throws                        → swallowed
  return resolved
```
## Tracks

### Track A — The language vocabulary (pure)

- **Goal** — `src/lib/language.ts` matches the contract, resolves every branch of
  the table, has zero imports, touches no browser API, and is the only place the
  supported set is written down.
- **Owns** — `src/lib/language.ts` (new), `src/lib/language.test.ts` (new)
- **Role** — `implementer`
- **Depends on** — the contract only. Nothing in the repo, and nothing in Epic 1.
- **Parallel with** — nothing in this epic. Parallel with all of Epic 1.
- **Done when** — `npx vitest run --project app src/lib/language.test.ts` is
  green, `src/lib/leaf.test.ts` is green with no edit, and the app suite is
  unmoved otherwise. The two new files have no consumer yet.

### Track B — The storage adapter, the provider and the mount

- **Goal** — `readChosenLanguage` reads, repairs and writes back and never
  throws; the provider resolves once per mount; the hook throws outside it;
  `layout.tsx` mounts it around `children` and stays a server component; all
  three entry routes are under it; nothing consumes the hook; and nothing a
  player can see changes.
- **Owns** —
  `src/app/language.ts` (new),
  `src/app/language.test.ts` (new),
  `src/app/LanguageContext.tsx` (new),
  `src/app/LanguageContext.test.tsx` (new),
  `src/app/layout.language.test.tsx` (new),
  `src/app/layout.tsx` — **two lines only**: the `LanguageProvider` import, and
  the `<body>` line that wraps `{children}`
- **Role** — `implementer`
- **Depends on** — Track A landed. `src/app/language.ts` imports
  `resolveLanguage`, so its tests cannot run red-to-green before that file
  exists.
- **Parallel with** — nothing in this epic.
- **Done when** — all three new test files are green, the eight existing files
  under `src/app/` are green **unedited** (127 cases on this tree), and the four
  gates are clean.

**Why the split is still A/B after Q1 moved the seam.** The question was worth
asking: `resolveLanguage` is pure, and a pure function's consumer can sometimes
be built beside it rather than after it. Not here. `src/app/language.ts` imports
the symbol by name, so its test file cannot even load until `src/lib/language.ts`
exists — the dependency is on a *file*, which is precisely the condition that
forces a later wave. What Q1 did change is the cost: Track A is now ~25 lines and
a test file with no faking in it, so Wave 1 is minutes rather than a stage. A
lead that prefers to hand both tracks to one agent in sequence loses nothing; the
two are kept apart because they own disjoint folders and answer to different
rules — `src/lib/`'s purity bar on one side, the app's client/server split on the
other.

**A three-way split was considered and rejected.** `src/app/language.ts` and
`src/app/LanguageContext.tsx` could be separate tracks, but the provider imports
the adapter, so it would be three waves and three handoffs for no wall-clock
gain across sixty lines.

**The Epic 1 collision rule, in one place.** Epic 1 also edits `src/app/layout.tsx`
— it repoints `APP_NAME`/`TAGLINE` from `@/lib/branding` to the new snippets
path. That is the `import … from "@/lib/branding"` line. Track B touches the
`<body>` line and adds one **relative** import (`./LanguageContext`, the sibling
form `src/app/groove/[uuid]/page.tsx` already uses for `./SharedGroove`); it
changes no existing import and no `metadata` field. Track B also **must not
touch** `src/app/layout.test.ts` or `src/app/page.test.tsx`: both assert the
`@/lib/branding` import that Epic 1 is moving, so every new assertion in this
epic goes in the new `src/app/layout.language.test.tsx` instead. That is why a
new file exists rather than five cases appended to the old one.

### Track C — Verification

- **Goal** — every R and AC traced to a passing case, the four gates clean, and
  the PRD's manual path walked in a real browser where a test cannot reach.
- **Owns** — nothing. Writes no source and no test.
- **Role** — `verifier`
- **Depends on** — Tracks A and B.
- **Parallel with** — nothing.
- **Done when** — `npm test`, `npx tsc --noEmit`, `npm run lint` and
  `npm run build` are clean, the coverage table below is confirmed case by case,
  and the browser walk in C1 is recorded.
## Execution waves

- **Wave 1:** Track A — the pure module, standalone, no consumer.
- **Wave 2:** Track B — the storage adapter, the provider, the mount and the
  route coverage.
- **Wave 3:** Track C — gates, trace, browser walk.

**A note for the lead.** There is no parallelism inside this epic and none was
manufactured. The parallelism the roadmap bought is between Epic 1 and Epic 2,
and it is real: Epic 1 owns thirty components and `src/lib/snippets/`, this epic
owns one new `src/lib/` file, three new `src/app/` files and two lines of
`layout.tsx`. Run them at the same time; run this one's three tracks in order.

`npm test` is the command for every track. No track owns a file under
`scripts/`, so `npm run test:gen` is not this epic's gate — but Track C runs
`scripts/grooves/boundary.test.ts` once as AC1a's second witness.
## Implementation

### Track A — The language vocabulary (pure)

Baseline: `npm test` green; `src/app` is 8 files / 127 cases;
`scripts/grooves/boundary.test.ts` is 5 cases.

Every case in this track is a plain call with a plain argument. There is no
`localStorage`, no `vi.spyOn`, no `Object.defineProperty` and no `render` in the
file — which is the visible dividend of Q1's answer.

#### Step A1 — The surface exists, and the set is written down once

Covers: R1, R2, R3, AC1

- **Test first** — `src/lib/language.test.ts`, new:

  ```ts
  import { readdirSync, readFileSync } from 'node:fs'
  import { join, relative } from 'node:path'
  import {
    DEFAULT_LANGUAGE,
    SUPPORTED_LANGUAGES,
    resolveLanguage,
  } from './language'
  ```

  - `expect(SUPPORTED_LANGUAGES).toEqual(['en'])`
  - `expect(DEFAULT_LANGUAGE).toBe('en')` and
    `expect(SUPPORTED_LANGUAGES).toContain(DEFAULT_LANGUAGE)` — the default is a
    member of the set, not a second opinion about it.
  - `expect(Object.keys(await import('./language')).sort()).toEqual(['DEFAULT_LANGUAGE', 'SUPPORTED_LANGUAGES', 'resolveLanguage'])`
    — the runtime surface is three names and no fourth. `Language` is a type and
    does not appear.
  - **the set is declared once.** Walk every `.ts`/`.tsx` under `src/` and
    `scripts/`, drop `*.test.*` and `*.spec.*`, and keep the files whose source
    matches `/(\bSUPPORTED_LANGUAGES\b\s*[:=])|(\[\s*['"]en['"]\s*\])/`. Assert
    the result is exactly `['src/lib/language.ts']`. Modelled on
    `src/lib/theory/roots.test.ts`'s "declared once" case. Measured on this tree:
    zero files match today, so the case is meaningful rather than vacuous.
- **Run it** — fails with
  `Failed to resolve import "./language" from "src/lib/language.test.ts". Does the file exist?`
- **Implement** — `src/lib/language.ts`: `SUPPORTED_LANGUAGES`, the `Language`
  type, `DEFAULT_LANGUAGE`, and a module-private
  `isSupported(value: string): value is Language` implemented as
  `(SUPPORTED_LANGUAGES as readonly string[]).includes(value)` — the cast is what
  keeps `includes` callable on a tuple type without widening the export.
- **Green when** — every case passes, `npx tsc --noEmit` is clean, and
  `src/lib/leaf.test.ts` still passes (it now scans one more file).
- **Refactor** — none.

#### Step A2 — Nothing stored resolves to the default

Covers: R3, R4, AC2 (the resolution half)

- **Test first** — `expect(resolveLanguage(null)).toBe('en')`, and
  `expect(resolveLanguage(null)).toBe(DEFAULT_LANGUAGE)` — the default is what
  comes back, not a coincidental `'en'`.
- **Run it** — fails at import with
  `SyntaxError: The requested module './language' does not provide an export named 'resolveLanguage'`.
- **Implement** — `resolveLanguage(raw)`: `if (raw === null) return DEFAULT_LANGUAGE`.
- **Green when** — both assertions pass.
- **Refactor** — none.

#### Step A3 — A supported value comes back identically, so nothing needs repairing

Covers: R4, AC3 (the resolution half)

- **Test first** —
  - `expect(resolveLanguage('en')).toBe('en')`
  - `expect(resolveLanguage('en') !== 'en').toBe(false)` — written as the
    predicate, not as an equality, because `resolved !== raw` is the contract the
    `src/app/` half reads and Step B1 depends on.
  - `for (const tag of SUPPORTED_LANGUAGES) expect(resolveLanguage(tag)).toBe(tag)`
    — the rule holds for the whole list, so adding a language does not need this
    case rewritten.
- **Run it** — against an implementation that always returns `DEFAULT_LANGUAGE`,
  the loop passes today by accident but the case is written over
  `SUPPORTED_LANGUAGES`, so it goes red the day a second language is added to a
  resolver that ignores its argument. State that in the case name.
- **Implement** — `if (isSupported(raw)) return raw`.
- **Green when** — all three pass.
- **Refactor** — none.

#### Step A4 — Anything else resolves to the default, and says so

Covers: R5, AC4 (the resolution half)

- **Test first** — one `it.each` over the PRD's examples plus the near misses:
  `'de'`, `'EN'`, `''`, `'en-GB'`, `' en'`, `'fr'`, `'0'`, `'null'`,
  `'{"language":"en"}'`, `'["en"]'`, `'undefined'`.
  For each:
  - `expect(resolveLanguage(raw)).toBe('en')`
  - `expect(resolveLanguage(raw) !== raw).toBe(true)` — the repair predicate
    fires, which is what makes R5 self-healing once Step B1 acts on it.
- **Run it** — fails on the first row with
  `AssertionError: expected 'de' to be 'en'`.
- **Implement** — the final line: `return DEFAULT_LANGUAGE`.
- **Green when** — all eleven rows pass, both assertions each.
- **Refactor** — none.

#### Step A5 — The module is pure, and no generator file imports it

Covers: R1, R1a, AC1a

This step is what Q1's answer bought, so it asserts the bar rather than
describing it. Three cases in `src/lib/language.test.ts`:

- **Test first**
  1. **zero imports.** Read `src/lib/language.ts` from disk and assert
     `expect(source).not.toMatch(/(?m)^\s*(import|export)\s+.*\bfrom\b/)` and
     `expect(source).not.toMatch(/\brequire\s*\(/)` — no specifier of any kind.
     `src/lib/groove.test.ts` asserts the same property of `groove.ts` for the
     same reason: zero imports is what lets the generator resolve a `src/lib/`
     file with no bundler.
  2. **no browser API, no React, no directive.** Assert the source matches none
     of `/\blocalStorage\b/`, `/\bsessionStorage\b/`, `/\bdocument\b/`,
     `/\bwindow\b/`, `/\bnavigator\b/`, `/['"]use client['"]/`, `/\breact\b/i`.
     Name the case for the rule it stands behind:
     `'clears docs/coding-guidelines.md §Shared code: pure, dependency-free, runtime-safe (R1)'`.
  3. **nothing under `scripts/` imports the language module or its adapter.**
     Walk every `.ts` under `scripts/`, collect specifiers with the same three
     regexes `scripts/grooves/boundary.test.ts` uses (`from '…'`, `import('…')`,
     `require('…')`), and assert none contains `src/lib/language`,
     `src/app/language` or `src/app/LanguageContext`. Assert the walk found more
     than 40 files first, so a broken glob cannot pass silently — the guard
     `boundary.test.ts` uses for the same reason.
- **Run it** — case 2 fails against a module that still reads storage, with
  `AssertionError: expected '…' not to match /\blocalStorage\b/`. Cases 1 and 3
  pass against the module as A1–A4 build it; they are guards, and case 3's
  genuine red lives on the generator side in `boundary.test.ts`'s set-equality
  case, which Track C runs.
- **Implement** — nothing. A1–A4's module already satisfies all three.
- **Green when** — all three pass and `npm test` is green overall.
- **Refactor** — none.

### Track B — The storage adapter, the provider and the mount

#### Step B1 — Read, repair, write back — and leave a good value alone

Covers: R4, R5, AC2, AC3, AC4 (the storage half)

No storage faking here. `vitest.setup.ts` installs a working in-memory
`localStorage` and clears it in `beforeEach`, so these cases seed it and read it
back the way `preferences.test.ts` does.

- **Test first** — `src/app/language.test.ts`, new:
  - `expect(LANGUAGE_STORAGE_KEY).toBe('daily-groove:v1:language')`
  - **absent (AC2)** — with storage empty, `readChosenLanguage()` returns `'en'`
    and `localStorage.getItem(LANGUAGE_STORAGE_KEY)` is `'en'` afterwards. A
    second call still returns `'en'` with the key unchanged.
  - **already `en` (AC3)** — seed `'en'`, then
    `const setItem = vi.spyOn(localStorage, 'setItem')`, then read. Returns
    `'en'`, `expect(setItem).not.toHaveBeenCalled()`, key still `'en'`.
    `setItem.mockRestore()` in an `afterEach`.
  - **corrupt (AC4)** — an `it.each` over `'de'`, `'EN'`, `''`, `'en-GB'`,
    `'{"language":"en"}'`, `'["en"]'`: seed, read → `'en'`, key repaired to
    `'en'`. One extra case reads twice with a `setItem` spy and asserts exactly
    **one** write across both calls — the repair happens once, then the value is
    good and the AC3 path takes over.
  - **key isolation** — seed `daily-groove:v1:prefs` with
    `'{"simpleMode":true,"tapSounds":false}'` and `daily-groove:v2:results` with
    `'{"version":2,"byDate":{}}'`, call `readChosenLanguage()` twice, assert both
    strings come back byte-identical. Mirrors preferences.test.ts's "writes under
    its own key, leaving the results envelope alone".
- **Run it** — fails with
  `Failed to resolve import "./language" from "src/app/language.test.ts". Does the file exist?`
- **Implement** — `src/app/language.ts`: the key, and

  ```
  readChosenLanguage()
    raw       = getItem(KEY)                    // inside the try blocks
    resolved  = resolveLanguage(raw)
    if (resolved !== raw) writeLanguage(resolved)
    return resolved
  ```

  with the accessor and `getItem` each in their own `try` returning
  `DEFAULT_LANGUAGE`, exactly as `readPreferences` does, and `writeLanguage`
  wrapping `setItem` in a `try` with an empty `catch` carrying `preferences.ts`'s
  one-line comment. No logging, per the PRD's assumptions.
- **Green when** — every case passes, `npx tsc --noEmit` is clean.
- **Refactor** — none. The `resolved !== raw` line is the whole repair rule and
  needs no branch of its own.

#### Step B2 — Storage that throws, on read and on write

Covers: R6, AC5 (the module half)

This is the **only** step that fakes storage, and only because the case is about
storage failing. The technique, and why it works here:
`vitest.setup.ts` installs its `MemoryStorage` with
`Object.defineProperty(globalThis, 'localStorage', { configurable: true, value })`,
so a case can redefine the property and an `afterEach` can put it back. Capture
the descriptor once at module scope:

```ts
const REAL_STORAGE = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!
afterEach(() => Object.defineProperty(globalThis, 'localStorage', REAL_STORAGE))
```

Safe against the setup file's own reset: its `beforeEach` clears the captured
`MemoryStorage` **instance** directly, not `globalThis.localStorage`, so a
swapped-in fake cannot break it or leak into the next file.

- **Test first** — four cases in `src/app/language.test.ts`, each asserting
  `readChosenLanguage()` returns `'en'` and
  `expect(() => readChosenLanguage()).not.toThrow()`:
  1. **the accessor throws** (private mode):
     `Object.defineProperty(globalThis, 'localStorage', { configurable: true, get() { throw new Error('denied') } })`
  2. **storage is absent**: same, with `value: undefined`.
  3. **`getItem` throws**:
     `{ configurable: true, value: { getItem() { throw new Error('read') }, setItem: vi.fn() } }`
     — and assert `setItem` was never reached.
  4. **`setItem` throws** (quota): a fake whose `getItem` returns `null` and whose
     `setItem` throws. Returns `'en'`, swallows the error, persists nothing.
  Plus one case following the four that asserts a normal read still works, so a
  failed restore cannot hide.
- **Run it** — case 1 fails with `Error: denied` escaping `readChosenLanguage`.
- **Implement** — the try blocks from B1, if B1 left any of them out.
- **Green when** — all five pass.
- **Refactor** — none.

#### Step B3 — The context, the provider, and a hook that throws

Covers: R7, AC6a

- **Test first** — `src/app/LanguageContext.test.tsx`, new:
  - `expect(() => renderHook(() => useLanguageContext())).toThrow(/must be used inside <LanguageProvider>/)`
    — `PuzzleSessionContext.test.tsx`'s first case, one name changed.
  - two `Probe` components under one `<LanguageProvider>` both render `en`, and
    both `useLanguageContext()` reads are `===`.
  - **the provider emits no DOM of its own**:
    `expect(renderToString(<LanguageProvider><p>x</p></LanguageProvider>)).toBe(renderToString(<p>x</p>))`
    (`renderToString` from `react-dom/server`). This is the assertion B6 leans
    on; it belongs here, where the file is written.
- **Run it** — fails with
  `Failed to resolve import "./LanguageContext" from "src/app/LanguageContext.test.tsx". Does the file exist?`
- **Implement** — `src/app/LanguageContext.tsx`: `'use client'` on line 1;
  `createContext<Language | null>(null)`; `LanguageProvider` rendering
  `<Language value={…}>{props.children}</Language>` with the value held as
  `DEFAULT_LANGUAGE` for now — **no storage read yet**, that is B4's red;
  `useLanguageContext()` throwing the contract's exact message on `null`.
- **Green when** — three cases pass.
- **Refactor** — none.

#### Step B4 — The language is resolved once per mount, from storage

Covers: R7, AC6

- **Test first** — same file:
  - **it comes from storage.** With the key absent, mount the provider with a
    probe; the probe reads `'en'` **and** `localStorage.getItem(LANGUAGE_STORAGE_KEY)`
    is `'en'` afterwards — the provider went through `readChosenLanguage`, not
    past it.
  - **once per mount, not per render.** `const getItem = vi.spyOn(localStorage, 'getItem')`,
    then mount a provider whose child holds a counter and re-render it three
    times (a `userEvent.click` on a probe button, plus two
    `rerender()` calls). Assert
    `getItem.mock.calls.filter(([key]) => key === LANGUAGE_STORAGE_KEY)` has
    length **1**.
  - **per app start, not per process.** `unmount()`, mount again, assert the
    filtered count is now **2**. That is what "once per app start" means when a
    reload is a new mount.
- **Run it** — the first case fails with
  `AssertionError: expected null to be 'en'` (B3's provider never writes); the
  second fails with `expected length 1, got 0`.
- **Implement** — replace the constant with
  `const [language] = useState<Language>(() => readChosenLanguage())`. Lazy
  initialiser, not `useMemo` — see *Architecture*.
- **Green when** — all three pass.
- **Refactor** — none.

#### Step B5 — The mount, and every entry route under it

Covers: R7a, R8, AC6b (the source half), AC7

- **Test first** — `src/app/layout.language.test.tsx`, new. **Nothing is added to
  `src/app/layout.test.ts` or `src/app/page.test.tsx`** — see Track B's collision
  rule.

  Source assertions, reading `src/app/layout.tsx` from disk the way
  `layout.test.ts` already does:
  - `expect(source).not.toMatch(/^\s*['"]use client['"]/)` — layout stays a
    server component.
  - `expect(source).toMatch(/export const metadata\s*:\s*Metadata/)` — still
    exports it.
  - `expect(source).toMatch(/import\s*\{[^}]*\bLanguageProvider\b[^}]*\}\s*from\s*["']\.\/LanguageContext["']/)`
  - `expect(source).toMatch(/<LanguageProvider>\s*\{children\}\s*<\/LanguageProvider>/)`
    — the provider wraps `children`, not something narrower.

  Structural assertion for R8:
  - walk `src/app/` for files named `layout.tsx`; assert the result is exactly
    `['src/app/layout.tsx']`. One root layout, therefore one mount above all
    three routes.
  - assert none of `src/app/page.tsx`, `src/app/groove/[uuid]/page.tsx`,
    `src/app/groove/not-found.tsx` names `LanguageProvider` — no route mounts a
    second one.

  Behavioural assertions for AC7, one per entry route, each with storage empty:
  - `render(<LanguageProvider><Home /></LanguageProvider>)` with the existing
    three-microtask `await act` flush from `page.test.tsx`, then
    `expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en')`.
  - the same for `<GrooveNotFound />` from `./groove/not-found`.
  - the same for the shared route, reusing `page.test.tsx`'s pattern:
    `render(await SharedGroovePage({ params: Promise.resolve({ uuid }) }) as ReactElement)`
    inside the provider, with the `vi.mock("next/navigation", …)` `useRouter`
    stub that file already uses (a package mock, not a feature-internal one).
    Take the uuid from the first catalogue groove that is not today's.
- **Run it** — the four source assertions fail; the first with
  `AssertionError: expected '…layout.tsx source…' to match /import\s*\{[^}]*\bLanguageProvider\b…/`.
- **Implement** — `src/app/layout.tsx`, two lines:

  ```tsx
  import { LanguageProvider } from "./LanguageContext";
  …
        <body>
          <LanguageProvider>{children}</LanguageProvider>
        </body>
  ```

  Double quotes and semicolons — that file's local style, not `src/lib`'s.
- **Green when** — the new file is green and the eight existing files under
  `src/app/` pass **unedited** at 127 cases.
- **Refactor** — none.

#### Step B6 — Hydration, with the server and the client disagreeing

Covers: R7a, AC6b (the runtime half)

Labelled honestly: this is a **guard step**. The provider as B3–B4 build it emits
no DOM, so it passes on first run. The case earns its place by failing against
the three wrong implementations someone will reach for later — a provider that
wraps children in a `<div>`, a provider that reads storage in the render body,
and a provider that renders the resolved tag anywhere. The technique below was
run against a probe in this tree and passes; it is not hand-waved.

- **Test first** — in `src/app/LanguageContext.test.tsx`:

  ```
  swap localStorage for a throwing accessor        // what the server sees
  html = renderToString(<LanguageProvider><Probe /></LanguageProvider>)
  restore the real storage; setItem(KEY, 'de')     // client disagrees
  container.innerHTML = html; document.body.append(container)
  recoverable = vi.fn(); errors = vi.spyOn(console, 'error')
  await act(async () => hydrateRoot(container, <LanguageProvider><Probe /></LanguageProvider>,
                                    { onRecoverableError: recoverable }))
  ```

  Assert: `recoverable` not called, `console.error` not called,
  `container.textContent` unchanged by hydration, and the key repaired to `'en'`.
  `act` comes from `react`, `hydrateRoot` from `react-dom/client`. Restore the
  `console.error` spy in the case, and restore the storage descriptor with the
  same captured-descriptor `afterEach` as B2.
- **Run it** — passes against the specified provider. Against a provider that
  wraps children in a `<div>`, fails with
  `AssertionError: expected "error" to not be called at all` and React's
  `Hydration failed because the server rendered HTML didn't match the client`.
- **Implement** — nothing.
- **Green when** — green, and `npm run build` is clean (the `'use client'`
  directive is what keeps `createContext` legal under a server layout; without it
  the build fails with `createContext only works in Client Components`).
- **Refactor** — none.

#### Step B7 — Nothing consumes it, and that is the point

Covers: R9

- **Test first** — in `src/app/LanguageContext.test.tsx`: walk every `.ts`/`.tsx`
  under `src/`, drop `src/app/LanguageContext.tsx` and
  `src/app/LanguageContext.test.tsx`, and assert no remaining file mentions
  `useLanguageContext`. Assert the walk found more than 100 files first.

  Name the case for what it is:
  `'no rendering path reads the language yet (R9) — the translation feature deletes this case'`.
  R9 is the epic's honest state, so it gets a witness rather than a sentence.
- **Run it** — passes on first run; fails the day a component starts reading the
  hook without the resolver behind it, which is exactly the mistake R9 is warning
  about.
- **Implement** — nothing.
- **Green when** — green.
- **Refactor** — none.

#### Step B8 — Nothing a player can see changes

Covers: R10, AC8 (the automated half)

- **Test first** — in `src/app/layout.language.test.tsx`, one case per route for
  `Home` and `GrooveNotFound`. For each, render the route under the provider
  three times, unmounting between, with storage in the three states the PRD
  names — key absent, key `'en'`, key `'de'` — and capture on each pass:
  - `container.textContent`
  - `[...container.querySelectorAll('[aria-label]')].map((el) => el.getAttribute('aria-label'))`

  Assert all three passes are equal. Text and accessible names, not
  `innerHTML` — React attribute ordering and generated ids are not what R10 is
  about, and pinning them would make the case fail on an unrelated refactor.
- **Run it** — passes against a provider that renders nothing from the language;
  fails the moment any rendered string is derived from it.
- **Implement** — nothing.
- **Green when** — green, and the app suite is green overall.
- **Refactor** — none.

### Track C — Verification

#### Step C1 — The gates, the trace, and the walk

Covers: AC9, and the halves of AC1a, AC5 and AC8 a jsdom test cannot reach

- **Run, in order** — `npm test`; `npx tsc --noEmit`; `npm run lint`;
  `npm run build`. Plus `npm run test:gen -- scripts/grooves/boundary.test.ts`
  once, **unedited**, as AC1a's generator-side witness (5 cases, ~0.3s). Confirm
  its set-equality case still lists exactly the five paths and that
  `src/lib/language.ts` is **not** among them — see *Architecture*; adding it
  would be the bug, not the fix.
- **Trace** — every row of the coverage table below to a named passing case.
- **Walk it in a browser** — `npm run dev`, then:
  1. Clear `localStorage`, load `/`. `daily-groove:v1:language` is `en`. Reload:
     still `en`, still one value.
  2. Set the key to `de`, reload. The app renders English and the key is back to
     `en`. Repeat with `""` and `{"language":"en"}`.
  3. Load `/groove/<uuid>` and a dead `/groove/<bad-uuid>` with the key cleared
     first. Both leave `en` behind — AC7 in the real router rather than in a
     test's manual wrapper.
  4. **AC5 for real.** Open a Firefox private window (`dom.storage.enabled` off,
     or Chrome with cookies-and-site-data blocked for localhost) and load `/`.
     The page renders, nothing is persisted, and the console carries no thrown
     error. This is the one AC no jsdom fake can settle.
  5. **AC8 for real.** Play a full session — first visit, how-to-play, a wrong
     guess, the nudge, a lock-in, a solve, a share link, the not-found route —
     with the key present, then absent, then corrupt. Every string identical.
- **Report** — done / partly / not done per AC, with the failing command quoted
  where anything is short. Name the five PRD lines listed under *Assumptions*
  that the split made inaccurate, so the PRD is corrected rather than quietly
  diverged from.
## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A1, A5 |
| R1a | A5, C1 |
| R2 | A1 |
| R3 | A1, A2 |
| R4 | A2, A3, B1 |
| R5 | A4, B1 |
| R6 | B2 |
| R7 | B3, B4 |
| R7a | B5, B6 |
| R8 | B5 |
| R9 | B7 |
| R10 | B8, C1 |
| AC1 | A1 |
| AC1a | A5, C1 |
| AC2 | A2, B1 |
| AC3 | A3, B1 |
| AC4 | A4, B1 |
| AC5 | B2, C1 |
| AC6 | B4 |
| AC6a | B3 |
| AC6b | B5, B6 |
| AC7 | B5, C1 |
| AC8 | B8, C1 |
| AC9 | C1 |

Each of AC2, AC3 and AC4 is split across the seam by design: the pure step proves
the resolution, the `src/app/` step proves the write. Neither alone is the AC.
## Assumptions

Lower-stakes calls made without asking.

- **Both `src/app/` files sit flat, not in `src/app/language/`.** A folder under
  `src/app/` reads as a route segment even when it holds no `page.tsx`, and
  Next.js ignores non-reserved filenames beside the routes —
  `src/app/globals.test.ts` and `src/app/layout.test.ts` already live there and
  build fine.
- **`src/app/LanguageContext.tsx`, PascalCase; `src/app/language.ts`,
  lowercase.** The component file follows `PuzzleSessionContext.tsx` and
  `SharedGroove.tsx`; the plain module follows every other `.ts` in the tree.
- **The hook is `useLanguageContext`, returning `Language` directly**, not a
  `{ language }` object. `usePuzzleSessionContext` returns its value object
  because it carries seven members; this one carries a string, and wrapping it
  buys a field nothing needs. The translation feature can widen the return type
  without moving a call site, because there are none (R9).
- **`resolveLanguage` takes `string | null`, not `unknown`.** `getItem` returns
  exactly that union, and it is the only caller. Widening to `unknown` would add
  a `typeof` branch no caller can reach and a test row for a case that cannot
  happen.
- **`isSupported` stays module-private.** Four exports, not five: a picker's
  membership check is the picker's feature to add, and an unexported helper is
  one less thing to keep true.
- **`DEFAULT_LANGUAGE` is written as the literal `'en'`, not `SUPPORTED_LANGUAGES[0]`.**
  "The default" and "the first supported" are different facts; deriving one from
  the other means adding a language at the front of the list silently changes the
  default. A1 asserts the default is a member of the set instead, which is the
  invariant that actually matters. R2's "only place the set is written down" is
  read as file-level, per AC1's wording.
- **`readChosenLanguage` is synchronous and takes no arguments.** The PRD says
  so; `preferences.ts` is promise-wrapped for a store interface this module does
  not have.
- **No `writeChosenLanguage` is exported.** Nothing can choose a language yet
  (there is no picker, by decision), so an exported writer would be an untested
  public surface. The repair write is internal. The picker's feature adds it.
- **The provider takes no `value` override.** Tests seed real storage, which is
  what keeps them honest about the resolution they claim to test.
- **`npx tsc --noEmit` is the type-check.** `package.json` has no type-check
  script; this is the command the repo's other specs use.
- **`scripts/tiers.ts`'s `GENERATOR_IMPORTS` is not touched**, and neither is
  `scripts/grooves/boundary.test.ts`'s five-path list. Both are records of what
  the generator actually imports; `src/lib/language.ts` is not one of them, and
  adding it would make each assertion false.

### PRD lines the split made inaccurate

Named precisely, for the coordinator to fix in
`prd/epic-2-the-app-knows-which-language-it-is-in.md`. None of them changes what
the epic does; all of them name the wrong file.

1. **R1** — *"`src/lib/language.ts` owns the chosen language. It exports the
   supported languages, the default, and the read that resolves them."* The
   module no longer owns the chosen language or the read. It owns the
   vocabulary and the pure resolution; `src/app/language.ts` owns the chosen
   value. The rest of R1 — that it sits beside `src/lib/snippets/` because the
   app's language must outlive any feature slice — is still exactly right, and is
   the reason the pure half stayed put.
2. **R1a** — the clause *"this is the first module in it that touches a browser
   API"* is now false, and its falseness is the point: no `src/lib/` module
   touches a browser API. The requirement's substance — nothing under `scripts/`
   imports it, `leaf.test.ts` keeps passing, the generator's boundary test proves
   the other direction — holds unchanged.
3. **Scope, bullet 1** — *"`src/lib/language.ts` — one module owning the chosen
   language: the supported list, the default, reading, writing and repairing"*.
   Reading and writing moved; repairing is split (the rule is pure, the write is
   not).
4. **Assumptions, "The provider and its hook live beside the module they read, in
   `src/lib/`. It is the first React file in that folder"** — they live in
   `src/app/`, and `src/lib/` still has no React file. The leaf rule holds for a
   stronger reason than the one given: zero imports, not just no aliased ones.
5. **Behaviour details, the mermaid diagram** — the arrow
   `src/lib/language.ts → localStorage` is now
   `src/app/language.ts → localStorage`, with `src/lib/language.ts` hanging off
   it as the pure resolver.

Also worth a note rather than a fix: **Question log Q1's answer** ("`src/lib/language.ts`,
a sibling of `src/lib/snippets/`") is still the right answer for the half it
describes, and this spec's Decision log records how it was narrowed.

**R2–R10, R7a and every AC read true against the new shape.** AC1 and AC1a name
`src/lib/language.ts` and both still hold of it: the supported list is there and
nothing under `scripts/` imports it.
## Decision log

Settled architectural decisions. The sections above are the source of truth —
this records how they got there, and what each one cost. Append-only.

### Cycle 1 — 2026-09-03

**Q1. `docs/coding-guidelines.md` calls the `src/lib/` purity bar absolute. This
module breaks it. Which gives?**

Decision: **A) Split the module and keep the bar absolute.** `src/lib/language.ts`
keeps the vocabulary — `SUPPORTED_LANGUAGES`, `Language`, `DEFAULT_LANGUAGE` and
`resolveLanguage(raw: string | null): Language` — and satisfies all three
absolute bars: pure, dependency-free (zero imports), runtime-safe. The
`localStorage` read, the storage key and the React provider move to `src/app/`,
which is glue, is already client/server aware, and already holds the layout that
mounts the provider. `docs/coding-guidelines.md` is **not** amended: the bar
stays absolute and the epic stops violating it, which is the whole reason A was
chosen over B (log the deviation) and C (widen the rule).

Why it is a seam and not a compromise: the vocabulary of languages is domain
knowledge that would be true without this product; a `localStorage` key is
product glue this app invented. That is `docs/architecture.md`'s own test for
`src/lib/`, applied.

What it changed:
- *Contracts* — one contract became three. `LANGUAGE_STORAGE_KEY` and
  `readChosenLanguage` moved to `src/app/language.ts`; `resolveLanguage` is new
  and is the pure half's whole behaviour; `isSupportedLanguage` is no longer
  exported.
- *Architecture* — the repair rule is now the predicate `resolved !== raw`,
  computed by the caller. That is what lets the pure half carry the entire
  resolution table with no envelope type and no second export.
- *Tracks* — Track A is now `src/lib/**` only; Track B absorbed the storage
  adapter alongside the provider and the mount. Waves are unchanged, and the
  reason was re-checked rather than assumed: `src/app/language.ts` imports
  `resolveLanguage` **by name**, so its test file cannot load before
  `src/lib/language.ts` exists. A pure dependency is still a file dependency.
- *Implementation* — Track A's old Step A5 (storage that throws) and old Step A6
  (key isolation) are gone from the pure side; A5 is now the purity proof. Track
  B gained two steps at the front (B1 the adapter, B2 the throwing storage) and
  every later step shifted by two.
- *Tests* — materially simpler, which was part of A's case. AC2, AC3, AC4 and the
  resolution half of AC5 are plain calls on `string | null` with no faking. The
  `Object.defineProperty` accessor swap survives in exactly two places, B2 and
  B6, and in both the case is genuinely about storage failing or about the server
  having none.
- *PRD* — five lines now name the wrong file. They are listed precisely under
  *Assumptions → PRD lines the split made inaccurate*. No requirement's substance
  changed.

**One correction to the reasoning that produced the options.** An earlier draft
argued against the split on the grounds that it would leave the translation
feature hunting across two modules. That was wrong, and it is recorded here so it
is not repeated: a resolver needs `resolveLanguage` and `SUPPORTED_LANGUAGES`,
and both are in the pure half. `src/app/language.ts` is a storage adapter a
resolver never touches. The split costs the translation feature nothing.

**The spec is ready to implement. No open questions remain.**
