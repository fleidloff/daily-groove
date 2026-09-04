# Tech spec — Epic 5: The lesson within reach of the loop

PRD: [../prd/epic-5-within-reach-of-the-loop.md](../prd/epic-5-within-reach-of-the-loop.md) ·
Roadmap: [../roadmap.md](../roadmap.md)

## Approach

One conditional appears, in one file. `GroovePuzzle` renders two cards inside a
`Row` that is a single column below `md` and two columns above it, and renders
the box as a sibling *after* that row. The change is a swap inside the row's
**second column**: once the day has ended that column holds the box instead of
the guess card, and the guess card becomes a sibling **after** the row. Document
order becomes groove card → box → guess card at every width, with no CSS
`order`, no positioning, and no change to the groove card at all.

The work that needs care is not the swap; it is the three things it must not
disturb.

1. **The groove card must not move.** It stays column 1's only child, written
   byte-identically, so React reconciles the same element type at the same index
   and keeps the DOM node — and the transport that is sounding through it
   (R1b, AC1b). Every other shape considered here fails on this one point.
2. **The guess card must arrive intact.** Its subtree *is* re-created, which
   R3a sanctions explicitly, so what has to be pinned is that everything it
   renders is still there and its props are unchanged (R3, AC4).
3. **The row must keep exactly two children.** Two existing page tests count
   them, and both still hold unedited — see *What the two existing layout cases
   still say*.

**Why this epic is last.** The roadmap puts it in Wave 3, and there are two
reasons, one of them mechanical. The stated one: there is no point moving the box
before the line worth reading is in it, so the dependency is on Epic 1 being
*shipped*, not on a contract. The mechanical one: Epic 1's Track D, Epic 3 and
Epic 4 all edit `components/GroovePuzzle.tsx` (the panel's props at the call
site) and `components/GroovePuzzle.page.test.tsx` — the exact two files this epic
owns — and Epics 1–4 all edit `components/solved/SolvedPanel.tsx`. So this epic
cannot run in parallel with any of them under the ownership rule, and the wave
order is what resolves it rather than a merge.

One track. It is one component file, one composed test file and two doc comments
in a neighbouring file's pair; a second track would either share
`GroovePuzzle.tsx` — which is what track ownership exists to prevent — or own
nothing. Splitting "write the tests" from "move the JSX" across two agents puts
both in the same two files and buys no parallelism at all.

## Architecture

### The shape after the move

Paths are post-move: Epic 1's Step A0 has landed and the box lives in
`components/solved/SolvedPanel.tsx`.

```
<section aria-label={REGION_LABEL}>          GroovePuzzle
  <Stack gap="xl">                           flex flex-col gap-10
    …header, how-to-play, transport error, shared notice…
    <Row gap="lg" align="start" collapseBelow="md">     flex flex-col md:flex-row items-start gap-7
      <div class="min-w-0 w-full flex-1 md:w-auto">     column 1 — UNCHANGED
        <GrooveCard>…transport, play control, caption…</GrooveCard>
      </div>
      <div class="min-w-0 w-full flex-1 md:w-auto">     column 2 — same wrapper
        {solved || revealed ? (                          NEW conditional
          <Stack gap="lg">
            <SolvedPanel …/>                             MOVED HERE
            {shared && <PlayTodayLink/>}                 MOVED HERE (decision 1)
          </Stack>
        ) : (
          guessCard
        )}
      </div>
    </Row>
    {(solved || revealed) && guessCard}                  MOVED HERE
  </Stack>
</section>
```

Below `md` — Sam's 360px phone — the row is a single column, so the rendered
order is groove card, box, the way onward on a shared groove, then the guess
card. Above `md` the two columns return: the groove card on the left, the box
level with it on the right, and the guess card full width underneath.

Three properties of that sketch are load-bearing:

- **`guessCard` is one element, declared once.** `GuessCard` takes twenty props;
  writing the call site twice is how the two copies drift. It is hoisted to a
  `const` immediately above the `return (`, after the `if (!hydrated)` guard, and
  referenced from both places. The two references are mutually exclusive, so
  exactly one is ever rendered. This is also what makes AC4's "with the same
  props it had inside the row" true by construction rather than by inspection.
- **The guess card gets no wrapper in its new position.** The page `Stack` is
  `flex flex-col` with the default `align-items: stretch`, so a direct child
  spans the full width — which is exactly how the box was full width in its old
  position after the row. No wrapper, no `className`, no new token: the guess
  card inherits the page stack's `xl` gap the box used to get.
- **`Stack gap="lg"`** is the only new wrapper, and it is *inside* the ended
  branch. `Stack` and `Row` take a `Space` token and never a raw length. No
  `className` is introduced anywhere in this epic.

### Decision 1 — `PlayTodayLink` follows the box into the second column

Feature-12 Epic 3's R5a says the invitation "appears **with the answer**", and
its AC14 says it "appears **beside the answer**, linking to `/`". The rule it
also set — "a sibling after the panel rather than a branch inside it" — was about
the panel not knowing what a shared groove is, not about the link being the last
element on the page. Both readings survive if the link moves with the box: it is
still after the panel in document order and still not contained in it, which is
precisely what feature-12's own canary asserts.

**Chosen:** the link is the second child of the ended branch's `Stack`, directly
beneath the box, and its condition simplifies from
`shared && (solved || revealed)` to `shared &&` — the branch it now sits in has
already established the terminal state, so the condition is no longer spelled
twice.

**The cost of the alternative** — leaving the link where it is, after the guess
card:

- The whole finished guess card lands between the answer and the next move, so
  "with the answer" degrades to "somewhere further down the page". At 360px that
  is a full card's scroll; on desktop the link detaches completely — a full-width
  strip at the bottom left while the answer it belongs to is top right.
- On a shared groove the guess card is the least consequential of the three
  panels: a shared play writes nothing (F12 E1 R18–R22), so it is not a record of
  anything. Putting the way onward after it orders the page by the reverse of
  what matters.

**The cost of the chosen option**, stated plainly: the invitation is no longer
the last element on the page, so a reader who scrolls to the bottom lands on the
guess card rather than on the way onward. That is the trade, and it is the right
way round because the invitation is a link, not a redirect — it does not need to
be last to be found, and it does need to be beside the answer to read as the
answer's next move.

Either option keeps `GroovePuzzle.guessing.test.tsx`'s *invites the player to
today once the shared groove is solved (R5a, AC5, AC14)* green unedited: it
asserts the invite **follows** the panel and is **not contained** in it, and both
remain true. That case is this epic's canary for feature-12 and is not to be
touched.

### Decision 2 — the box is one column wide on desktop, as it was before

Say it plainly: **above `md` the box occupies one column of the row — about half
the container — exactly as it did in the shape this spec replaces.** The old shape
put it in column 1 under the groove card; this one puts it in column 2 beside it.
Column width is identical. The rewrite costs nothing here and buys nothing here;
what it buys is vertical position, which is the epic's whole point.

The numbers, so the review has them:

- `Container` is `max-w-[1220px]`; `PageShell` pads `px-5` / `sm:px-10`. At full
  width the content is 1220px, the `Row`'s `gap-7` is 28px, so each column is
  **≈596px** and the box's card interior is a little under that.
- **`ScaleStaff` is drawn at its natural width** with `max-w-full h-auto` — the
  drawing scales down as a whole below that width rather than overflowing. Its
  natural width for a seven-note scale is `LEFT 76 + 6 × ADVANCE 48 + NOTE_RX 8 +
  PAD_RIGHT 24` ≈ **396px**, and the blues scale's shared-step extra lands lower.
  So at 596px it is not scaled at all, and at the narrowest desktop column it
  scales gracefully. Nothing to do.
- **`LeadSheet` is `grid-cols-2 sm:grid-cols-4`** — a 1 × 4 row of bars above
  `sm`. At a 596px column each bar is ≈149px, which reads comfortably for the
  two- and three-character chord symbols the sheet carries.

**The flag, and it is a real one.** `LeadSheet`'s break is on the *viewport* at
`sm` (640px), while the column's width is set by the `Row`'s break at `md`
(768px). Those are the wrong way round for a half-width container: the tightest
1 × 4 the app can produce is at a viewport of exactly 768px, where the content is
688px, each column is ≈330px, and the four bars are **≈78px each** — narrower
than the 2 × 2 bars on a 360px phone, which get ≈155px. The 2 × 2 break would
help there, and only there.

**This epic does not take it.** Three reasons: the condition is not new — the
previous shape put the box in a column too, and so did the box's own design
before this feature; the fix belongs in `LeadSheet.tsx`, which lives in
`components/solved/` and is Epics 1–4's territory, and "any change to the box's
content" is out of scope by the PRD's own list; and the honest fix is a container
query rather than a second viewport breakpoint, because the sheet's problem is
its container's width and not the screen's. It goes in the demo path as an eye
check at ~780px, and if a reviewer wants it fixed it is a follow-up on
`LeadSheet`, not a change to this epic's diff.

### Decision 3 — how the conditional is written so `GrooveCard`'s node is provably stable

AC1b is the one criterion where a correct-looking diff can be wrong, so the rule
is stated as an invariant rather than as a preference.

**The invariant: the only conditional inside the `Row` is inside column 2's
`div`, and it chooses between two *children* of that div. Nothing between the
`Row` and `GrooveCard` is conditional, and column 1's JSX is byte-identical to
today's.**

What React needs, concretely:

- **Same element type at the same index.** The `Row`'s children are two static
  JSX children, so the children array has a fixed length of 2 and fixed
  positions. React reconciles unkeyed children by index: index 0 is a `div` with
  the same `className` before and after, so the host node is kept and its subtree
  is reconciled recursively; `GrooveCard` is the same type at the same position
  with the same props, so its DOM nodes — heading, transport, progress track,
  play control — are all preserved. The transport keeps sounding because nothing
  in that chain unmounts.
- **No `key`, anywhere.** Keys matter when siblings reorder or when a remount is
  wanted; neither applies. A key on either column would be inert, and a key on
  column 1 that *varies* with the terminal state is exactly the remount R1b
  forbids — it is the failure mode to watch for in review, because it looks like
  care. Column 2 needs none either: its child already changes element type
  (`GuessCard` → `Stack`), which remounts it anyway, and that is the cost R3a
  accepts.
- **What is explicitly forbidden**, because each one reaches the same document
  order and breaks something:
  - a ternary around the whole `Row` (`{ended ? <Row>…</Row> : <Row>…</Row>}`) —
    it duplicates the entire groove card call site, which is a drift trap, and
    any difference between the two copies churns the DOM;
  - rendering the row's children from an array — React then wants keys and index
    reconciliation stops being static;
  - a conditional wrapper anywhere in column 1 — a wrapper that appears with the
    terminal state changes the tree depth and remounts the card and its
    transport. This is the mistake the superseded shape had to defend against
    with an unconditional `Stack`; the new shape does not create the hazard at
    all, because column 1 is untouched.

**How it is proved, not asserted.** Step A1 captures three DOM nodes inside the
groove card — the name heading, the play/stop button and the transport's
`progressbar` — before the day ends, and asserts `toBe` on each after. A remount
fails all three in every environment. Note honestly what that does and does not
show: the audio graph is owned by `useTransport` in `GroovePuzzleView`, *above*
the row, so no re-parenting inside the row could re-create it — the node-identity
assertions are what AC1b's "the same node" literally asks for, and the button
still reading `Stop the loop` after the solve is the user-facing continuity
check, implied by the hook's position rather than proved by it.

### What the two existing layout cases still say

The brief's question, answered: **both still hold, unedited.**

- *stacks its columns by default and only splits higher up (D8, R15, AC12)* reads
  the `Row`'s own classes (`flex-col`, no `flex-row`). This epic changes nothing
  about the `Row` element, so the case is untouched by construction.
- *gives each column the full width once stacked (R15)* asserts the row has
  exactly **two** children and that each carries `w-full` and `md:w-auto`. After
  the move the row still has exactly two children, both still wrapped in
  `min-w-0 w-full flex-1 md:w-auto` — only the *content* of the second differs.
  The case also renders mid-puzzle (`renderPuzzle()` with no guess), so it sees
  the groove card and the guess card exactly as it does today.

Because that case never renders a finished day, Step A3's helper restates the two
wrapper-class assertions on the solved page, which is where AC7a needs them.

### The box does not learn where it is

`components/solved/SolvedPanel.tsx` is not edited by this epic, comments
included. The composer knows where the panel goes; the panel does not know where
it is rendered. That is also what keeps this epic off the one file Epics 1–4 all
own.

### What R5, R5a and AC6 can honestly assert

The day ends from the check button or the give-up button, and the app takes both
away as it ends:

- the check `Button` gets `disabled={!canCheck || revealed}` in `GuessCard`, and
  `canCheck` is `false` the moment `solved` flips (feature-11 Epic 4 settles the
  card deliberately);
- the give-up button is behind `showReveal && !revealed`, and `shouldOfferReveal`
  returns `false` once the day is over, so it unmounts.

On top of that, this epic's own re-parenting unmounts the check button's node
(R3a). In jsdom, React removing the focused node moves focus to `document.body`.
So "focus is unchanged" is not a claim this epic can make, and the PRD does not
ask it to: R5 asks that the move take **no focus away that the day's ending had
not already taken**, and AC6 asks that **no other element is focused by the
move**.

The assertable form, and the one Step A1 writes:

- the check control is `disabled` after the solve — named in the case as
  feature-11's behaviour, not this epic's;
- nothing the move placed took focus: `document.activeElement` is not inside the
  box, and is not the play control;
- nothing scrolled: neither `Element.prototype.scrollIntoView` nor
  `window.scrollTo` was called;
- the groove card's nodes are identical, which is the positive claim about what
  the move did *not* disturb.

The negative form of the focus assertion is deliberate. Asserting
`document.activeElement === document.body` would bake the remount in as a
requirement, and a future change that avoided the remount would fail a test for
getting better.

`Element.prototype.scrollIntoView` **is not implemented in jsdom**, so it is
assigned to a `vi.fn()` and restored in a `finally`, not `vi.spyOn`'d —
`vi.spyOn` on a missing method throws. `window.scrollTo` exists and can be
spied.

### What AC5 can honestly assert

AC5 asks for exactly one `role="status"` region for the box. The **page** has
two once the day ends, and the second is not the box: `FeedbackLine` inside
`GuessCard` is a `role="status" aria-live="polite"` paragraph and has been since
feature-3. `ShareGroove` carries an `aria-live` div with no role, and the
transport's error region is a `role="alert"` that exists only after a playback
failure.

So the assertable form of R4 is: the box is exactly one `role="status"` region,
it contains no nested one, the page's live-region count is what it was before the
move — one mid-puzzle, two once the box is in — and no `role="dialog"`,
`aria-modal` or `role="alert"` appears anywhere. That count of two is written
into the case with the reason beside it, rather than an assertion of "one" that
could only pass by deleting the feedback line.

### What AC7 and AC1a can honestly assert

jsdom has no viewport and no stylesheet, so **no test here measures a screen**,
and none is written that pretends to.

- **AC7, horizontal half — assertable.** The box renders between the two cards,
  its column keeps `min-w-0` (which is what stops a flex child being forced wider
  than its column), and the staff keeps `max-w-full`, so the drawings scale down
  instead of overflowing.
- **AC7, vertical half — a target, checked by eye.** "The play control and the
  box's first line on screen together at 360px" is R6's target, not a pass/fail
  criterion, by the PRD's own instruction. It is a demo-path item. Nothing is
  trimmed from another card to buy the room, and the groove card keeps the answer
  feature-12 put on its meta line (R6a, AC10).
- **AC1a — a structural assertion, not a measured one.** "The box's first line
  and the play control share a horizontal band" is produced by two facts a test
  *can* read: the box is the second child of the row, and the row carries
  `items-start` (`Row`'s `align="start"`). Those two are asserted. That the band
  is in fact horizontal on a real screen above `md` follows from `md:flex-row`,
  which the first existing layout case already pins. The case says so in a
  comment, so nobody later mistakes it for a measurement.
- **`getComputedStyle` is deliberately unused** anywhere in this epic: no
  stylesheet is loaded in jsdom, so it reports `static` whatever the classes say.

### The composed test file's case budget

`GroovePuzzle.page.test.tsx` holds **31** cases today. Epic 1's Step D5, Epic 3
and Epic 4 each add one page case, so the expected baseline when this epic starts
is **34**. This epic adds **five**, landing at **39**, under feature-14's ceiling
of **40** — which is the file's own docstring, F14 E2 AC1: *"No file may pass 40
cases."* The ceiling is documented, not lint-enforced, which is a reason to
respect it more carefully rather than less.

**Before writing each case, check the live count:**

```
grep -c '^\s*it(' src/features/daily-groove/components/GroovePuzzle.page.test.tsx
```

If the baseline is above 35, do **not** add a sixth composed file:
`structure.test.ts` lists exactly five composed names and asserts
`GroovePuzzle.test.tsx` is absent. Fold an assertion into the case beside it, as
Step A5 already does. The five cases below are already the folded version — the
transition case (A1) carries what would otherwise have been three cases, and A3
carries what would otherwise have been two.

## Contracts

Nothing new is exported, and no signature changes. What is frozen is the **DOM
shape the assertions read**, because five new cases, two existing layout cases
and one feature-12 canary all depend on it:

```ts
// The row and its two columns, exactly as the existing R15 cases already find
// them. Two children, before and after this epic. Non-negotiable:
// 'gives each column the full width once stacked (R15)' asserts it.
const split = container.querySelector('.md\\:flex-row') as HTMLElement
const columns = Array.from(split.children) as HTMLElement[]

// The box, exactly as this file's existing helper already finds it. Whatever
// Epics 1–4 leave that helper as, this epic uses it unchanged.
const solutionPanel = () =>
  screen.getByRole('heading', { name: 'C Aeolian' })
    .closest('[role="status"]') as HTMLElement
```

Two new helpers, in `GroovePuzzle.page.test.tsx` beside `solutionPanel`, so the
cases assert the same shape the same way:

```ts
/** The row's two columns, exactly as the existing R15 cases find them. */
function columnsOf(container: HTMLElement): HTMLElement[]

/**
 * The ended layout: the box is the row's second column beside the groove card,
 * and the guess card is a later sibling of the row (F15 E5 R1, R1a, R3, R7,
 * AC1, AC1a, AC4, AC7, AC7a). Only the three cases that assert the new
 * placement call this — the guards in A1 and A2 must pass *before* the move, so
 * they use `columnsOf` and never this.
 */
function expectEndedLayout(container: HTMLElement): void
```

`GroovePuzzle.page.test.tsx` already imports `CAPTION`, `chipLabel`, `control`,
`dotStates`, `flavourGroup`, `GROOVE`, `guess`, `installPuzzleAudio`, `miss`,
`nudge`, `otherWrongFlavour`, `play`, `renderPuzzle`, `resetMockStore`,
`rootGroup`, `settle`, `SOLVING`, `teardownPuzzleAudio`, `TODAY` and
`wrongFlavour` from the harness, plus `renderFeature` from
`../testing/renderFeature` and `APP_NAME` from `@/lib/branding`. Step A3
additionally needs **`flavours`** added to the harness import list, to compare
the chip count against the fixture's own flavour set rather than a literal.

Frozen for this epic:

- `SolvedPanelProps` is untouched. The `<SolvedPanel … />` element moves
  **verbatim, props included** — whatever props Epics 1 and 4 leave on it are not
  this epic's business.
- `Row` keeps exactly two children, both `min-w-0 w-full flex-1 md:w-auto`.
- Column 1 — the `div` and the whole `GrooveCard` call site inside it — is
  byte-identical after the change.
- `GuessCard`'s props are byte-identical; only the JSX's location changes, and it
  is hoisted to a `const` so there is exactly one copy of it.
- `PlayTodayLink` keeps feature-12's relationship to the box: after it in
  document order, never inside it, and still only on a shared groove.
- `components/solved/**` is not edited, `components/puzzle/GuessCard.tsx` is not
  edited, `components/puzzle/PlayTodayLink.tsx` is not edited, and
  `structure.test.ts` is not edited.

## Tracks

### Track A — The box takes the second column

- **Goal** — once the day has ended, the box renders as the row's second child
  beside the groove card, with the way onward beneath it on a shared groove, and
  the guess card renders intact as a sibling after the row; the groove card's DOM
  nodes are the same nodes across the transition; mid-puzzle order, the
  live-region count and the scroll position are exactly as they are today; and
  the comments that describe the old position describe the new one.
- **Owns** —
  `src/features/daily-groove/components/GroovePuzzle.tsx`,
  `src/features/daily-groove/components/GroovePuzzle.page.test.tsx`,
  `src/features/daily-groove/components/puzzle/GrooveCard.tsx` (one doc-comment
  paragraph, no code),
  `src/features/daily-groove/components/puzzle/GrooveCard.test.tsx` (one
  comment, no assertions — see Step A6 and the assumption that flags it)
- **Must not touch** — `src/features/daily-groove/components/solved/**` (Epics
  1–4's territory — which since Epic 1's Step A0 is where `SolvedPanel`,
  `LeadSheet` and `ScaleStaff` all live), `components/puzzle/GuessCard.tsx`,
  `components/puzzle/PlayTodayLink.tsx`, `structure.test.ts`, the other four
  composed test files
- **Role** — `implementer`. The epic is a placement change with its guards: the
  tests and the JSX are the same two files and the same reasoning, and the tests
  that must pass *before* the change only mean anything to whoever writes the
  change.
- **Depends on** — Epics 1–4 **shipped**. Epic 1's Step A0 must have moved the
  box to `components/solved/`, and Epics 1, 3 and 4 must have finished with
  `GroovePuzzle.tsx`'s call site and `GroovePuzzle.page.test.tsx`. No contract
  dependency — this epic codes against no new signature.
- **Parallel with** — nothing. A second track would have to share
  `GroovePuzzle.tsx`, which is the one thing ownership forbids.
- **Done when** — the five new cases and the extended mid-puzzle case pass;
  `npm test`, `npm run lint`, `npx tsc --noEmit` and `npm run build` are green;
  `GroovePuzzle.page.test.tsx` is at 40 cases or fewer; and no test in
  `GroovePuzzle.guessing.test.tsx`, `GroovePuzzle.sounding.test.tsx`,
  `GuessCard.test.tsx` or `structure.test.ts` was edited to make them pass.

## Execution waves

- **Wave 1:** Track A — alone, after Epics 1–4 have landed.
- **Wave 2:** Integration and verification (Step I1).

There is no second wave of work to parallelise. The epic is one file's diff and
its guards.

## Implementation

### Track A — The box takes the second column

All test paths below are
`src/features/daily-groove/components/GroovePuzzle.page.test.tsx`; the one source
path is `src/features/daily-groove/components/GroovePuzzle.tsx` unless named
otherwise. The suite command is `npm test`.

**Order matters here.** A1 and A2 are the guards: they must be written and green
*before* the JSX changes, because they are the constraints on how A3 is written.
A3 is the red step.

#### Step A1 — The loop keeps sounding, is announced once, and nothing moves under the finger

Covers: R1b, R3a, R4, R5, R5a, R5b, AC1b, AC5, AC6, AC9

This is one case rather than three because it is one transition, and because the
file's case budget is real. It is the epic's most important case: AC1b is the
criterion a plausible-looking diff can silently break.

- **Test first** — one case in `describe('GroovePuzzle')`, *keeps the groove card
  sounding, announces the box once, and moves nothing under the finger (F15 E5
  R1b, R4, R5, R5a, AC1b, AC5, AC6, AC9)*:

  ```ts
  const scrolled = vi.fn()
  // jsdom does not implement scrollIntoView at all, so it is assigned and
  // restored rather than spied on — vi.spyOn on a missing method throws.
  const original = Element.prototype.scrollIntoView
  Element.prototype.scrollIntoView = scrolled
  const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  try {
    const user = userEvent.setup()
    const { container } = await renderPuzzle()

    // The baseline: one live region on a playable day — the feedback line under
    // the check control, a `role="status"` since feature-3. AC5's "exactly one"
    // is about the box, which is why the count is stated rather than assumed.
    expect(document.querySelectorAll('[role="status"]')).toHaveLength(1)

    // The loop is sounding before the day ends, which is the state R1b is about.
    await play(user)
    const grooveName = screen.getByRole('heading', { name: GROOVE.name })
    const transportButton = screen.getByRole('button', { name: 'Stop the loop' })
    const track = within(columnsOf(container)[0]).getByRole('progressbar')

    await guess(user, 'C', 'Aeolian')

    // AC1b: the same nodes, so nothing in the groove card was unmounted and the
    // transport was not interrupted. The audio graph itself is owned by
    // `useTransport` above the row and could not be re-created by a change
    // inside it; these three identities are what "the same node" asks for.
    expect(screen.getByRole('heading', { name: GROOVE.name })).toBe(grooveName)
    expect(screen.getByRole('button', { name: 'Stop the loop' })).toBe(
      transportButton,
    )
    expect(within(columnsOf(container)[0]).getByRole('progressbar')).toBe(track)

    // AC5: two regions now, exactly one of them the box, none nested in it, and
    // nothing turned into a dialog or an alert.
    const regions = Array.from(document.querySelectorAll('[role="status"]'))
    expect(regions).toHaveLength(2)
    expect(regions.filter((r) => r === solutionPanel())).toHaveLength(1)
    expect(solutionPanel().querySelectorAll('[role="status"]')).toHaveLength(0)
    expect(solutionPanel()).not.toHaveAttribute('aria-modal')
    expect(screen.queryAllByRole('dialog')).toEqual([])
    expect(screen.queryAllByRole('alert')).toEqual([])

    // AC6: the day's own ending settles the check control — feature-11 E4's
    // behaviour, not this epic's — and the move focuses nothing else. Stated in
    // the negative on purpose: the guess card is re-parented (R3a), so jsdom
    // drops focus to `document.body`, and asserting that node would make the
    // remount a requirement instead of a cost.
    expect(control()).toBeDisabled()
    expect(solutionPanel()).not.toContainElement(document.activeElement)
    expect(document.activeElement).not.toBe(transportButton)

    // AC9, R5a, R5b: no jump, no pointer, no toast. The announcement and the
    // reorder are the whole change.
    expect(scrolled).not.toHaveBeenCalled()
    expect(scrollTo).not.toHaveBeenCalled()
  } finally {
    Element.prototype.scrollIntoView = original
    scrollTo.mockRestore()
  }
  ```

  Run it: **passes today** — nothing scrolls, nothing remounts and the region
  count is already one then two. It is the constraint on how A3 is written, and
  it names its own failures: a conditional wrapper or a keyed column 1 fails with
  *expected … to be … (same object)* on `grooveName`; a `scrollIntoView` added
  "so Sam notices" fails with *expected "spy" not to be called*; wrapping the box
  in a second live region fails with *expected length 2, received 3*.
- **Implement** — none, and that is the requirement: no `useEffect`, no ref, no
  `scrollIntoView`, no `focus()` call and no `key` is added anywhere in this
  epic.
- **Green when** — green before and after A3.
- **Refactor** — none.

#### Step A2 — The placement is markup, not CSS

Covers: R7, AC8

- **Test first** — one case, *achieves the placement in the markup, not with
  positioning or order (F15 E5 R7, AC8)*: solve the day, then walk upward from
  the box **and** from the guess card to the feature's `section`, asserting no
  ancestor — nor either column — carries a positioning or `order` class. Both
  chains are walked because both elements move in this epic. `columns` comes from
  `columnsOf(container)`, not from A3's placement helper, because this case has
  to pass before the move as well as after it.

  ```ts
  // Anchored on a class boundary on purpose: a bare /order-/ matches
  // `border-r-[3px]`, which the lead sheet really renders.
  const FORBIDDEN = /(?:^|\s)(?:[a-z]+:)?(?:order-|absolute|fixed|sticky)(?:\s|$)/

  const user = userEvent.setup()
  const { container } = await renderPuzzle()
  await guess(user, 'C', 'Aeolian')

  const section = container.querySelector(
    `section[aria-label="${APP_NAME}"]`,
  ) as HTMLElement
  const chain: Element[] = [...columnsOf(container)]
  for (const start of [
    solutionPanel() as Element,
    screen.getByRole('heading', { level: 3, name: 'What is it?' }) as Element,
  ]) {
    for (let el: Element | null = start; el && el !== section; el = el.parentElement) {
      chain.push(el)
    }
  }
  for (const el of chain) {
    expect(el.className, el.className).not.toMatch(FORBIDDEN)
  }
  ```

  Run it: **passes today**. It fails, naming the offending class in the assertion
  message, the moment someone reaches for `md:order-first` or `absolute` instead
  of moving the element. `getComputedStyle` is deliberately not used: no
  stylesheet is loaded in jsdom, so it would report `static` whatever the classes
  say.
- **Implement** — none.
- **Green when** — green before and after A3.
- **Refactor** — none.

#### Step A3 — The box takes the second column and the guess card drops below

Covers: R1, R1a, R3, R6, R7, AC1, AC1a, AC4, AC7, AC7a

- **Test first** — add both helpers beside the existing `solutionPanel()` helper,
  then one case, *puts the box beside the groove card and the finished guess card
  below the row (F15 E5 R1, R1a, R3, AC1, AC1a, AC4, AC7, AC7a)*, placed next to
  the two existing column cases:

  ```ts
  function columnsOf(container: HTMLElement) {
    const split = container.querySelector('.md\\:flex-row') as HTMLElement
    const columns = Array.from(split.children) as HTMLElement[]
    expect(columns).toHaveLength(2)
    return columns
  }

  function expectEndedLayout(container: HTMLElement) {
    const split = container.querySelector('.md\\:flex-row') as HTMLElement
    const columns = columnsOf(container)

    const box = solutionPanel()
    const grooveName = screen.getByRole('heading', { name: GROOVE.name })
    const question = screen.getByRole('heading', { level: 3, name: 'What is it?' })

    // R1, AC1: the row's two children are the groove card and the box, and the
    // guess card is out of the row entirely.
    expect(columns[0]).toContainElement(grooveName)
    expect(columns[1]).toContainElement(box)
    expect(split).not.toContainElement(question)

    // AC1a: the box is the second column and the row is top-aligned, which is
    // what puts its first line level with the play control above `md`. This is
    // a structural assertion, not a measurement — jsdom has no viewport, and
    // `md:flex-row` is pinned by the existing 'stacks its columns' case.
    expect(split).toHaveClass('items-start')

    // AC7a: each of the two is one column, and the guess card is a later child
    // of the page stack, which is `flex flex-col` — so it stretches to the full
    // width below the row, exactly as the box did in its old position there.
    for (const column of columns) {
      expect(column).toHaveClass('w-full')
      expect(column).toHaveClass('md:w-auto')
    }
    const stack = split.parentElement as HTMLElement
    expect(stack.className).toContain('flex-col')
    const siblings = Array.from(stack.children)
    const guessRoot = siblings.find((el) => el.contains(question)) as HTMLElement
    expect(guessRoot, 'the guess card is not a sibling of the row').toBeDefined()
    expect(siblings.indexOf(guessRoot)).toBeGreaterThan(siblings.indexOf(split))

    // R7: document order is the visual order, at every width — groove card,
    // box, guess card.
    expect(
      grooveName.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      box.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    // AC7, the horizontal half of R6: a flex child that cannot be forced wider
    // than its column, and a staff that scales down rather than overflowing.
    expect(columns[1]).toHaveClass('min-w-0')
    expect(box.querySelector('svg')).toHaveClass('max-w-full')
  }
  ```

  The case itself: `const user = userEvent.setup()`, then
  `const { container } = await renderPuzzle()`, then
  `await guess(user, 'C', 'Aeolian')`, then `expectEndedLayout(container)`, then
  AC4's half — the guess card is everything it was, one place lower:

  ```ts
  const guessRoot = screen
    .getByRole('heading', { level: 3, name: 'What is it?' })
    .closest('div') as HTMLElement
  // R3, AC4: not hidden, not collapsed, not summarised, not stripped.
  expect(guessRoot).toContainElement(rootGroup())
  expect(guessRoot).toContainElement(flavourGroup())
  expect(guessRoot).toContainElement(
    screen.getByRole('switch', { name: /simple mode/i }),
  )
  expect(guessRoot).toContainElement(control())
  expect(within(flavourGroup()).getAllByRole('button')).toHaveLength(
    flavours().length,
  )
  expect(dotStates()).toHaveLength(3)
  // R5b: nothing was added to point at the box — no marker, no pointer, no
  // toast. The feedback line is the card's one live region and predates this.
  expect(guessRoot.querySelectorAll('[aria-live]')).toHaveLength(1)
  ```

  Run it: **fails with** *expected element to contain element* on
  `expect(columns[1]).toContainElement(box)` — the box is still a sibling after
  the row, and column 2 still holds the guess card.
- **Implement** — in `GroovePuzzle.tsx`:
  1. Hoist the `<GuessCard … />` element to `const guessCard = (…)` immediately
     above the `return (`, after the `if (!hydrated) return <PuzzleLoading />`
     guard. Props verbatim, twenty of them, unchanged.
  2. In column 2's `div` — the wrapper's `className` is unchanged — replace the
     `<GuessCard … />` call with
     `{solved || revealed ? (<Stack gap="lg"><SolvedPanel … />{shared && <PlayTodayLink />}</Stack>) : (guessCard)}`,
     moving the `<SolvedPanel … />` element in verbatim with its props and moving
     `<PlayTodayLink />` in with its condition reduced to `shared &&`.
  3. Delete the old `{(solved || revealed) && <SolvedPanel … />}` and
     `{shared && (solved || revealed) && <PlayTodayLink />}` blocks after the
     `</Row>`, and put `{(solved || revealed) && guessCard}` in their place.
  4. Do not touch column 1, the `Row`'s props, the import list, or
     `SolvedPanel` itself. Add no `key`. Add no `className`. Do not introduce a
     `const over = solved || revealed`: the PRD asks for no derived flag, and a
     rename sweep across lines Epics 1–4 have just edited is not what this diff
     should be.
- **Green when** — the case passes, and both existing column cases (*stacks its
  columns by default …*, *gives each column the full width once stacked*) stay
  green unedited, which is what proves the row still has exactly two children.
  A1 and A2 stay green, which is what proves the groove card did not move.
- **Refactor** — none beyond the hoist, which is part of the implementation
  rather than a follow-up: without it the guess card's twenty props exist twice.

#### Step A4 — A day given up on is placed identically

Covers: R8, AC2

- **Test first** — one case, *places the box the same way on a day given up on
  (F15 E5 R8, AC2)*: seed the store with a revealed day — the fixture shape
  `GroovePuzzle.sounding.test.tsx` already uses (`date: TODAY()`,
  `answer: { root: 'C', flavour: 'Aeolian' }`, three misses, `solved: false`,
  `revealed: true`), set on both `mockStore.get` and `mockStore.getAll` — render,
  and call `expectEndedLayout(container)`. Run it before A3's implementation:
  fails the same way A3 does, on `toContainElement`. Run it after: passes.
- **Implement** — none. There is one condition and two endings; if this case
  fails after A3, the move was written behind `solved` alone and must be put back
  behind `solved || revealed`.
- **Green when** — green, with no second condition anywhere in the file.
- **Refactor** — none.

#### Step A5 — Mid-puzzle, nothing has moved

Covers: R2, AC3

- **Test first** — extend the existing case *reveals neither the solved panel nor
  the day's changes before the solve* (in `describe('through the composed
  page')`) rather than adding a case: it is already the "no box yet" test, and the
  page file is close to its ceiling. It renders through `renderFeature()` and
  currently spends no guesses, so add a `userEvent.setup()` and two misses — AC3
  is about a *part-played* day, which is the state a reorder could plausibly get
  wrong — then:

  ```ts
  const columns = columnsOf(container)
  // Two guesses spent, no terminal state: no box to place, so the row is the
  // groove card and the guess card, in the order they are today.
  expect(columns[1]).toContainElement(
    screen.getByRole('heading', { level: 3, name: 'What is it?' }),
  )
  expect(columns[0].querySelector('[role="status"]')).toBeNull()
  // The page's one live region — the feedback line — is in column two, where
  // the guess card still is.
  expect(document.querySelectorAll('[role="status"]')).toHaveLength(1)
  expect(
    screen
      .getByRole('heading', { name: GROOVE.name })
      .compareDocumentPosition(
        screen.getByRole('heading', { level: 3, name: 'What is it?' }),
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()
  ```

  Run it: passes today, and passes after A3. It is the regression guard, and it
  fails with *expected element to contain element* the moment the box is placed
  unconditionally rather than behind the terminal state, or the guess card is
  moved out of the row while the day is still in play.
- **Implement** — none.
- **Green when** — green before and after A3.
- **Refactor** — none.

#### Step A6 — The shared page places it the same way, and the way onward follows the box

Covers: R1, R8, AC1 (shared entry point); preserves F12 E3 R5a–R5c

- **Test first** — one case inside the existing
  `describe('the framing on a shared groove (F12 E3)')` block, which already has
  its own `renderShared`, *places the box the same way on a shared groove, with
  the way onward beneath it (F15 E5 R1, AC1)*:
  `const { container } = await renderShared()`, solve, then
  `expectEndedLayout(container)`, then

  ```ts
  const invite = screen.getByRole('link', { name: /play today.s groove/i })
  const box = solutionPanel()
  const columns = columnsOf(container)

  // Feature-12 E3's own relationship, restated at the new position: after the
  // box, never folded into it (F12 E3 R5a, AC14).
  expect(box.compareDocumentPosition(invite) & Node.DOCUMENT_POSITION_FOLLOWING)
    .toBeTruthy()
  expect(box).not.toContainElement(invite)
  // And it travelled with the box rather than being left below the guess card,
  // so the next move is still beside the answer it belongs to (decision 1).
  expect(columns[1]).toContainElement(invite)
  // Still the only two in-app destinations, and still both `/`.
  expect(inAppLinks()).toHaveLength(2)
  for (const link of inAppLinks()) expect(link).toHaveAttribute('href', '/')
  ```

  Run it before A3's implementation: fails on `expectEndedLayout`'s
  `toContainElement`, like A3. Run it after: passes.
- **Implement** — none beyond A3.
- **Green when** — green, and `GroovePuzzle.guessing.test.tsx`'s *invites the
  player to today once the shared groove is solved (R5a, AC5, AC14)* and *shows
  the same invitation, worded the same way, when it is given up on (R5b, AC14)*
  stay green **unedited** — they assert the same relationship and are this epic's
  canaries for feature-12. Also green unedited: this file's *points every link
  that leaves the page at today, and offers one while in play (R5, R7, AC5)* and
  *adds the only link the daily page never had (R5, AC5)*, which count in-app
  links and are what would catch the link being duplicated rather than moved.
- **Refactor** — none.

#### Step A7 — The comments describe where the box actually is

Covers: R1, R6a (the documentation half)

- **Test first** — none. No test reads these comments; they are read by the next
  person to move something. This is the one step whose done-condition is review,
  and it is called out as such rather than dressed up as a test.
- **Implement** — four paragraphs, no code:
  1. `GroovePuzzle.tsx`, the block comment above the moved `SolvedPanel`
     element. It currently opens *"The payoff, below both cards, once the day has
     ended either way (R6)"*, which is now false. Rewrite it to say: the box
     takes the guess card's column once the day has ended, so the lesson is read
     level with the transport rather than two cards below it (F15 E5 R1, R1a);
     document order is the placement, with no `order` and no positioning (R7);
     the conditional is deliberately confined to *this* column, because anything
     conditional in column 1 would remount the groove card and the transport
     sounding through it (R1b); and the guess card's re-parenting is the accepted
     cost, because it holds no state of its own (R3a).
  2. `GroovePuzzle.tsx`, above the hoisted `const guessCard`: one element,
     rendered in one of two places, so its twenty props exist once and cannot
     drift between the two positions (AC4).
  3. `GroovePuzzle.tsx`, the `PlayTodayLink` comment. It says *"A sibling after
     the panel rather than a branch inside it"* — still true, and now inside the
     same column as the panel, beneath it. Say that, say the condition reduced to
     `shared &&` because the branch it sits in already establishes the terminal
     state, and say that feature-12 E3's decision is unchanged: after the answer,
     never inside it.
  4. `components/puzzle/GrooveCard.tsx`, the docstring paragraph that reads *"the
     panel is below both cards and out of view while you are playing along"* —
     the sentence the PRD quotes as the evidence for this epic. Rewrite it: the
     panel now sits beside this card rather than below both, and the answer stays
     on the meta line because it is what a player reads while jamming with the
     box scrolled away (R6a, AC10). Keep the `(F12 E3 R4)` citation and add this
     epic's. The same sentence appears as a comment in
     `components/puzzle/GrooveCard.test.tsx` (above *renders a line carrying the
     answer exactly as it was composed*) — fix it in the same breath; it is a
     comment, and no assertion moves.

  Do **not** edit `components/solved/SolvedPanel.tsx`: the composer knows where
  the panel goes; the panel does not.
- **Green when** — the four comments match the tree, reviewed by eye, and
  `npm test` is still green (`structure.test.ts` reads `GroovePuzzle.tsx`'s source
  for the retired archive bindings and must stay green — a `guessCard` const
  names none of them).
- **Refactor** — none.

## Integration and verification

#### Step I1 — The whole suite, and the tests that must not have been edited

- **Run** — `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build`. No
  generator file is touched, so `npm run test:gen` is not this epic's gate.
- **Case count** — `grep -c '^\s*it(' …GroovePuzzle.page.test.tsx` reports 40 or
  fewer. Expected 39.
- **The named green list.** These pass unedited, or the move went wrong:
  - `GroovePuzzle.page.test.tsx` — *stacks its columns by default and only splits
    higher up (D8, R15, AC12)* and *gives each column the full width once
    stacked (R15)*: the row still has exactly two children, both still wrapped
    the same way.
  - `GroovePuzzle.sounding.test.tsx` — *names the answer beside the tempo only
    once the day is over*: **this is AC10.** The groove card keeps feature-12's
    answer on its meta line, and the epic buys its vertical room from nothing.
    Every other case in this file is a statement about the groove card, which
    this epic does not touch.
  - `GroovePuzzle.guessing.test.tsx` — *invites the player to today once the
    shared groove is solved (R5a, AC5, AC14)*, *shows the same invitation,
    worded the same way, when it is given up on (R5b, AC14)*, and every
    solved-panel case: the box's content is untouched and the invitation's
    relationship to it is unchanged.
  - `GuessCard.test.tsx` and `ModeToggle.test.tsx`: the finished guess card is
    untouched, props included.
  - `GrooveCard.test.tsx`: only a comment changed; every assertion is as it was.
  - `src/features/daily-groove/structure.test.ts`: five composed test files, no
    sixth, no `GroovePuzzle.test.tsx`, and no archive binding named in
    `GroovePuzzle.tsx`.
  - `src/app/page.test.tsx`, `src/app/groove/*`: the routes are unchanged.
- **Removability** — deleting `src/features/daily-groove/` still leaves a
  building app: this epic added no inbound reference and no registration point.
- **Demo path** — the eye checks, including the two things no test asserts.
  1. **360px, the point of the epic.** Solve today's puzzle. The box appears
     directly under the groove card; the finished guess card is below it with its
     chips, its dots and its settled switch. Press play and read the box's first
     line — check **by eye** whether the play control is still on screen with it
     (R6's target, and the one thing no test asserts). Confirm the page did not
     jump when the day ended and the button you pressed did not move out from
     under your finger.
  2. **Give up** on a fresh day at 360px: the same order, no win claim.
  3. **A shared groove**, solved, at 360px: the same order, and the way onward
     directly under the box.
  4. **1220px.** The box level with the groove card, top-aligned, its first line
     beside the play control — this is the whole reason for the rewrite, so look
     at it. The guess card full width below. The staff at natural size in a
     ≈596px column; the lead sheet's four bars at ≈149px each.
  5. **≈780px, just above the row's break.** The tightest 1 × 4 lead sheet the
     app can produce — four bars in a ≈330px column, ≈78px each. Check it reads.
     This is the flag in decision 2, it predates this epic, and the fix if one is
     wanted is a container query in `LeadSheet`, which this epic does not own.
  6. **Play, then solve, and keep listening.** The loop must not stutter, restart
     or stop as the box appears. This is AC1b in the only place it can really be
     felt.
- **Coverage** — the table below. Every R and AC has a step.

## Requirement coverage

| Requirement | Steps |
| :-- | :-- |
| R1 | A3, A4, A6, A7 |
| R1a | A3 (the row is `items-start` and the box is column 2), demo path 4 |
| R1b | A1 (the three node identities), A7 |
| R2 | A5 |
| R3 | A3 (the AC4 half) |
| R3a | A1 (the groove card is what must not be re-created; the guess card's remount is not asserted against), A7 |
| R4 | A1 |
| R5 | A1 |
| R5a | A1 |
| R5b | A1, A3 (nothing added to the guess card) |
| R6 | A3 (the horizontal half), demo path 1 (the vertical target, by eye) |
| R6a | A7, I1 (the sounding file's meta-line case, run unedited) |
| R7 | A2, A3 (document order) |
| R8 | A4, A6 |
| AC1 | A3, A6 |
| AC1a | A3 — structural: the box is the row's second column and the row is top-aligned. Not measured; jsdom has no viewport. Demo path 4 is the eye check. |
| AC1b | A1 |
| AC2 | A4 |
| AC3 | A5 |
| AC4 | A3 |
| AC5 | A1 (two regions once the day ends, exactly one of them the box) |
| AC6 | A1 (the check control is disabled; nothing the move placed took focus) |
| AC7 | A3 (no horizontal overflow), demo path 1 (the vertical fit, by eye) |
| AC7a | A3 (both columns keep `w-full`/`md:w-auto`; the guess card is a later child of the `flex-col` page stack) |
| AC8 | A2 |
| AC9 | A1 |
| AC10 | I1 (*names the answer beside the tempo only once the day is over*, run unedited), A7 |

## Assumptions

- **The box takes the guess card's column, and the guess card drops below the
  row.** This is the PRD's Cycle 4 decision, not this spec's, and it replaces the
  shape the previous version of this spec built — see the Decision log.
- **`PlayTodayLink` travels with the box** into the second column, beneath it.
  Justified from feature-12 E3 R5a/AC14 in decision 1, with the cost of the
  alternative stated there. If a reviewer prefers the link last on the page, the
  change is one line — move `{shared && <PlayTodayLink />}` out of the `Stack`
  and back after `{(solved || revealed) && guessCard}` — plus dropping one
  assertion from Step A6. Everything else in the spec is unaffected, which is why
  this is an assumption and not an open question.
- **The desktop box is one column wide**, ≈596px at full container width,
  identical to the superseded shape. No 2 × 2 break is added to `LeadSheet`: the
  file is Epics 1–4's, the box's content is out of scope, and the tightest case
  (≈78px bars at a 768px viewport) predates this epic. It is demo-path item 5.
- **`GuessCard` is hoisted to a `const` and rendered in one of two positions.**
  The alternative is twenty props written twice, and two copies that drift. React
  never sees both, because the two branches are mutually exclusive.
- **The guess card's subtree is re-created, and nothing is contorted to avoid
  it.** R3a sanctions this explicitly. It means the check button's DOM node is
  *not* stable across the transition, so no case asserts that it is — which is a
  change from the superseded spec, where it was the headline assertion.
- **No `key` is added anywhere.** Positions inside the `Row` are static, so keys
  are inert; a varying key on column 1 is the exact remount R1b forbids.
- **`components/solved/` is not edited at all**, comments included, which is also what
  keeps this epic off the one file all four other epics own.
- **AC5's "exactly one `role="status"`" is read as "exactly one for the box".**
  `FeedbackLine` is the page's other one and has been since feature-3; asserting
  a literal one would mean deleting it.
- **AC6 asserts identity and non-movement, not the platform's focus rules.** The
  app disables the check button and removes the give-up button as the day ends,
  both pre-existing; jsdom then drops focus to `document.body` because the
  focused node is re-parented. The case asserts that nothing the *move* placed
  took focus, which holds whether or not the remount happens.
- **No test measures a viewport.** jsdom has no layout, so R6's vertical half and
  AC1a's "same horizontal band" are a review item and a structural assertion
  respectively, by the PRD's own instruction. Nothing here calls
  `getComputedStyle` or fakes a screen width.
- **`scrollIntoView` is assigned and restored, not `vi.spyOn`'d**, because jsdom
  does not implement it and `vi.spyOn` on a missing method throws.
  `window.scrollTo` exists and is spied normally.
- **Five new cases**, taking `GroovePuzzle.page.test.tsx` from an expected
  baseline of 34 to 39, under feature-14's ceiling of 40. Step A1 carries three
  cases' worth of assertions and Step A5 extends an existing case, both for
  exactly this reason. If the live baseline is higher than 34, fold further; the
  answer is never a sixth composed file.
- **One line beyond the brief's enumeration.** The false sentence *"below both
  cards and out of view while you are playing along"* also appears as a comment
  in `components/puzzle/GrooveCard.test.tsx` (line ~100). Step A7 fixes it: it is
  a comment, no assertion moves, and the file is in nobody else's territory.
  Drop that one line from the diff if the lead wants the ownership list exactly
  as briefed — the epic is complete either way, with one stale comment left.

No open questions. The two decisions a reader might expect to find open — where
`PlayTodayLink` goes, and what to do about the lead sheet at column width — are
settled above with their costs, and the layout fork itself was settled by the PRD.

## Decision log

### Rewrite — 2026-09-01

**What the old shape was.** The first version of this spec put `SolvedPanel`
*inside the row's first column*, under `GrooveCard`, wrapped in an unconditional
`<Stack gap="lg">`. The guess card never moved: same wrapper, same props, same
position as the row's second child. Below `md` that produced the PRD's document
order correctly. Above `md` it did not: the box landed under the whole groove
card, so at desktop width the lesson was still below the transport — the opposite
of what the epic is for. The user saw what that produced and chose differently;
the PRD's Cycle 4 records the change and supersedes R1 as originally written.

**What replaced it.** The box is the row's **second** child, beside `GrooveCard`,
and the guess card moves out of the row to become a sibling after it. `GrooveCard`
does not move in either shape, which is the one property both versions were built
around — for different reasons.

**What it changed in this spec:**

- **The Architecture section inverted.** The old comparison table asked "where in
  the row does the box go" and chose column 1, rejecting "collapse to one column"
  and "a row of `[groove]` and `[box, guess]`" partly *because they re-parent the
  guess card*. The chosen shape is a near relative of that third rejected option,
  and the PRD's R3a now sanctions the re-parenting outright. So the argument is
  no longer "which shape avoids a remount" but "which remount is acceptable" —
  the groove card's is not, the guess card's is, and the new shape is the one that
  makes that distinction structural.
- **The hazard moved, and shrank.** The old shape's central risk was a
  *conditional wrapper in column 1* remounting the transport, and it spent an
  unconditional `<Stack>` and a dedicated assertion defending against it. The new
  shape puts no conditional in column 1 at all, so the hazard is gone by
  construction; what remains is a review rule (no `key`, nothing conditional
  above `GrooveCard`) and the three node-identity assertions in Step A1.
- **The headline assertion changed subject.** The old Step A6 asserted the check
  button was *the same node* across the transition. That is now false by design,
  because the guess card is re-parented. Step A1 asserts the *groove card's*
  nodes instead, and states focus in the negative — nothing the move placed took
  focus — with the reason written into the case.
- **`PlayTodayLink` stopped being frozen.** The old spec froze it in place after
  the row; the new layout would have left the finished guess card between the
  answer and the way onward, so decision 1 moves it into the second column
  beneath the box, with feature-12 E3's intent as the justification.
- **AC1a became a real step.** The old shape could not satisfy "the box's first
  line and the play control share a horizontal band" above `md` at all; the PRD
  added AC1a with the new layout, and Step A3 now asserts its structural half
  (`items-start` plus second-column placement) and hands the visual half to the
  demo path.
- **Seven cases became five.** The old plan added seven, on a baseline it put at
  32. The real baseline when this epic starts is 34 — Epics 1, 3 and 4 each add a
  page case to the 31 that exist today — so seven would land at 41, over the
  ceiling. Three of the old cases are folded into Step A1's single transition
  case, and the guess-card case is folded into Step A3.
- **What survived unchanged.** The two-`role="status"`-regions finding and its
  reasoning; `scrollIntoView` being assigned rather than spied; the
  anchored `FORBIDDEN` regex and why a bare `/order-/` matches
  `border-r-[3px]`; the honest limits of jsdom; one track, because a second would
  share `GroovePuzzle.tsx`; and the wave-3 placement with both its reasons.

### Cycle 2 — 2026-09-01 · two changes after the build, and what they supersede

Both came from the user looking at the built page, and both are recorded in the
PRD as its Cycle 5. The sections above are the design as first built; these are
the passages that no longer describe the app.

**The guess card below the row keeps one column's width.** It is wrapped in a
second `Row` with the same `gap` and the same `collapseBelow`, holding the card
in an identically classed `min-w-0 w-full flex-1 md:w-auto` column with an empty
`aria-hidden` spacer beside it — so both rows take a column's width from one
place. The rejected alternative was `md:w-[calc(50%-0.875rem)]`, which copies
half of `gap-7` into a second place; change `Row gap="lg"` and it disagrees by
fourteen pixels, silently. The spacer is `hidden md:block`, which matters on the
phone: a spacer that stayed a flex item below the breakpoint would add a phantom
28px of gap under the card.

Superseded by it: the **Architecture** sketch's single `Row`; the bullet *"The
guess card gets no wrapper in its new position"*, which is now the opposite of
what happens; and **Contracts**' *"`Row` keeps exactly two children"*, which
should read *the row the layout cases assert about* keeps exactly two children —
there are now two rows, and `columnsOf`'s `querySelector('.md\\:flex-row')`
returns the first, which is why the existing R15 cases still pass unedited.

**The row's columns are equal height.** `align="start"` is gone, so the columns
take flexbox's own stretch, and each column is a one-cell `grid` so the card or
panel inside fills the height the column was stretched to. The ended column's
`Stack` became a `grid grid-rows-[1fr_auto] gap-6`, which lets the box take the
height and leaves `PlayTodayLink` sitting under it at its natural size.

Superseded by it: every reference above to the row being `items-start` or
top-aligned, including Step A3's `expect(split).toHaveClass('items-start')` —
the assertion is now that no `items-*` class overrides the default, plus that
each column carries `grid`. The *claim* behind AC1a is unchanged: the box's first
line and the play control share a horizontal band. Stretch aligns both edges, so
it aligns the tops as well.

**The drawing inside the box also changed, and it is not this epic's.**
`ScaleStaff` now draws quarter notes behind a generated engraved clef and closes
on a final bar. It changes the box's height, which is why it is worth knowing
here: the equal-height rule above is what keeps that from leaving the groove card
short. The generator for the clef outline is `specs/feature-15/clef-outline.py`,
and it reproduces the shipped `CLEF_PATH` byte for byte.
