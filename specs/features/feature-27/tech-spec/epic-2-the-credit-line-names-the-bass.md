# Tech spec — Epic 2: The credit line names where the bass came from

PRD: [../prd/epic-2-the-credit-line-names-the-bass.md](../prd/epic-2-the-credit-line-names-the-bass.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

This epic is one sentence of prose, three links and a count. Its whole difficulty
is that it is **conditional on a value Epic 1 produces**, and that the repo
already carries a guard which goes red the moment Epic 1 lands a CC-BY bass —
`GrooveCard.provenance.test.tsx`, whose case *"was written for exactly the two
attributions the pack declares"* asserts `provenance.attributions.length === 2`.
So this epic is not an optional garnish on Epic 1; it is the fix for the red that
Epic 1's own pack change causes. If the winning library is CC0, that guard never
fires, nothing here is opened, and the epic is dropped.

The work itself is a small generalisation, not a rewrite. `GrooveCard.tsx` today
hard-codes one source URL, one licence label and one licence URL around a
two-key sentence. It becomes a list of credit entries — each with its own linked
words, its own plain-text publisher clause, its own URL and its own licence —
rendered as one paragraph, with the licence links **derived** from the distinct
licences in the list rather than written out. With three libraries all under
CC-BY 4.0 that derivation collapses to the single licence link the PRD's
assumption expects, and if Epic 1's library turns out to be CC-BY 3.0 the second
link appears with no further edit. That is R3 satisfied by shape rather than by
promise.

The strings stay where feature-21 put them. The bass clause is two snippet keys
mirroring `drumCredit` / `drumCreditPublisher` exactly — the linked words in one,
the publisher clause with its leading space in the other — so the component
decides no character of the sentence, and the next language is a folder beside
`en/` rather than a search through `components/`.

## Architecture

### The rendered line

Today, one paragraph, two links:

```
[Drum samples from MuldjordKit and DRSKit,] provided by DrumGizmo.org · [CC BY 4.0]
 └ https://drumgizmo.org                                                 └ …/licenses/by/4.0/
```

After this epic, one paragraph, three links:

```
[Drum samples from MuldjordKit and DRSKit,] provided by DrumGizmo.org
  · [Bass samples from BASS_LIBRARY,] provided by BASS_PUBLISHER
  · [CC BY 4.0]
```

with hrefs, in document order: `https://drumgizmo.org`, `BASS_SOURCE_URL`,
`https://creativecommons.org/licenses/by/4.0/`. One sentence, one `<p>`, still
`mt-auto` at the bottom of the card, still `text-text-faint text-[13px]`, still
after the play control. No footer, no toggle, no per-instrument split.

### The list, and why the licence links are derived

```tsx
type CreditLicence = { label: string; url: string }

type CreditEntry = {
  source: string        // snippet — the words inside the anchor
  publisher: string     // snippet — plain text after the anchor, leading space its own
  url: string           // where that library came from
  licence: CreditLicence
}

const SAMPLE_CREDITS: readonly CreditEntry[]        // drums, then bass
const CREDIT_LICENCES: readonly CreditLicence[]     // distinct by url, order preserved
```

`CREDIT_LICENCES` is computed from `SAMPLE_CREDITS`, never written down:

```ts
const CREDIT_LICENCES = [
  ...new Map(SAMPLE_CREDITS.map((credit) => [credit.licence.url, credit.licence])).values(),
]
```

That single line is what R3 buys. The component no longer *assumes* one licence;
it renders as many as the entries actually carry, and today's three libraries
share one so the reader sees one. It is also what keeps
`GrooveCard.provenance.test.tsx`'s last case — *"links a licence that covers
every licence in the pack"* — honest: that guard walks every non-CC0 row licence
in `provenance.json` and demands the line link it, so a CC-BY 3.0 bass would fail
it under a hard-coded single link and pass under this one after adding a second
entry licence.

The three constants `DRUM_CREDIT_URL`, `DRUM_CREDIT_LICENCE` and
`DRUM_CREDIT_LICENCE_URL` disappear into the list. `CREDIT_LINK`, the anchor's
class string, stays exactly as it is and is shared by all three anchors.

### Where the words live, and what is not a word

Prose goes to `src/lib/snippets/en/puzzle.ts` and is read as `puzzle.<key>` —
`PuzzleSnippets` in `src/lib/snippets/types.ts` gains the two members, and the
`satisfies PuzzleSnippets` on the object is what makes the two files fail
together if only one is edited. No file outside `src/lib/snippets/` may write
`snippets/en` in a specifier; `@/lib/snippets` is the only path the component
writes, and `snippets.test.ts` enforces it by parsing import specifiers.

**URLs and licence identifiers stay in the component.**
[coding-guidelines.md](../../../../docs/coding-guidelines.md) settles this in as
many words — *"glyphs, separators (`' · '`), URLs, licence identifiers, storage
keys, locales and theory names are data, and they stay in the component that uses
them. `HowToPlay.tsx` kept `DRUM_CREDIT_URL` and `'CC BY 4.0'` and gave up only
the sentence beside them."* So `'CC BY 4.0'` and every `https://` literal are
data on this line too, and R5 binds the sentence, not the identifiers. Step A3
puts a source scan behind that boundary so it is a test rather than a habit.

### The condition, and the two places it is decided

R1 is decided twice on purpose, because the two answers have different jobs.

1. **Before anything is dispatched** — the lead reads
   `provenance.attributions.length` off disk. `2` means the bass is CC0, nothing
   is owed, no file in this epic is opened and the epic is reported dropped. `3`
   means it ships. One command, no code, no judgement (Step 0).
2. **In the tree, permanently** —
   `src/features/daily-groove/components/puzzle/GrooveCard.provenance.test.tsx`
   pins the count and is what makes the decision survive the epic. It moves from
   `2` to `3` in Step A4. A fourth CC-BY library later fails that pin with a
   message telling the next reader to rewrite the line and move the count with
   it, which is exactly how this epic found out it had work to do.

Nothing branches at runtime. The credit is static markup either way; the
condition is a build-time decision about whether the epic exists.

### What this epic does **not** own

- `scripts/grooves/samples/pack.json`, `provenance.json` and
  `pack.test.ts` — Epic 1's, all three. In particular
  `pack.test.ts`'s `expect(provenance.attributions!.length).toBe(2)` in the case
  *"owes a second attribution once a second CC-BY library ships"* is **Epic 1's
  line to move**, in the same change that writes the third attribution. If it is
  still red when this epic starts, that is an Epic 1 regression to report, not
  something to repair here (Step 0b).
- `scripts/grooves/samples/README.md`'s **source-and-licence table** and its
  licence line — Epic 1 rewrites those for the new library. This epic owns only
  the ⚠ *attribution obligation* section, and only in Wave 2, after Epic 1's
  README edit is committed. One markdown file, two disjoint sections, two waves.
- Anything about where the credit sits. Quick ticket 9 put it under the groove
  box; the **Footer** candidate in `specs/features.md` stays unclaimed.

## Contracts

### Frozen by Epic 1, the moment the library is chosen

Six values, all readable off the bass rows of
`scripts/grooves/samples/provenance.json` before the catalogue is re-rendered.
They are this epic's whole input, and the roadmap's "parallel with the back half
of Epic 1" is only true once they are written down.

| Token | Where it comes from | Example (today's DRSKit row, for shape) |
| :-- | :-- | :-- |
| `BASS_LIBRARY` | the **first token** of the bass row's `source`, i.e. `source.split(/[\s,(]/)[0]` | `DRSKit` |
| `BASS_SOURCE_URL` | the bass row's `url` | `https://drumgizmo.org/wiki/doku.php?id=kits:drskit` |
| `BASS_ATTRIBUTION` | the bass row's `attribution`, which is also the third entry of `provenance.attributions` | `Ride cymbal samples from DRSKit, provided by DrumGizmo.org` |
| `BASS_PUBLISHER` | the domain inside `BASS_ATTRIBUTION`, matched by `/\b[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.(?:org\|com\|net\|io)\b/` | `DrumGizmo.org` |
| `BASS_LICENCE_LABEL` | the row's `licence`, written the way a reader says it | `CC BY 4.0` |
| `BASS_LICENCE_URL` | the Creative Commons URL for that licence | `https://creativecommons.org/licenses/by/4.0/` |

**Read the third attribution by exclusion, not by index.** `attributions` is the
*sorted* set of distinct strings, so the new one is whichever entry is neither
`'Drum samples provided by DrumGizmo.org'` nor
`'Ride cymbal samples from DRSKit, provided by DrumGizmo.org'`. Its position in
the array is not stable.

**Three constraints this epic places back on Epic 1's provenance row**, because
`GrooveCard.provenance.test.tsx` derives its expectations from that row and will
fail the app otherwise:

- the row's `source` must **begin with the library name as the credit spells it**
  — `libraryOf` takes the first token, and the guard demands the rendered line
  contain it verbatim;
- if `BASS_ATTRIBUTION` names a domain, that domain must appear verbatim in the
  rendered line — the guard extracts publishers from the attribution strings;
- the row's `licence` must be a value the guard can canonicalise to a Creative
  Commons URL (`CC-BY-4.0` → `…/licenses/by/4.0/`), which is what lets the
  licence link's words and its href be checked against each other.

### This epic's own, frozen before Track A starts

```ts
// src/lib/snippets/types.ts — PuzzleSnippets gains exactly two members,
// placed directly after drumCreditPublisher
bassCredit: string           // the words inside the anchor; ends with a comma
bassCreditPublisher: string  // the clause after the anchor; owns its leading space
```

```ts
// src/lib/snippets/en/puzzle.ts
bassCredit: `Bass samples from ${BASS_LIBRARY},`,
bassCreditPublisher: ` provided by ${BASS_PUBLISHER}`,
```

Written out as literals, not composed — `src/lib/snippets/**` is the one place a
sentence is spelled in full, and the templates above show the shape, not the
code. The leading space on `bassCreditPublisher` is part of the contract: the key
owns every character it contributes, so nothing about the sentence is decided in
JSX. The exact wording is CC-BY 4.0 § 3(a)(1)'s discretion, held to the same
standard as `Ride cymbal samples from DRSKit, provided by DrumGizmo.org` — name
the library, name the publisher, and let the licence link carry the licence.

**The composed line, frozen:**

```ts
`${puzzle.drumCredit}${puzzle.drumCreditPublisher} · ${puzzle.bassCredit}${puzzle.bassCreditPublisher} · CC BY 4.0`
```

**The links, frozen, in document order:**

```ts
['https://drumgizmo.org', BASS_SOURCE_URL, 'https://creativecommons.org/licenses/by/4.0/']
```

## Tracks

Two tracks, and the honest reason is not the one it looks like.

**Splitting the snippet from the component would be false parallelism.**
`GrooveCard.test.tsx` asserts against `puzzle.bassCredit`, so a component track
would not even type-check until the snippet track's keys existed. They are one
seam and one track. What the seam still buys is real — a reword is one file, and
the next language is a folder beside `en/` — but it is not a second worker.

The split that *is* real is by test tier and by wave: everything under `src/`
runs `npm test` and can start against the frozen contract while Epic 1 is still
balancing feels; the one paragraph under `scripts/grooves/` runs
`npm run test:gen` and shares a file with Epic 1, so it waits until Epic 1's
README edit is committed.

### Track A — the credit line

- **Goal** — the credit under the groove box names three libraries and two
  publishers as one sentence in one block, every word of it read from
  `@/lib/snippets`, every source linked to its own URL, the licence links derived
  from the entries, and the attribution count pinned at three.
- **Owns** — `src/lib/snippets/en/puzzle.ts`, `src/lib/snippets/types.ts`,
  `src/lib/snippets/snippets.test.ts`,
  `src/features/daily-groove/components/puzzle/GrooveCard.tsx`,
  `src/features/daily-groove/components/puzzle/GrooveCard.test.tsx`,
  `src/features/daily-groove/components/puzzle/GrooveCard.provenance.test.tsx`,
  `src/features/daily-groove/components/intro/HowToPlay.test.tsx`. No other track
  and no other epic writes any of them.
- **Role** — `implementer`. Two snippet keys, a type member each, a list and a
  map in a region component, and four test files. Nothing about it is a musical
  decision, and nothing about it is a decomposition question.
- **Test command** — `npm test`.
- **Depends on** — the six frozen values above, and nothing else. Steps A1–A3 are
  green on their own the moment they are written; A4 is green only once Epic 1's
  `provenance.json` carries the third attribution.
- **Parallel with** — the back half of Epic 1 (balancing, re-rendering,
  sign-offs), which touches no file this track owns.
- **Done when** — `npm test` is green, and `git diff --name-only -- src/` names
  at most those seven files.

### Track B — the attribution obligation, written down

- **Goal** — `scripts/grooves/samples/README.md`'s ⚠ section describes three
  attributions rather than two, names what the bass library owes, and stops
  saying the array's length is a flag a future epic will read — this epic read
  it.
- **Owns** — the ⚠ *attribution obligation* section of
  `scripts/grooves/samples/README.md` (today: *"⚠ The drums and the ride carry an
  attribution obligation, and there are now two of them"* through the paragraph
  ending *"a sample cannot enter the pack without it."*). Epic 1 owns the source
  table and the licence line above it; nothing else in the repo is touched.
- **Role** — `musician`. The repo's rule is by ownership, not by subject: a track
  owning files under `scripts/grooves/` takes the musician. See Assumptions for
  the friction that creates here.
- **Test command** — `npm run test:gen` (`pack.test.ts` reads this README).
- **Depends on** — Epic 1's `provenance.json` **and** Epic 1's README edit, both
  committed. Same file, different section.
- **Parallel with** — nothing. It is one paragraph in Wave 2.
- **Done when** — `npm run test:gen` is green and the section's count agrees with
  `provenance.attributions.length`.

## Execution waves

- **Wave 0 — the gate.** Step 0 and Step 0b, run by the lead. No agent is
  dispatched until they pass.
- **Wave 1:** Track A (Steps A1–A3 against the frozen contract; A4 completes once
  Epic 1's `provenance.json` is on disk).
- **Wave 2:** Track B — needs Epic 1's README edit committed, because it is the
  same file.
- **Wave 3:** Integration and verification.

## Implementation

### Wave 0 — the gate

#### Step 0 — decide whether this epic exists

Covers: R1, AC1

- **Check** — read the count off disk:

  ```bash
  node -p "JSON.parse(require('fs').readFileSync('scripts/grooves/samples/provenance.json','utf8')).attributions.length"
  ```

- **`2`** — the bass library is CC0. Nothing is owed. **Stop.** No file named in
  either track is opened, `git status` stays clean of `src/` and of
  `samples/README.md`, and the epic is reported dropped with the count as its
  evidence. That is AC1 satisfied, not a gap.
- **`3`** — proceed to Step 0b. Record the six frozen values from the bass rows
  before dispatching anything, and read the third attribution **by exclusion**,
  not by index.
- **Anything else** — stop and report. A count of 4 means the pack grew in a way
  neither epic planned for.

#### Step 0b — the tree this epic starts on is green

Covers: R1

- **Check** — `npm run test:gen`. Expect it green.
- **If `samples/pack.test.ts` fails** on
  `expect(provenance.attributions!.length).toBe(2)`, Epic 1 wrote the third
  attribution and did not move its own pin. **Report it to Epic 1 and stop.** It
  is one line in a file this epic does not own, and repairing it here hides an
  Epic 1 gap and creates the cross-epic conflict the ownership split exists to
  prevent.
- Also expect `npm test` to be **red** at exactly three cases in
  `GrooveCard.provenance.test.tsx` — *names every library the pack says must be
  attributed*, *names the publisher the attributions credit*, and *was written
  for exactly the two attributions the pack declares*. That red is this epic's
  work order. If it is green with a count of 3, something has already edited
  Track A's files.

### Track A — the credit line

#### Step A1 — the bass clause is two snippet keys, not a sentence in JSX

Covers: R5, R6, AC5

- **Test first** — `src/lib/snippets/snippets.test.ts`, beside the existing
  feature-22/24 credit cases, which stay **untouched and green** — `drumCredit`
  and `drumCreditPublisher` do not change, and an unedited passing case is the
  proof of it. Add:
  1. a case asserting `snippets.puzzle.bassCredit` is exactly
     `` `Bass samples from ${BASS_LIBRARY},` `` with the real value substituted,
     and that it contains `BASS_LIBRARY`;
  2. a case asserting `snippets.puzzle.bassCreditPublisher` is exactly
     `` ` provided by ${BASS_PUBLISHER}` ``, that
     `bassCreditPublisher.startsWith(' ')` is `true`, and that
     `` `${bassCredit}${bassCreditPublisher}` `` reads
     `Bass samples from BASS_LIBRARY, provided by BASS_PUBLISHER`;
  3. a case asserting the bass library and the bass publisher each appear
     **once** across the joined bass clause —
     `line.split(BASS_LIBRARY)` has length 2 — mirroring the existing *"names the
     publisher once and each kit once"* case;
  4. the existing pin *"holds exactly these keys and no other"* extended with
     `'bassCredit'` and `'bassCreditPublisher'` in sorted position, written out
     in full rather than computed.
- Run it: cases 1–3 fail with `expected undefined to be 'Bass samples from …'`;
  case 4 fails with a `toEqual` diff naming the two keys the object does not
  have.
- **Implement** — `src/lib/snippets/en/puzzle.ts`: add `bassCredit` and
  `bassCreditPublisher` directly after `drumCreditPublisher`.
  `src/lib/snippets/types.ts`: add `bassCredit: string` and
  `bassCreditPublisher: string` to `PuzzleSnippets` in the same position.
- **Green when** — `npm test` green, with every existing drum-credit case passing
  unedited. An existing case that needed editing means the drum sentence moved,
  which this epic has no business doing.
- **Refactor** — none.

#### Step A2 — the credit is a list of entries, each with its own URL and licence

Covers: R2, R3, R6, AC2, AC3

- **Test first** — `src/features/daily-groove/components/puzzle/GrooveCard.test.tsx`,
  in the existing `describe('the drum samples credit')` block:
  1. rename the block to `describe('the sample credits')` and add a case
     asserting the credit paragraph's `textContent` is exactly
     `` `${puzzle.drumCredit}${puzzle.drumCreditPublisher} · ${puzzle.bassCredit}${puzzle.bassCreditPublisher} · CC BY 4.0` ``;
  2. a case asserting `within(paragraph).getAllByRole('link')` has length **3**
     and their hrefs, in document order, are
     `['https://drumgizmo.org', BASS_SOURCE_URL, 'https://creativecommons.org/licenses/by/4.0/']`;
  3. a case asserting the bass library name sits **inside** the bass anchor —
     `screen.getByRole('link', { name: puzzle.bassCredit }).textContent` contains
     `BASS_LIBRARY` — and that `BASS_PUBLISHER` appears in **no** link's
     `textContent` while appearing in the paragraph's, mirroring the existing
     *"leaves the publisher clause outside every link"* case;
  4. extend the existing *"leaves the site safely, and never navigates the app"*
     case to loop over all three links rather than two, asserting `https://`,
     `target="_blank"` and a `rel` containing `noopener` on each.
- Run it: case 1 fails, the paragraph reads
  `Drum samples from MuldjordKit and DRSKit, provided by DrumGizmo.org · CC BY 4.0`;
  case 2 fails with `expected length 2 to be 3`; case 3 fails with
  `Unable to find an accessible element with the role "link" and name "Bass samples from …"`.
- **Implement** — `src/features/daily-groove/components/puzzle/GrooveCard.tsx`:
  replace `DRUM_CREDIT_URL`, `DRUM_CREDIT_LICENCE` and `DRUM_CREDIT_LICENCE_URL`
  with the `CreditLicence` / `CreditEntry` types, the `CC_BY_4_0` constant, the
  two-entry `SAMPLE_CREDITS` list and the derived `CREDIT_LICENCES` from
  *Architecture*. Render the paragraph as one `<Text tone='faint' size='sm'>`
  containing `SAMPLE_CREDITS.map` — a `' · '` before every entry but the first,
  the anchor with `CREDIT_LINK`, then the publisher clause as plain text —
  followed by `CREDIT_LICENCES.map`, each preceded by `' · '`. Keys on the
  fragments are the URLs. `CREDIT_LINK` is unchanged and shared by all three
  anchors.
- **Green when** — the four cases pass **and** the existing cases *"names the
  credit in the exact words the licence requires"*, *"names the licence and links
  to it"*, *"names both kits on the same line, in one link"* and *"stays the
  quietest thing in the card"* all pass unedited: `drumCredit` is untouched, so
  `getByRole('link', { name: SOURCE })` and the single-link-per-kit assertion
  still hold. `GrooveCard.provenance.test.tsx`'s *names every library* and *names
  the publisher* cases go green here too, against Epic 1's real pack.
- **Refactor** — confirm by grep that nothing else in the repo referenced the
  three removed constants (nothing does today; they are module-private).

#### Step A3 — one sentence, one block, and no prose in the component

Covers: R4, R5, AC4, AC5

- **Test first** — `GrooveCard.test.tsx`:
  1. a case asserting the credit is **one** block: every link returned by
     `within(card).getAllByRole('link')` shares the same `closest('p')`, that
     paragraph is the only credit paragraph, and
     `within(paragraph).queryByRole('button')` and
     `paragraph.closest('details')` are both null — R4's "not split per
     instrument family, not hidden behind a toggle" as an assertion rather than a
     promise;
  2. the existing *"is pinned to the bottom edge of the card, after the
     children"* case, unchanged and green — the credit still follows the play
     control, still sits in the `mt-auto` wrapper, still has no sibling after it;
  3. the existing *"renders no such line when it is given none"* case, unchanged
     and green — its `expect(paragraphs).toHaveLength(2)` is what proves the
     credit did not become a second block;
  4. the composed-page case *"puts the two credit links inside the groove card,
     after the play control"*, renamed to *three* and its `hrefs` array extended
     to the three frozen URLs;
  5. a source-scan case, in the shape of the existing *"branches on nothing about
     which page renders it"* case: read `GrooveCard.tsx` from disk, strip
     comments **and every `https://…` string literal**, and assert the remainder
     matches none of `BASS_LIBRARY`, `BASS_PUBLISHER`, `MuldjordKit`, `DRSKit` or
     `provided by`. Licence identifiers are exempt by name, with the guideline
     quoted in the failure message: URLs and licence identifiers are data and
     stay in the component.
- Run it: case 1 fails only if A2 rendered two paragraphs (it should pass — say
  so and keep it, it is a regression pin, not a red step); case 4 fails with a
  two-element `toEqual` diff; case 5 fails if any prose was inlined in A2, and
  passes clean if it was not — **run it once against a deliberately inlined
  `'Bass samples from …'` in the component and watch it fire**, then remove it.
  That is what makes it a test rather than a comment.
- **Implement** — nothing in source if A2 was written to the contract. If case 1,
  4 or 5 fails, the fix is in `GrooveCard.tsx`, not in the test.
- **Green when** — `npm test` green.
- **Refactor** — none.

#### Step A4 — the pack declares three attributions, and the tree says so

Covers: R1, R6, AC1, AC2

- **Test first** —
  `src/features/daily-groove/components/puzzle/GrooveCard.provenance.test.tsx`,
  the case *"was written for exactly the two attributions the pack declares"*:
  rename it to *three*, move `.toBe(2)` to `.toBe(3)`, and reword the failure
  message so it names three as the set the line was written against and still
  tells the next reader to rewrite the line and move the count with it. Leave the
  `FIX` constant, the `libraryOf` / `canonicalLicence` helpers and the other four
  cases exactly as they are — they are already correct for any number of
  libraries, which is why this file survived being right about the problem before
  the problem arrived.
- Run it **before** Epic 1's pack lands: fails with `expected 2 to be 3` and the
  reworded message. Run it after: passes, and it is the last of the file's three
  red cases to go green.
- **Implement** — nothing. The pack is Epic 1's; this step is the count moving to
  meet it.
- **Green when** — all five cases in that file pass, including *reads the pack it
  is meant to be checking*, whose three vacuity guards must still find attributed
  libraries and a readable publisher.
- **Refactor** — none.

#### Step A5 — the how-to-play box still carries no credit, including the new one

Covers: R2, AC6

- **Test first** —
  `src/features/daily-groove/components/intro/HowToPlay.test.tsx`, the case
  *"carries no link — the credit lives on the groove card now"*: widen its regex
  from `/DrumGizmo|CC BY/` to also reject `BASS_LIBRARY` and `BASS_PUBLISHER`,
  and keep `expect(screen.queryAllByRole('link')).toEqual([])` as it is.
- Run it: passes as written — so prove it by pasting `puzzle.bassCredit` into
  `HowToPlay.tsx` once and watching it fail on the new alternative, then revert.
  Without that, the widened regex is a claim about a string nobody has seen fail.
- **Implement** — nothing. `HowToPlay.tsx` is not opened by this epic.
- **Green when** — `npm test` green with `HowToPlay.tsx` unmodified in
  `git status`.
- **Refactor** — none.

### Track B — the attribution obligation, written down

#### Step B1 — the ⚠ section describes three attributions

Covers: R1, R6

- **Test first** — none available, and saying so is better than inventing one.
  This is prose about a count, and the count already has a test:
  `GrooveCard.provenance.test.tsx` pins it at 3 (Step A4) and `pack.test.ts` pins
  the array against the rows (Epic 1). A third assertion here would be a third
  place the number lives. The check is `npm run test:gen` staying green —
  `pack.test.ts` parses tables out of this README — plus reading the section
  against `provenance.attributions`.
- **Implement** — `scripts/grooves/samples/README.md`, the ⚠ section only:
  - the heading's *"and there are now two of them"* becomes three;
  - a paragraph for the bass library beside the MuldjordKit and DRSKit ones,
    quoting `BASS_ATTRIBUTION` as a blockquote the way the other two are quoted,
    and saying whether it is the library's own required string or wording chosen
    under CC-BY 4.0 § 3(a)(1);
  - *"its length is the flag Epic 3 reads to decide whether the app's credit line
    has to grow… It is 2 today"* becomes a statement of fact rather than a
    forecast: the length is 3, feature-27 epic 2 read it and grew the line, and
    `GrooveCard.provenance.test.tsx` is where the app-side pin now lives.
  Leave the source-and-licence table and the licence line alone — Epic 1 owns
  those, and this step runs after they are committed.
- **Green when** — `npm run test:gen` green, and the section's count agrees with
  `provenance.attributions.length`.
- **Refactor** — none.

## Integration and verification

#### Step I1 — the full set

- `npm run lint`, `npx tsc --noEmit`, `npm test`, `npm run test:gen`,
  `npm run build`. All clean.
- `npm run build` runs `prebuild` → `npm run grooves:verify`, which needs Epic
  1's rewritten lock. A `pack-stale` here is an Epic 1 precondition failure, not
  this epic's, and is reported rather than repaired (the same stance Step 0b
  takes).
- `git diff --name-only` names at most Track A's seven files under `src/` and
  `scripts/grooves/samples/README.md`. Anything else is scope this epic invented.

#### Step I2 — the demo path, on a phone

Covers: R4, AC4

- `npm run dev`, open `/`, devtools at **375 px** wide.
- The credit sits under the groove box as one sentence in one muted block, wraps
  across at most three lines, and the play button is still above the fold with no
  scrolling. If it is not, the fix is wording length in
  `src/lib/snippets/en/puzzle.ts` — a shorter bass clause — not a layout change
  here and not a move to a footer.
- Click each of the three links: DrumGizmo's site, the bass library's page, the
  CC BY 4.0 deed. Each opens in a new tab and the app stays where it was.
- jsdom has no layout, so the fold half of AC4 is verified here and nowhere else.
  Step A3 covers the "one sentence, one block, after the play control" half.

#### Step I3 — the removability check

- `docs/architecture.md`'s standard, applied: nothing this epic adds reaches
  outside the slice except the two snippet keys, which live in `src/lib/` where
  app-wide wording belongs and where `src/app/groove/not-found.tsx` already reads
  from. Deleting `src/features/daily-groove/` still leaves a building app; the
  two orphaned keys are dead words, not a broken import.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | 0, 0b, A4, B1 |
| R2 | A2, A5 |
| R3 | A2 |
| R4 | A3, I2 |
| R5 | A1, A3 |
| R6 | A1, A2, A4, B1 |
| AC1 | 0, A4 |
| AC2 | A2, A4 |
| AC3 | A2 |
| AC4 | A3, I2 |
| AC5 | A1, A3 |
| AC6 | A5 |

## Assumptions

- **The bass licence is CC-BY 4.0, so one licence link serves all three.** The
  PRD assumes it and `CREDIT_LICENCES` derives it rather than asserting it: a
  different CC-BY version adds a second entry licence and a second link with no
  other edit. Cheap to reverse.
- **`'CC BY 4.0'` and the three URLs stay in the component.**
  [coding-guidelines.md](../../../../docs/coding-guidelines.md) names licence
  identifiers and URLs as data and names `HowToPlay.tsx`'s `DRUM_CREDIT_URL` and
  `'CC BY 4.0'` as the precedent. If a reviewer wants the label in `en/` instead,
  it is one key plus one line in the key-set pin.
- **Two snippet keys, mirroring the drum pair, rather than one array snippet.**
  `PuzzleSnippets` is flat strings and `snippets.test.ts` pins its key set; an
  array-shaped snippet would complicate both to save one key. The keys are
  `bassCredit` / `bassCreditPublisher` for the same reason the drum pair is split
  — the publisher clause must sit outside the anchor, so it cannot share a key
  with the linked words.
- **Track B takes the `musician` role because it owns a file under
  `scripts/grooves/`, and that is the repo's rule.** It is a poor fit for the
  work — a licence paragraph carries no musical decision, and at implementation
  time a musician track becomes two dispatches. Following the rule and flagging
  the friction is better than carving a one-off exception into it. If the lead
  would rather fold the paragraph into Epic 1's own README edit, this epic drops
  to one track and Wave 2 disappears; nothing in Track A changes either way.
- **The credit line is static markup, not derived from `provenance.json` at
  runtime.** `src/` may not import `scripts/` (zone 5), the manifest generator
  writes no credit data, and generating one would be a fourth place the
  attribution lives. `GrooveCard.provenance.test.tsx` closes the loop at test
  time instead, which is where it has been since feature-24.

## Decision log

No cycles. No architectural question in this epic was expensive enough to
reverse to be worth asking: every call above is one file and one line to undo,
and the two decisions that *would* have been expensive — where the credit sits,
and one sentence versus a per-instrument list — were both settled in the PRD's
Cycle 1 (Q1 A) and in quick ticket 9 before that.
