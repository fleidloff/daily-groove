# V1. Grooves from songs

Started 2026-09-11 · `/vibe-with-docs`
**Phase:** ready to build — `/implement-vibe-with-docs 1`

## What

* A Claude skill that takes a song (e.g. Summertime) and figures out which of
  our existing styles works best for it.
* The same skill figures out the four chords that resemble the song best.
* The skill creates the groove.
* No new style is created for it — do everything inside the boundaries we
  already have.
* `heard-in.json` gains the possibility to reference a heard-in entry by groove
  uuid.
* A groove with a uuid entry uses that entry; every other groove falls back to
  the current root + mode lookup.

## Done when

* Naming a song to the skill produces a rendered mp3, the four chords it
  declared, and the style it chose — and commits nothing.
* The reveal for a groove with a uuid entry says the groove was built on that
  song, in wording of its own; a groove without one reads exactly as it does
  today.
* A second, separate command commits the signed-off candidate: catalogue entry,
  manifest, lock, `ROTA_EPOCH` bumped, `SIGN_OFFS` pinned.
* A groove minted this way plays a progression the skill declared, not one the
  seed's draw produced.
* Every chord in a declared progression is derivable from the answer's scale,
  by the same rule a drawn progression obeys.
* A `heard-in.json` entry keyed by groove uuid wins over the root+mode entry
  for that groove; every other groove reads the root+mode entry exactly as it
  does today.
* No existing groove re-renders and no committed answer moves: `src/lib/hash.ts`,
  `MUSIC_LABEL`'s draw order and every existing `uuid` are untouched, and
  `npm run grooves:verify` is clean.
* No new feel, template or mode is added.

## Decided

* **Why this is here and not feature-26** — the same six bullets are
  `specs/features/feature-26/briefing.md`, already carried through the chain to
  three PRDs and three tech specs. Fred's call: re-spec it through this door
  **and leave feature-26 in place**, to compare the two spec-driven approaches
  before either is built.
* **A new groove may declare its chords** — the catalogue entry states the
  progression instead of deriving it from the seed's draw, so any song is
  reachable exactly rather than sometimes. Fred's call over the seed-search
  option I recommended. It costs a second harmony path: `buildHarmony(root,
  flavour, rng)` in `theory/harmony.ts` gains a sibling that takes chord names
  and parses them with the existing `pitchClassesOf`, which is already
  `chordNameFor`'s inverse. Nothing committed moves — a groove that does not
  exist yet has no answer to reassign — so
  [ADR 0020](../../../docs/adr/0020-only-identity-is-frozen.md) still holds.
* **Sam settled what may claim a song**, and the decision above satisfies it by
  making the exact match always reachable: *"Don't claim the song… If the
  reveal says 'built on Summertime' I will pick up the guitar and play
  Summertime over it… then the bar where the chord is wrong collides with what
  my hands are doing, and I don't have the theory to work out whether the app
  is wrong or I am."* Sam also rates the song line as worth having over today's:
  *"That's not the same claim wearing a better label, it's the difference
  between a listening tip and a play-along."*
* **I have not read feature-26's PRDs or tech specs**, deliberately. Reading
  them would make this a transcription rather than a second opinion, and the
  comparison is the point. Say the word and I will read them instead.

## What the tree already gives us

* `scripts/grooves/heard-in.json` is keyed by `"<root> <mode>"` —
  `"E♭ dorian": { "track": "So What", "artist": "Miles Davis" }` — read by
  `heardIn.ts` and validated in `cli.ts`, which throws when a shipped scale has
  no entry.
* Minting today is `npm run grooves:add <n> [-- --template <id>]`: n seeds
  drawn against one feel, each candidate passing or failing the quality gate.
  **Nothing in it can ask for particular chords.**
* Harmony comes from the seed through `MUSIC_LABEL`'s draw order, which
  [ADR 0020](../../../docs/adr/0020-only-identity-is-frozen.md) freezes. That
  is the constraint the whole feature turns on.

## Open

* **Q2 — must a declared progression still be in-scale for the answer's mode?**
  **Answered: in-scale, with the nearest substitution, and the song still
  named.** Fred's call, over my recommendation and against Sam's verdict — so
  the chords always fit the scale, the puzzle stays answerable, and the reveal
  always gets to name the song.
* **Q3 — does the reveal say the changes were adapted? Answered: no.** The
  reveal names the song the same way whether or not a chord moved. Fred's call,
  over my recommendation and after the case was put; no reason stated, so none
  is recorded here rather than one being invented. This is the second decision
  in this spec that goes against Sam's verdict, and both stand — what the app
  promises the player is Fred's to decide, not the persona's.

  What it means in practice, so nobody re-opens it by accident: a player who
  knows the tune may hear a chord that is not the one they expect, with nothing
  on the page accounting for it. That is accepted.
* **Q4 — does the skill commit the groove? Answered: no — it hands over a
  candidate.** The skill renders and reports; a second command commits once
  Fred has listened. Matches
  [ADR 0008](../../../docs/adr/0008-how-a-groove-sounds-is-settled-by-ear.md):
  the quality gate cannot hear that a groove is dull, so an ear stands between
  minting and the catalogue.
* **Q5 — what does the reveal say? Answered: a distinct "built on" line.** A
  groove with a uuid entry reads differently from one resolved by root and
  mode, and says the groove was built on the song. Taken together with Q3 this
  is the app's fullest claim: the line promises the changes are the tune's and
  does not qualify itself when a chord was moved to fit the mode.
* **Q6 — who picks the style? Answered: the skill does, and says why.** One
  candidate per run, the reasoning stated; re-run for a different one. The
  briefing's "figures out which of our existing styles works best" taken
  literally, and the sign-off in Q4 is where the ear gets its say.

*The spec is settled. Remaining questions are in `tech-spec.md`.*
