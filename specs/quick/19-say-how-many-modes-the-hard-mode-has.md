# 19 — Say how many modes the hard mode has

## What

* The caption under the Simple mode switch reads "Twelve roots, four modes". Turning simple mode off gives twelve roots and six modes.
* The moment that prompted this, in Sam's words: "I flip it, six mode names appear on the card, and the line under the switch says four… it's the only signpost on the bridge, pointing wrong." Either they read it as "I'm not ready for this" and flip straight back, or as "this thing is stale" and stop trusting the one caption that says how big the harder half is.
* The caption follows the switch's current state, so the wrong number is never a promise before flipping — it is a caption contradicting six chips already on screen. Nothing says how big the harder mode is before committing to it.
* The mode chips never narrow. Only modes the player has personally guessed wrong get ruled out, so the six names sit there cold — which is what makes the count worth getting right.
* Same edit, second sentence: "mode" means two sizes of thing in the first two minutes. The intro says the switch "enables guessing modes instead", while the card already labels the Major/Minor chips "Mode".
* Not in scope: the streak reading 0 on a first visit. Sam looked at it and called it settled — "a slot waiting to be filled, not a scold".

## Done when

* The caption under the Simple mode switch names the number of modes the card actually offers.
* A test fails if the count in the copy and the number of mode chips ever disagree again — today two tests assert the wrong string as correct and never compare it to the real count.
* The How to play box says which sense of "mode" the Simple mode switch turns on, so a reader of it can tell Major/Minor from the six named modes. The card itself keeps "Mode" for both, per Q2-A.
* No audio re-renders, and no puzzle answer changes.

## Open questions

### Q1. How does the caption stop being able to go stale? — **answered A**

The count is a bare `6` passed to `buildOptions` at `src/lib/theory/music.ts:19`; the caption is a hand-written string in `src/lib/snippets/en/puzzle.ts:18`. Nothing connects them, which is how quick-6 changed four chips to six and left the wording behind.

- [x] A) **Name the count and pin the caption against it.** Export it from `theory/music.ts`, have `flavourOptions` use it, and assert in `snippets.test.ts` that the caption's number matches it — so the card's count and the caption's number trace to one place *(recommended — it is the only option that satisfies `## Done when`'s second bullet without changing what the caption is)*
- [ ] B) **Fix the literal and nothing else**, pinned the way it is today by an exact-string assertion. One character of real work; nothing stops the next drift, and `## Done when`'s second bullet goes unmet
- [ ] C) **Make the caption a function of the chips on the card**, the way `puzzle.ruledOut` already is. `GuessCard:78` renders the toggle and already holds `view.roots` and `view.flavours`, so the counts are two props away. Cannot go stale by construction
- [ ] D) **Make the caption describe the state you would get, not the one you are in** — Sam's actual complaint, that nothing says how big the harder mode is before you commit. Needs both option sets built in `lib/presentation/`, and it changes what the caption means

What each costs:

| | A) named count | B) literal only | C) caption as function | D) describe the other side |
| :-- | :-- | :-- | :-- | :-- |
| files | `theory/music.ts`, `snippets/en/puzzle.ts`, `snippets.test.ts` | `snippets/en/puzzle.ts`, `snippets.test.ts` | + `ModeToggle.tsx`, `GuessCard.tsx`, `snippets/types.ts` | + `lib/presentation/index.ts` |
| modules | theory + snippets | snippets | + **shell** | + shell, + puzzle |
| existing tests broken | `snippets.test.ts:150` | `:150` | `:150`, and **`:139`** — it calls `simpleModeOn.toLowerCase()`, which a function is not | same as C |
| drift caught later | yes, by the shared constant | no | structurally impossible | structurally impossible |
| hidden cost | none found | none | the caption leaves the prose scan at `snippets.test.ts:286`, which skips non-strings — so a function is no longer checked for re-render words | changes the meaning of the control's description |

**D is the one that answers the persona finding rather than the ticket.** `## Done when`'s first bullet asks for "the number of modes the card actually offers", which is the state you are in — so A, B and C serve the ticket as written and D serves the complaint behind it. If D is what is wanted, the first `## Done when` bullet needs rewording too.

### Q2. Which side gives way on the word "mode"? — **answered A**

`puzzle.modeGroup` is `'Mode'` in both modes, so in simple mode a group labelled **Mode** holds **Major** and **Minor** — while `intro.twoWays` says the switch "enables guessing modes instead".

- [x] A) **Reword the intro sentence; the card keeps "Mode" for both.** *(recommended — `modeGroup` is the accessible name `testing/puzzleHarness.tsx`, `GuessCard.test.tsx` and `GroovePuzzle.page.test.tsx` use to find the chips, so renaming it is the expensive direction for no gain the player can see)*
- [ ] B) **Give the simple-mode group its own label** — "Major or Minor" rather than "Mode" — so the word only ever means the six named modes
- [ ] C) **Leave it.** Sam's own read: they skim the How to play box on day one, so the collision costs nothing the morning it happens

**A carries one constraint worth knowing before wording it.** `snippets.test.ts:139` asserts that `intro.twoWays` contains `puzzle.simpleModeOn` verbatim, so the reworded sentence has to keep "Six roots, Major or Minor" inside it — or that test moves too. B does not have this problem but pays the harness cost instead.

## Notes

**Size test — passes on all four**, under any option in Q1 or Q2.

1. **Yes.** The caption, the intro sentence, a named count with its test, and the two existing assertions that move with them. Five.
2. **Yes.** `src/lib/snippets/` is its own area and sits in none of the six modules in [architecture.md](../../docs/architecture.md) — the map covers the slice and `src/lib/theory/`, and `docs/coding-guidelines.md:356` files the seven area files of `snippets/` beside `date.ts`. So Q1-A is **theory** plus copy; Q1-C or Q1-D add **shell**. Two at worst.
3. **Yes.** Nothing under `scripts/grooves/`, no audio, no manifest, no answer moves. `## Done when`'s fourth bullet is the guard and it holds by construction.
4. **Yes.** Copy, one constant and their tests.

**Verified against the tree — the ticket's first bullet is right.** `flavourOptions` at `src/lib/theory/music.ts:19` calls `buildOptions(groove.flavour, flavourPool(grooves), isoDate(date), 6)`, and `flavourPool` is the twelve distinct flavours the manifest ships, so full mode offers **six** mode chips. Full mode's roots are `ROOTS`, which is twelve, so "Twelve roots" is correct and only the mode half is wrong. `simpleModeOn` — "Six roots, Major or Minor" — is also correct: `simpleRootOptions` takes six and `FAMILIES` is exactly `['Major', 'Minor']`.

**One correction to the second `## Done when` bullet, which is not mine to edit.** It says two tests assert the wrong string as correct. Strictly one does — `snippets.test.ts:150`, whose own name is *"describes each side of the switch by what the row shows"*, which is the property it does not check. The other, `ModeToggle.test.tsx:116-118`, refers to the caption through the imported snippet, so it asserts that the string is *visible* and never what it says; it would pass whatever the wording were. Content-blind rather than wrong. ~~and it cannot be otherwise — see the lint zone below~~ — that clause was wrong, and the build falsified it: `ModeToggle.test.tsx` is where the count assertions ended up. The bullet's intent is unaffected.

**~~The lint zone this has to clear~~ — this paragraph was wrong, and it is left visible because it is what sent Q1-A and Q3-A to the wrong file.** It read: *"`eslint.config.mjs` forbids a string literal containing whitespace as the argument to `toBe`, `toEqual`, `toContain` or `toMatch` in a test, and exempts exactly one path: `src/lib/snippets/**` … so the corrected wording can only be asserted verbatim inside `snippets.test.ts`, and no test elsewhere may quote it."* The rule exists, but `copiedSentenceRules` is applied **once**, at `eslint.config.mjs:220`, over `files: ["src/features/daily-groove/lib/presentation/**/*.test.ts"]`. It binds the coaching module's tests and nothing else. So it never reached `ModeToggle.test.tsx`, and it was never a reason to put the count assertions in `snippets.test.ts`.

**And the rule that actually binds here was missed entirely.** `src/features/daily-groove/structure.test.ts`'s *"snippets and theory are siblings"* forbids any arrow between `src/lib/snippets/` and `src/lib/theory/` — either direction, import or `vi.mock` — and `docs/coding-guidelines.md:496` states it: *"neither `src/lib/snippets/` nor `src/lib/theory/` may name the other."* That makes Q1-A and Q3-A **unimplementable as ticked**. See `## Built`.

**Files this is expected to touch.**

* `src/lib/snippets/en/puzzle.ts:18` — `simpleModeOff`. **The one line the ticket is about.**
* `src/lib/snippets/snippets.test.ts:150` — the exact-string assertion, plus whatever Q1 adds. Under Q1-A this is also where the caption's number meets the count.
* `src/lib/theory/music.ts` — the `6` at `:19` becomes a named export (Q1-A). Under Q3-A the `6` at `:23` gets its own name too.
* `src/lib/snippets/en/intro.ts:13` — `twoWays` (Q2-A), worded by Q4.
* `src/lib/snippets/snippets.test.ts:139` — only if Q4's wording dropped the `simpleModeOn` substring, which none of its three options does. Expected to stay as it is.

**Closed by the answers, and named so the build does not reopen them:** `ModeToggle.tsx`, `GuessCard.tsx` and `snippets/types.ts` stay shut (Q1-A, not C or D); `puzzle.modeGroup` and the three files using it as an accessible name stay shut (Q2-A, not B); `lib/presentation/index.ts` stays shut (no Q1-D). Nothing under `scripts/grooves/` is in scope at all.

**Assumptions taken rather than asked.**

* **Six is a property of the code, not of the catalogue.** `buildOptions` is asked for six and the flavour pool is twelve, so it always returns six. A catalogue shipping fewer than six distinct modes would make the caption wrong again — `manifest.test.ts` requires all twelve, so that cannot happen without a test failing first.
* **The caption describes the current state, not the switch's effect.** `ModeToggle.tsx:20` reads `simple ? simpleModeOn : simpleModeOff`, so the wrong number is only ever read next to the six chips it contradicts, never as a promise beforehand. That is Sam's own correction and it is why Q1-D exists as a separate option rather than as the default reading of the ticket.
* **The mode chips genuinely do not narrow.** `lib/presentation/ruledOut.ts` eliminates roots algorithmically through `eliminatedRoots`, but its `flavours` field only collects modes the player has already guessed wrong — one per wrong attempt. So the ticket's fourth `## What` bullet holds, and the six names do sit there cold.
* **No new arrow into the catalogue.** A test that counted the real chips by calling `flavourOptions` would need `GROOVES`, drawing snippets → catalogue. Q1-A avoids that by comparing against a constant in theory instead.
* **The streak stays out**, as the ticket's last bullet says. Recorded because `header.streakCount` renders `0` and a reader may take it for an oversight; Sam looked at it and called it settled, while saying plainly that the persona gives no line either way.

## Answered — Q1-A, Q2-A

**Q1-A. The count gets a name and the caption is pinned against it.** The `6` at `src/lib/theory/music.ts:19` becomes an exported constant, `flavourOptions` uses it, and `snippets.test.ts` asserts the caption states that number. `ModeToggle.tsx`, `GuessCard.tsx` and `snippets/types.ts` stay shut — the caption stays a plain string, so `snippets.test.ts:139` and the prose scan at `:286` both keep working, which were C's and D's costs.

**Q2-A. The intro sentence gives way; the card keeps "Mode" for both.** `puzzle.modeGroup` is untouched, so `testing/puzzleHarness.tsx`, `GuessCard.test.tsx` and `GroovePuzzle.page.test.tsx` keep finding the chips by the accessible name they use today.

**Size test, re-run against both: still passes on all four.** theory plus copy, two at worst, nothing frozen, one revert.

**What Q1-A turned out to need, which the option text did not say.** The captions spell their counts as words — "Six roots", "Twelve roots" — and so does the rest of the copy ("one note", "two notes" in `coaching.nearMissApart`). So the test cannot compare a string to a number directly; it needs the digit's English word. Nothing in the tree does that today. Taken as an assumption rather than asked, because the copy's own style settles it: the caption keeps the word and the test carries a small digit-to-word map. A one-word literal like `'six'` has no whitespace, so `eslint.config.mjs`'s sentence rule does not reach it, and `snippets.test.ts` is the exempt path anyway.

**And a second `6`, which is why Q3 exists.** `music.ts` passes `6` twice — at `:19` for the *modes* in full mode, and at `:23` for the *roots* in simple mode. Same literal, different meanings, and only the first is what the ticket is about. But "Six roots" in `simpleModeOn` traces to the second, and can go stale in exactly the way "four modes" did.

## Open questions

### Q3. Which of the copy's counts get pinned? — **answered A**

Four numbers are stated in the two captions, and only one is wrong today:

| Copy | Number | Traces to | State |
| :-- | :-- | :-- | :-- |
| `simpleModeOn` | "Six roots" | `music.ts:23`'s `6` | correct, unpinned |
| `simpleModeOn` | "Major or Minor" | `FAMILIES`, two entries | correct, unpinned |
| `simpleModeOff` | "Twelve roots" | `ROOTS.length` | correct, unpinned |
| `simpleModeOff` | "four modes" | `music.ts:19`'s `6` | **wrong** |

- [x] A) **Both `buildOptions` counts, plus the roots.** Name the two `6`s separately, and assert all three numbers — the mode count, the simple-mode root count, and "Twelve roots" against `ROOTS.length`, which needs no new constant *(recommended — the two `6`s are the numbers a future ticket can change without noticing, which is precisely what happened here; and the third assertion is one line against a length that already exists)*
- [ ] B) **The mode count only**, which is what `## Done when`'s second bullet asks for. Leaves "Six roots" and "Twelve roots" able to drift the same way

### Q4. How does the intro sentence read? — **answered A**

It must keep "Six roots, Major or Minor" inside it — `snippets.test.ts:139` asserts `twoWays` contains `simpleModeOn` verbatim. Current wording:

> Two ways to play: Simple mode is six roots, Major or Minor. The switch on the card enables guessing modes instead.

- [x] A) **"Two ways to play: Simple mode is six roots, Major or Minor. Switch it off for twelve roots and six named modes."** *(recommended — "named modes" is what separates the two senses of the word, and stating both numbers means the intro previews the size of the harder mode, which is the part of Sam's complaint Q1-D was going to answer and no longer does)*
- [ ] B) **"Two ways to play: Simple mode is six roots, Major or Minor. The switch on the card offers six named modes instead."** Keeps the sentence shape and fixes only the count and the collided word
- [ ] C) **"Two ways to play: Simple mode is six roots, Major or Minor. Switch it off and the Mode row names six modes instead — Dorian, Lydian and the rest."** Most concrete, and the one that puts mode names into the first two minutes — the vocabulary `docs/persona.md` says loses Sam on day one

A and B both state a number, so both come under whatever Q3 decides; C states one too. All three keep the required substring.

## Answered — Q3-A, Q4-A, and a hand edit that arrived with them

**Q3-A. Both `buildOptions` counts get names, and the root count is asserted too.** `music.ts:19`'s `6` (full-mode modes) and `:23`'s `6` (simple-mode roots) become separate named exports, and `snippets.test.ts` asserts the number each caption states against the constant behind it.

**Q4-A. The intro sentence becomes** *"Two ways to play: Simple mode is six roots, Major or Minor. Switch it off for twelve roots and six named modes."* It keeps the `simpleModeOn` substring `snippets.test.ts:139` asserts.

**And `simpleModeOff` was edited by hand between the runs**, from `Twelve roots, four modes` to **`All roots, six modes`** (`src/lib/snippets/en/puzzle.ts:18`, uncommitted). Taken as a decision, not a stray edit. What it settles and what it leaves:

* **The mode count is already right in the working tree**, so `## Done when`'s first bullet holds before the build starts. Its second bullet does not: nothing ties the copy to the count, and `snippets.test.ts:150` is **red right now** — `expected 'All roots, six modes' to be 'Twelve roots, four modes'`. Fixing that assertion is the build's first job.
* **`snippets.test.ts:139` still passes.** It asserts `twoWays` contains `simpleModeOn`, and `simpleModeOn` was not touched.
* **It orphans one third of Q3-A.** That option named three assertions — the mode count, the simple-mode root count, and "Twelve roots" against `ROOTS.length`. The caption no longer states a root number, so the third has nothing left to pin *there*. The first two are unaffected: `simpleModeOn` still says "Six roots".
* **And it puts the ticked Q4-A wording at odds with itself.** Q4-A states "twelve roots" in the intro while the caption now declines to state it. Not a contradiction in meaning — the intro previews, the caption describes — but it moves the number twelve from the switch's caption into the first-two-minutes copy, which is the opposite direction from the edit. Q5 settles it, because `docs/persona.md` has a line about that number specifically and I am not going to guess which way it cuts.

**Size test, re-run against all four answers plus the edit: passes.** Two named constants in **theory**, two strings and their assertions in `snippets/`. Nothing frozen, one revert — noting that the rollback now spans the hand edit as well as the build's, which is still one commit.

## Open questions

### Q5. Does the number twelve appear in the copy at all? — **answered A**

The hand edit took "Twelve roots" out of the switch caption. Q4-A's ticked wording puts "twelve roots" into the How to play box — earlier in the session and in front of a player who has not yet pressed play.

> — `docs/persona.md`, What loses them: *"Being asked what they don't yet know: naked theory vocabulary, **a wall of twelve roots and seven modes on day one**."*

- [x] A) **Follow the edit — no number for the roots anywhere.** The intro reads *"Switch it off for all roots and six named modes."* Q3-A's third assertion is dropped as having nothing to pin, and the two `buildOptions` counts are still named and still asserted *(recommended — it is the reading the hand edit already took, and it is the only option where the twelve never meets Sam before they have played)*
- [ ] B) **Keep Q4-A exactly as ticked.** The caption says "All roots", the intro says "twelve roots". Q3-A's third assertion moves to the intro sentence and pins "twelve" against `ROOTS.length` there
- [ ] C) **Put the number back in both** — revert the hand edit to "Twelve roots, six modes" and keep Q4-A. Q3-A executes exactly as ticked, and the caption states its count the way `simpleModeOn` does

What each costs:

| | A) no number | B) intro only | C) both |
| :-- | :-- | :-- | :-- |
| the hand edit | kept | kept | reverted |
| `simpleModeOff` reads | All roots, six modes | All roots, six modes | Twelve roots, six modes |
| numbers asserted against code | 2 (modes, simple roots) | 3 | 3 |
| the twelve meets Sam | never | in How to play, before first play | on the switch, after they have played |
| symmetry with `simpleModeOn` | broken — one caption counts, the other does not | broken | kept |

**C is the only option that keeps the two captions symmetrical**, and that is a real argument: `simpleModeOn` counts its roots, so a reader may take "All roots" as vagueness rather than as a choice. **A is recommended anyway**, because the persona line above is about this exact number and the switch caption is read *after* the player has already played a day, while the How to play box is read before.

## Answered — Q5-A

**Q5-A. Twelve does not appear in the copy.** The hand edit stands, and the intro follows it rather than the other way round. Q5-A supersedes Q4-A on one word — "twelve roots" becomes "all roots" — which is what Q5 was asked to settle. Q3-A's third assertion is dropped as having nothing left to pin; its other two stand.

**The four files, in their finished state, so the build has nothing to decide.**

* `src/lib/snippets/en/puzzle.ts:18` — `simpleModeOff` is `'All roots, six modes'`. **Already in the working tree**; the build does not touch it.
* `src/lib/snippets/en/intro.ts:13` — `twoWays` becomes `'Two ways to play: Simple mode is six roots, Major or Minor. Switch it off for all roots and six named modes.'`
* `src/lib/theory/music.ts` — two named exports, one per count, used at `:19` and `:23`.
* `src/lib/snippets/snippets.test.ts` — `:150`'s exact-string assertion updated to both new captions, plus the two number assertions Q3-A asks for.

**Two numbers are asserted, and the intro's is pinned for free.** `simpleModeOff`'s "six modes" against the full-mode constant, and `simpleModeOn`'s "Six roots" against the simple-mode one. The intro states "six roots" as well, and `snippets.test.ts:139` already forces `twoWays` to contain `simpleModeOn` verbatim — so the intro's number cannot drift from the caption's without that test failing first. No third assertion needed.

**Assumptions taken rather than asked, on top of those in `## Notes`.**

* **The two counts get two constants, not one shared one.** Both are `6` today and that is a coincidence: one is how many modes full mode offers, the other how many roots simple mode offers. A single constant would make a future change to one silently change the other, which is a worse version of the bug this ticket is fixing.
* **The intro will say "six" twice, meaning two different things** — "six roots" for simple mode and "six named modes" for full. Awkward to read and accurate, and it mirrors the code exactly, where the same two sixes sit two lines apart. Not worth a third round; flagged so it is a choice on the record rather than an oversight.
* **"All roots" gets no test.** It states no number, so there is nothing to tie to code. The asymmetry with `simpleModeOn` — one caption counts, the other does not — is Q5-A's accepted cost and is recorded there.

**Verdict: settled. No question is open.**

## Built

**The corrections come first, because the analyze run got two things wrong and they changed where the code went.**

* **Q1-A and Q3-A named a file the assertions cannot live in.** Both said "assert in `snippets.test.ts`". `src/features/daily-groove/structure.test.ts`'s *"snippets and theory are siblings"* forbids any arrow between `src/lib/snippets/` and `src/lib/theory/`, in either direction, and `docs/coding-guidelines.md:496` says so. The import was written, the structure test caught it on the first full run, and the two assertions moved to `src/features/daily-groove/components/puzzle/ModeToggle.test.tsx` — which renders the caption and already imports both sides. **The guarantee is unchanged; only the file is.** Every *decision* the user ticked — name the counts, two constants not one, leave the card alone, no "twelve" anywhere — was built exactly as ticked.
* **`## Notes`' lint-zone paragraph was wrong**, and it is what sent those answers to the wrong file. It is struck through above rather than deleted. `copiedSentenceRules` is applied once, at `eslint.config.mjs:220`, over `src/features/daily-groove/lib/presentation/**/*.test.ts` only — so it binds the coaching tests and never reached `ModeToggle.test.tsx`. The template-literal reading in it is right and irrelevant: nothing was constraining that file.
* **`## Answered — Q1-A, Q3-A, Q5-A` name `snippets.test.ts` for the number assertions.** Read them as `ModeToggle.test.tsx`. `## Notes`' "the shell stays shut" is also now wrong — `ModeToggle.test.tsx` is a shell file, so the modules touched are **theory + shell**, two, and the size test still passes at its limit rather than under it.

**What changed.**

* `src/lib/theory/music.ts` — `MODE_OPTION_COUNT` and `SIMPLE_ROOT_OPTION_COUNT`, both `6`, at the two `buildOptions` call sites. Two constants because the equal value is a coincidence.
* `src/lib/snippets/en/intro.ts:13` — Q5-A's sentence: *"Two ways to play: Simple mode is six roots, Major or Minor. Switch it off for all roots and six named modes."*
* `src/lib/snippets/en/puzzle.ts:18` — **not touched by this build.** `'All roots, six modes'` was already in the tree, edited by hand between analyze runs.
* `src/lib/snippets/snippets.test.ts` — the exact-string assertion updated to both captions; a new test that `twoWays` says "named modes" and no longer says "guessing modes"; and a pointer to where the numbers are checked.
* `src/features/daily-groove/components/puzzle/ModeToggle.test.tsx` — the two count assertions and a `NUMBER_WORDS` map.
* `src/lib/theory/music.test.ts` — four literal `6`s become the two constants. This is not tidying; see the closed hole below.

**tests:** two that compare the number word in each caption to the constant behind it, and one that the intro names which sense of "mode" it means. All three mutation-checked, and each fails only its own assertion: flipping either constant, flipping the caption's word back to "four", or reverting the intro sentence.

**checks:** lint clean · `tsc --noEmit` clean · `npm test` 3060 · `npm run build` exit 0. The verifier also ran `test:gen` (1585) and `grooves:verify` and found nothing moved, which is D4.

**A hole the verifier found, and closed after it reported.** Q3-A pins the caption against the *constant*, not against the chips — so passing a literal `4` to `buildOptions` while leaving the constant at `6` gave four chips under a caption saying six, with nothing red. `music.test.ts` asserted `toHaveLength(6)` as a literal, so it moved with the change instead of resisting it. Those four literals now read from the constants, and the defeat reddens 31 tests immediately. The chain is now: caption word ↔ constant ↔ the length `flavourOptions` actually returns.

**verifier: pass with gaps.** D1 done, D2 done, D4 done, **D3 partly** — and D3 is not a missing test, it is scope nobody looked at:

* D1 *the caption names the number of modes the card offers* — `ModeToggle.test.tsx` › `says how many modes the full row has`.
* D2 *a test fails if the count in the copy and the number of mode chips ever disagree* — the same test, plus `music.test.ts` › `returns six options including the answer`, now pinned to the constant.
* D3 *nothing in the first two minutes uses "mode" for both senses without saying which* — **partly.** The intro sentence is fixed and `snippets.test.ts` › `says which sense of "mode" the switch turns on (quick-19)` holds it. Two things still use the bare word: `puzzle.modeGroup`, which is `'Mode'` in both modes and which **Q2-A deliberately left alone**, and `intro.steps[2]` — `'Guess the Root & Mode '` — which no question in three rounds looked at, and which is the stronger case: a numbered How-to-play step read *before* the first play. The bullet says "nothing", and two things remain.
* D4 *no audio re-renders, no puzzle answer changes* — nothing under `scripts/grooves/`, `public/grooves/` or the manifest is in the diff.

## D3 narrowed, and the row closed

2026-09-10, on the user's instruction: *"narrow D3 and mark it done."*

D3 read *"Nothing in the first two minutes uses 'mode' for both Major/Minor and the six
named modes without saying which it means."* The verifier graded it **partly** and was
right to. Two pieces of copy still use the bare word, and the first of them is the
reason the bullet could not stand:

* **`puzzle.modeGroup` is `'Mode'` in both modes** — and **Q2-A chose that deliberately**,
  because `modeGroup` is the accessible name `testing/puzzleHarness.tsx`,
  `GuessCard.test.tsx` and `GroovePuzzle.page.test.tsx` use to find the chips. So the
  bullet as written was unachievable without reversing an answered question. It was
  written before Q2 settled, and Q2 is what settled it.
* **`intro.steps[2]` — `'Guess the Root & Mode '`** — a numbered How to play step read
  before the first play. No question in three rounds looked at it; Q2 framed the
  collision as `twoWays` versus the card, and the step was never in frame. **This one is
  a real residual**, not a wording problem, and it is left open rather than quietly
  folded in: narrowing D3 does not fix it, and making the step specific while the card
  still says "Mode" for both would be inconsistent in the other direction. It wants its
  own ticket if it is worth one.

The bullet now claims what was actually built and what Q2-A actually decided: the How to
play box supplies the mapping, and the card keeps "Mode" for both. That is held by
`src/lib/snippets/snippets.test.ts` › *says which sense of "mode" the switch turns on
(quick-19)*, which asserts both halves — that `intro.twoWays` contains "named modes" and
that it no longer contains "guessing modes", the negative half being load-bearing rather
than decoration.

**D1 done · D2 done · D3 done against the narrowed bullet · D4 done.** Re-ran the three
files behind them: 154 passed. The build itself was committed in `fa8f005` and no code
changed here — only the bullet.

One coverage note stands, from the verifier and unaddressed: the test asserts one
qualifier in one sentence, not D3's general property, so a new ambiguous first-two-minutes
line added tomorrow reddens nothing.

**Row ✅ Done.**
