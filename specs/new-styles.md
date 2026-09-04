# New styles

Candidates for new feels, to come back to. Everything here fits the voices we
already sample — kit (kick, snare, hats, rim, toms), bongos, bass, keys — and the
four-bar, four-beat loop. Written after quick ticket 3, 2026-09-04.

## The rule we will drop

Today each feel owns exactly two flavours, and the six pairs are disjoint —
[music.md](../docs/music.md) "The six feels", enforced by
`scripts/grooves/templates/index.test.ts` ("flavour coverage"). It comes from
feature-3's PRD (epic 3, Q4: two flavours per template, chosen for musical fit)
and feature-9's (epic 6: hearing the feel narrows the mode). With twelve
flavours across six feels, every flavour is taken, so a seventh feel cannot get
a pair of its own.

**Decision:** each style owns two to four modes, and the sets are no longer
disjoint. A feel is still a clue to the mode, just a weaker one. What stays:
every flavour the game offers has grooves behind it, and no groove answers to a
flavour the game does not offer. The three tests and the sentence in
`music.md` change with it. Existing templates keep their `flavours` lists as
they are — reordering or removing an entry re-renders that template's grooves
and reassigns past puzzles; adding to a list appends.

## Candidates

Ordered by how well they fit what we have.

| Style | What it sounds like on our voices | Modes | Notes |
| :-- | :-- | :-- | :-- |
| **Bossa Nova** | Rim click on the bossa clave, kick as the surdo (1 and the "and" of 2, or dotted), ride or hat in straight eighths, root–fifth bass locked to the kick, keys on the syncopated bossa comp figure. Straight, 120–140 bpm. | ionian, lydian (Jobim's ♯4), dorian; melodic minor for the minor tunes | Harmony is maj7 / m7 throughout, which the chord derivation already produces. |
| **Afro-Cuban / son montuno** | 2-3 clave on the rim, tumbao bass anticipating the "and" of 2 and beat 4, montuno figure on the keys, bongos as a lead voice for once. | mixolydian, dorian, phrygian-dominant | The only style that would use the bongos for more than decoration — the strongest reason to add it. |
| **Reggae one-drop** | Kick and rim together on 3, nothing on 1, hat on the off-beats, skank keys on the "and"s, bass very present. 70–80 bpm. | aeolian, mixolydian, ionian | Sounds like nothing in the current six. |
| **Second line / New Orleans** | Syncopated snare over a clave-ish kick, bass following the kick, keys sparse. | blues, mixolydian | Kit-heavy; toms and rim earn their place. |
| **Boom-bap** | 85–95 bpm swung sixteenths, hard kick and snare, sparse keys, ghost notes. | dorian, aeolian, phrygian | Cheap, but sits close to `straight-funk` and `half-time`, so the feel-as-clue gets weaker still. |

## Not cheap

These break something structural and are their own features:

- **12-bar blues** — `BARS_PER_PASS = 4`, the four-segment transport, the
  four-bar lead sheet and quick ticket 2's "always four chords" all assume four
  bars. Already a candidate idea in `features.md` ("more styles").
- **Jazz waltz, 6/8 Afro, gospel 12/8** — the sixteenth grid assumes four beats
  a bar; a 3/4 or 12/8 feel wants a 12- or 24-step grid, which touches
  `events.ts` throughout.

## How it would go

Full feature, not a quick ticket: a template is tempo, swing, subdivision,
voices, gains, pans, a humanize block, placements, a fill vocabulary, minted
grooves, a re-rendered manifest and a listening sign-off. `/create-feature`
with a briefing along the lines of "Bossa Nova and a montuno; two to four
modes per feel, no longer disjoint", then `/roadmap`. Epics would likely be:
the rule and its tests, one epic per template, minting and sign-off. The
`musician` decides each template's parameters.
