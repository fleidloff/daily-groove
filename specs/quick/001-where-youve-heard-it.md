# 001 — Where you've heard it

## What

* Name one well-known track in the solved box — "you've heard this in —".
* Text only. No links, no playback, no artwork.
* The line names the mode and the root, not the day's groove, so it is the same for every
  groove in that mode.
* 1 example per mode and root. The examples are stored in the grooves.generated.ts
* examples are optional. Only add one if you find something well known
* in the future, the generator will add examples when generating new grooves
* _(added after the first build, from chat)_ try harder finding examples; jazz standards from the Real Book are welcome — not as famous, but worth checking out

## Done when

* Solving a puzzle in any of the twelve modes shows a reference line naming a
  track and its artist (when we found one before).
* A mode with no reference renders nothing — no empty label, no dash.
* The line reads the same before and after the reveal, and on a shared groove
  opened on another day.
* `src/lib/snippets/snippets.test.ts` covers the new snippet the way it covers
  `modeLine`.

## Open questions

### Q1. How does the manifest carry the examples?

- [x] A) A separate `HEARD_IN` export in `grooves.generated.ts`, keyed by the scale string the groove already carries (`'C mixolydian'`), rendered from a scale-keyed table under `scripts/grooves/` *(recommended — it mirrors "names the mode and the root, not the day's groove": one entry per scale, the `Groove` contract in `src/lib/groove.ts` untouched, and the shell looks it up with `HEARD_IN[groove.scale]`)*
- [ ] B) A new optional `heardIn` field on every groove entry, filled by the generator from the same scale-keyed table — simpler read in the shell, but a per-scale fact copied onto every groove in that scale, and a change to the shared `Groove` type and the manifest's field list

## Notes

* Size test: **passes.** One idea, two modules (catalogue, shell), none of the four frozen things (`hash.ts`, the `events` draw order, `FLAVOURS`, uuids) touched, one revert.
* Rendering the manifest is `npm run grooves -- --manifest-only`: no audio is re-encoded, so every mp3 keeps its hash; the same run rewrites `manifestSha256` in `grooves.lock.json`. Lock is green today (30 grooves, 24 notes).
* Files, option A:
  * `scripts/grooves/heard-in.json` — the table, `scale → { track, artist }`; `heardIn.ts` reads it and checks every key is a scale the catalogue renders. Test beside it.
  * `scripts/grooves/manifest.ts` — renders `HEARD_IN`; `cli.ts` passes the table in. `manifest.test.ts` extended.
  * `src/lib/groove.ts` — adds `export type HeardIn`. Shared by generator and app, so this is the only place it can sit.
  * `src/features/daily-groove/data/grooves.generated.ts` — re-rendered; `grooves.generated.test.ts` checks every `HEARD_IN` key is a shipped scale and every value has a non-empty track and artist.
  * `scripts/grooves/grooves.lock.json` — new manifest hash.
  * `src/lib/snippets/types.ts`, `en/solved.ts` — `solved.heardIn({ track, artist })`; `snippets.test.ts`.
  * `src/features/daily-groove/components/solved/SolvedPanel.tsx` — optional `heardIn` prop, one line; `SolvedPanel.test.tsx`.
  * `src/features/daily-groove/components/GroovePuzzle.tsx` — passes `HEARD_IN[groove.scale]`. A page test covers the shared-groove route showing the same line.
* Option B swaps the middle three for: `heardIn?` on `Groove`, a new entry in the manifest's `FIELDS` plus an object case in `literal()`, and a lookup in `cli.ts`'s `toGroove`.
* The catalogue holds 30 grooves in 30 distinct scales, so today "one per mode and root" is one per groove. Twelve modes, not every root of each.
* Who picks the tracks: the `musician` agent, per §7, with the brief to name a recording only when it is well known and its recorded key genuinely is that root and mode — a maybe stays empty. The picks land in `## Built` for a look before commit. Nothing is committed by the run.
* Placement: a third muted `Text` in the solved box's top stack, under the mode line and the near-miss line. Same style as the mode line, so it reads as one sentence about the mode.
* Wording, from the ticket: `You've heard this in “<track>” by <artist>`. Change it in `en/solved.ts` if it reads wrong.
* Missing entry → the prop is `undefined` and the `Text` is not rendered. Nothing else changes, so the line is identical for a solve, a give-up, and a shared groove opened on another day: it is a function of the groove's scale and nothing else.
* Done-when bullet 4 as written cannot be settled: `snippets.test.ts` has no `modeLine` test — the `modeLine` coverage sits in `src/lib/modeCharacter.test.ts`. Reading taken: cover `heardIn` the way `snippets.test.ts` covers its other interpolating snippets (`bpm`, `streakDays`): same output for the same arguments, and both arguments rendered.
* `docs/music.md`'s "Where to change what" table gets one row pointing at `heard-in.json`. Not checked by `docs.test.ts`.
* Related candidate idea "Groove selection" (grooves inspired by jazz standards, shown on reveal) is not covered by this — it is about how grooves are generated. Its row stays.

## Built
* `src/lib/groove.ts` — `HeardIn` type, shared by generator and app
* `scripts/grooves/heard-in.json` — the table, 21 scales of 30 after a second `musician` pass that admitted Real Book standards and classical themes; the 9 empty ones (A♭ phrygian, B / C♯ / E♭ phrygian dominant, C♯ lydian dominant, C♯ / D lydian, E harmonic major, G melodic minor) had no recording the musician could place on that root
* `scripts/grooves/heardIn.ts` — reads the table, `heardInFailures` names keys no groove renders and empty fields
* `scripts/grooves/manifest.ts` — renders `HEARD_IN: Record<string, HeardIn>` after the pools; `cli.ts` reads and checks the table before writing
* `src/features/daily-groove/data/grooves.generated.ts` — re-rendered manifest-only; `grooves.lock.json` carries the new `manifestSha256`, every mp3 hash unchanged
* `src/features/daily-groove/types.ts` — re-exports `HeardIn`
* `src/lib/snippets/types.ts`, `en/solved.ts` — `solved.heardIn({ track, artist })`
* `src/features/daily-groove/components/solved/SolvedPanel.tsx` — optional `heardIn` prop, one muted `Text` under the mode and near-miss lines
* `src/features/daily-groove/components/GroovePuzzle.tsx` — passes `HEARD_IN[groove.scale]`
* `docs/music.md` — one row in "Where to change what"
* tests: `scripts/grooves/heardIn.test.ts` (new, includes the committed table); `manifest.test.ts` (+6); `cli.test.ts` (+2, table lands in the manifest / stale key refused); `data/grooves.generated.test.ts` (+3); `snippets.test.ts` (+2); `SolvedPanel.test.tsx` (+4); `GroovePuzzle.page.test.tsx` (+3, shared groove solved / given up / no entry)
* picks: see `heard-in.json`. Four carry a caveat from the musician, strike them if too loose: A harmonic major — In My Life (the ♭6 is one D→Dm moment, F♯m sits outside the scale); D mixolydian — Sweet Home Alabama (D-vs-G tonic is contested, the D reading is the mixolydian one); D phrygian — Flamenco Sketches (one of five sections); E♭ dorian — So What (the bridge, the A sections are D dorian)
* checks: lint — 0 errors, 1 pre-existing warning (`gate.test.ts` unused import, on main before this) / tsc — pass / test — 130 files, 2665 pass / test:gen — 38 files, 823 pass / build — pass, prebuild `grooves:verify` included
