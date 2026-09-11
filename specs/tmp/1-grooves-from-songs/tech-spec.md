# V1. Grooves from songs — tech spec

**Phase:** ready to build — `/implement-vibe-with-docs 1`

## Contracts

Frozen up front so the three epics build against them rather than against each
other.

```ts
// scripts/grooves/catalogue.json — the entry gains one optional field
type CatalogueEntry = {
  id: string; uuid: string; template: string; seed: number
  chords?: string[]   // four chord names; the song's title and artist live
                      // in heard-in.json, keyed by this entry's uuid
}

// scripts/grooves/heard-in.json — a second key space beside "<root> <mode>"
type HeardInTable = Record<string, { track: string; artist: string }>
// keys: "E♭ dorian" as today, or a groove uuid

// scripts/grooves/theory/harmony.ts — a sibling of buildHarmony
export function harmonyFromChords(
  root: Root, flavour: Flavour, names: readonly string[],
): Harmony   // each name snapped to the nearest in-scale chord of that scale
```

`buildHarmony(root, flavour, rng)` keeps its signature and its behaviour
exactly. The declared path is a second constructor, not a parameter on the
existing one — a groove with no `song` draws as it always has, byte for byte.

## Epics

Three, per `spec.md` Q-epics. Epic 1 and Epic 2 own disjoint files and can run
at once; Epic 3 needs both.

### Epic 1 — A groove can name the song it was built on

Ships alone: with a hand-written uuid entry in `heard-in.json`, the reveal says
so. Nothing has to be minted to prove it.

#### Track A — resolve uuid before scale, and say it differently

* **Role:** `implementer`
* **Owns:** `scripts/grooves/heardIn.ts`, `src/lib/snippets/en/solved.ts`,
  `src/features/daily-groove/lib/presentation/` (a new `selectHeardIn`, exported
  through `index.ts`), `src/features/daily-groove/components/solved/SolvedPanel.tsx`,
  and the one line of `GroovePuzzle.tsx` that stops indexing the table
* **Needs to start:** the `HeardInTable` contract
* **Module:** catalogue, coaching and shell

Today `GroovePuzzle.tsx:325` does `HEARD_IN[groove.scale]` inline and
`solved.heardIn` renders "You've heard this scale in …". This epic adds the
uuid key space, the precedence rule, and the second line.

### Epic 2 — A groove can declare its chords

Ships alone: a hand-written `song` block on a catalogue entry mints a groove
whose progression is the declared one.

#### Track B — `harmonyFromChords`, and the entry that reaches it

* **Role:** `musician` then `implementer` (the two-turn shape)
* **Owns:** `scripts/grooves/theory/harmony.ts`, `scripts/grooves/types.ts`,
  `scripts/grooves/add.ts`, `scripts/grooves/catalogue.json`
* **Needs to start:** the `harmonyFromChords` contract
* **Module:** catalogue

The musical decision is what "nearest in-scale chord" means — `chordsForScale`
already returns every chord a scale supports with its degree, so snapping is a
choice of distance, not a new theory. The `musician` decides it; an
`implementer` writes it.

### Epic 3 — The skill does it unattended

Needs Epic 1 and Epic 2 merged.

#### Track C — the skill

* **Role:** `implementer`
* **Owns:** `.claude/skills/<name>/SKILL.md`
* **Needs to start:** both epics above
* **Module:** none — it is prose, like every other skill

Takes a song, picks a feel and says why, derives four chords, writes the `song`
block and the uuid `heard-in.json` entry, renders a candidate, and **commits
nothing**. A second command commits: manifest, lock, `ROTA_EPOCH`, `SIGN_OFFS`.

## Waves

* **Wave 1 (parallel):** Track A, Track B
* **Wave 2:** Track C — needs both

## Open

**Q7. Where does the uuid-before-scale resolution live? Answered:
`lib/presentation/`, behind its door.** `selectHeardIn(groove)` joins the other
coaching rules and the composer calls the door instead of indexing a table,
which is what [ADR 0033](../../../docs/adr/0033-coaching-has-one-door.md) asks
of any rule the shell would otherwise grow. The manifest keeps carrying the
whole `HEARD_IN` table.

**Q8. Which file owns the song's name? Answered: `heard-in.json`.** The
catalogue entry carries only the four chords; the uuid row carries title and
artist. One owner each, and the briefing's bullet taken literally — a uuid line
can still be written by hand.

*Nothing is open.*

## The size test

Two of the four questions fail, which is a suggestion and not a gate — and the
waiver is already in `spec.md`: this went through this door on purpose, to be
compared against `specs/features/feature-26/`.

| Question | Verdict |
| :-- | :-- |
| five bullets or fewer | **no** — 7 in `## What`, 9 in `## Done when` |
| at most two of the six modules | **no** — catalogue, coaching and shell |
| nothing frozen in `docs/music.md` | yes — no draw is added to `MUSIC_LABEL`, `hash.ts` is untouched, and `ROTA_EPOCH` is the value that is *meant* to move |
| one `git revert` | yes, with one caveat — a date played between the mint and the revert keeps its pinned groove |

## Checks

`npm run lint && npm test && npm run build`, plus `npm run test:gen` — Epic 2
is entirely under `scripts/grooves/`.

## Risks

* **Nothing existing may re-render.** A groove with no `song` block must draw
  byte-identically: `harmonyFromChords` is a second constructor and adds no
  draw to `MUSIC_LABEL`, per
  [ADR 0020](../../../docs/adr/0020-only-identity-is-frozen.md). The exit gate
  is a full re-render to a scratch directory hashed against the lock.
* **Minting bumps `ROTA_EPOCH`**, per
  [ADR 0041](../../../docs/adr/0041-a-played-date-keeps-its-groove.md) — every
  unplayed date remaps, played dates keep their groove.
* **The declared progression is four chords, one per bar**, per
  [ADR 0039](../../../docs/adr/0039-every-progression-names-four-chords.md).
* **`heard-in.json` is validated in `cli.ts`**, which throws when a shipped
  scale has no entry. A uuid key must not break that check.
