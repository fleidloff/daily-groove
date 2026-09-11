# Architecture decisions

One line per decision. Each entry points at its own file in this folder.

An ADR records a decision that was hard to make and would be expensive to
reverse — why it was taken, and what it rules out. It is not documentation of
how the code works: [architecture.md](../architecture.md) and
[coding-guidelines.md](../coding-guidelines.md) own that, and an ADR that has
become the shape of the tree belongs there instead.

## Numbering

Every ADR is `NNNN-slug.md`, four digits with leading zeros, allocated in order
and never reused. `0000-template.md` is the template and is not a decision.

## Status

Status runs 🤔 **Proposed** → ✅ **Accepted** → 🚫 **Rejected**, and an accepted
one can later become ⛔ **Superseded** by a higher number. **A superseded ADR is
never edited or deleted** — it is the record of what was true when it was taken.
The new one says which number it replaces; the old one says which number
replaced it.

| # | Decision | Status | Date |
| :-- | :-- | :-- | :-- |
| [0001](0001-progress-lives-in-the-browser-only.md) | Progress lives in the browser only | ✅ Accepted | 2026-08-21 |
| [0002](0002-the-answer-is-an-absolute-root-and-mode.md) | The answer is an absolute root and mode | ✅ Accepted | 2026-08-21 |
| [0003](0003-the-days-groove-is-a-function-of-the-date.md) | The day's groove is a function of the date | ✅ Accepted | 2026-08-21 |
| [0004](0004-one-guess-a-day-then-the-reveal.md) | One guess a day, then the reveal | ⛔ Superseded by [0034](0034-attempts-are-unlimited.md) | 2026-08-21 |
| [0005](0005-all-layout-lives-in-the-design-system.md) | All layout lives in the design system | ✅ Accepted | 2026-08-29 |
| [0006](0006-grooves-are-pre-rendered-mp3s.md) | Grooves are pre-rendered MP3s from an offline generator | ✅ Accepted | 2026-08-29 |
| [0007](0007-determinism-is-asserted-on-the-pcm.md) | Determinism is asserted on the pre-encode PCM | ✅ Accepted | 2026-08-29 |
| [0008](0008-how-a-groove-sounds-is-settled-by-ear.md) | How a groove sounds is settled by ear | ✅ Accepted | 2026-08-29 |
| [0009](0009-every-sample-is-permissively-licensed.md) | Every sample is permissively licensed, and the credit ships | ✅ Accepted | 2026-08-29 |
| [0010](0010-a-feel-carries-exactly-two-modes.md) | A feel carries exactly two modes | ⛔ Superseded by [0040](0040-a-feel-carries-two-to-four-modes.md) | 2026-08-29 |
| [0011](0011-a-minted-grooves-audio-is-frozen.md) | A minted groove's audio is frozen forever | ⛔ Superseded by [0020](0020-only-identity-is-frozen.md) | 2026-08-29 |
| [0012](0012-the-guidelines-are-lint-zones-and-structural-tests.md) | The guidelines are lint zones and structural tests | ✅ Accepted | 2026-08-30 |
| [0013](0013-the-page-ends-at-the-puzzle.md) | The page ends at the puzzle | ✅ Accepted | 2026-08-30 |
| [0014](0014-the-flavours-are-named-modes.md) | The flavours are named modes | ✅ Accepted | 2026-08-30 |
| [0015](0015-simple-mode-is-fewer-names.md) | Simple mode is fewer names, not an easier puzzle | ✅ Accepted | 2026-08-30 |
| [0016](0016-the-rota-plays-every-groove-once.md) | The rota plays every groove once before it repeats | ✅ Accepted — amends [0003](0003-the-days-groove-is-a-function-of-the-date.md) | 2026-08-30 |
| [0017](0017-the-nudge-hands-the-root-over.md) | The nudge hands the root over after two misses | ⛔ Superseded by [0028](0028-the-hint-narrows-only-the-reveal-reveals.md) | 2026-08-30 |
| [0018](0018-the-app-is-named-eardle.md) | The app is named Eardle | ⛔ Superseded by [0051](0051-the-app-is-named-groovdle.md) | 2026-08-31 |
| [0019](0019-a-groove-is-sixteen-bars-shown-as-four.md) | A groove is sixteen bars of loop, shown as four | ✅ Accepted | 2026-08-31 |
| [0020](0020-only-identity-is-frozen.md) | Only a groove's identity is frozen; its audio may always re-render | ✅ Accepted — supersedes [0011](0011-a-minted-grooves-audio-is-frozen.md) | 2026-08-31 |
| [0021](0021-the-ear-aids-play-one-sound.md) | The ear aids play one sound, and there is no instrument on screen | ✅ Accepted | 2026-08-31 |
| [0022](0022-tapping-to-hear-is-never-a-guess.md) | Tapping a chip to hear it is never a guess | ✅ Accepted | 2026-08-31 |
| [0023](0023-every-groove-carries-a-uuid.md) | Every groove carries a uuid, and the share link is that uuid | ✅ Accepted | 2026-08-31 |
| [0024](0024-swapping-a-voice-is-a-normal-change.md) | Swapping the recording behind a voice is a normal change | ✅ Accepted | 2026-09-01 |
| [0025](0025-the-test-suite-runs-in-tiers.md) | The test suite runs in tiers | ✅ Accepted | 2026-09-01 |
| [0026](0026-the-work-is-specified-then-built-by-agents.md) | The work is specified in documents, then built by specialised agents | ✅ Accepted | 2026-09-01 |
| [0027](0027-the-reveal-teaches-in-degrees.md) | The reveal teaches in degrees, on one screen | ✅ Accepted | 2026-09-01 |
| [0028](0028-the-hint-narrows-only-the-reveal-reveals.md) | The hint narrows; only solving or giving up reveals | ✅ Accepted — supersedes [0017](0017-the-nudge-hands-the-root-over.md) | 2026-09-02 |
| [0029](0029-a-confirmed-answer-locks-for-the-day.md) | A confirmed root or mode locks for the day | ✅ Accepted | 2026-09-02 |
| [0030](0030-the-hint-box-coaches-the-ear-all-day.md) | The hint box coaches the ear for the whole day | ✅ Accepted | 2026-09-02 |
| [0031](0031-six-modules-in-one-repo.md) | Six modules in one repo, not services | ✅ Accepted | 2026-09-02 |
| [0032](0032-music-theory-is-shared-code.md) | Music theory is shared code in `src/lib/theory` | ✅ Accepted | 2026-09-02 |
| [0033](0033-coaching-has-one-door.md) | Coaching has one door, and the card feeds itself | ✅ Accepted | 2026-09-02 |
| [0034](0034-attempts-are-unlimited.md) | Attempts are unlimited; a solve is a solve | ✅ Accepted — supersedes [0004](0004-one-guess-a-day-then-the-reveal.md) | 2026-09-03 |
| [0035](0035-every-string-lives-in-one-place.md) | Every user-facing string lives in `src/lib/snippets/en` | ✅ Accepted | 2026-09-03 |
| [0036](0036-a-first-time-player-starts-in-simple-mode.md) | A first-time player starts in Simple mode | ✅ Accepted | 2026-09-03 |
| [0037](0037-transposition-changes-what-is-written.md) | Transposition changes what is written, never what is heard | ✅ Accepted | 2026-09-04 |
| [0038](0038-the-reveal-names-a-track-youve-heard-it-in.md) | The reveal names a track you have heard the mode in | ✅ Accepted | 2026-09-04 |
| [0039](0039-every-progression-names-four-chords.md) | Every progression names four chords | ✅ Accepted | 2026-09-04 |
| [0040](0040-a-feel-carries-two-to-four-modes.md) | A feel carries two to four modes, and the sets may overlap | ✅ Accepted — supersedes [0010](0010-a-feel-carries-exactly-two-modes.md) | 2026-09-05 |
| [0041](0041-a-played-date-keeps-its-groove.md) | A played date keeps its groove; `ROTA_EPOCH` reshuffles the rest | ✅ Accepted | 2026-09-05 |
| [0042](0042-three-licks-per-mode.md) | Three licks per mode, one picked for the day | ✅ Accepted | 2026-09-05 |
| [0043](0043-the-mode-row-offers-six-names.md) | The mode row offers six names and never narrows itself | ✅ Accepted | 2026-09-05 |
| [0044](0044-dev-only-pages-live-in-the-tree.md) | Dev-only pages live in the tree and not in the build | ✅ Accepted | 2026-09-05 |
| [0045](0045-a-song-becomes-a-groove-inside-the-existing-styles.md) | A song becomes a groove inside the existing styles | 🚫 Rejected — see [0052](0052-a-groove-is-not-built-from-a-named-song.md) | 2026-09-06 |
| [0046](0046-the-rota-spreads-mode-root-and-style.md) | The rota spreads mode, root and style over three days | ✅ Accepted — amends [0016](0016-the-rota-plays-every-groove-once.md) | 2026-09-06 |
| [0047](0047-the-dominance-floor-rises-by-minting.md) | The dominance floor rises by minting, not by widening the ratio | ✅ Accepted | 2026-09-06 |
| [0048](0048-one-audio-stage-with-a-persisted-level.md) | One audio stage with a persisted master level | 🤔 Proposed | 2026-09-08 |
| [0049](0049-a-comp-figure-may-span-bars.md) | A comp figure may span more than one bar | ✅ Accepted | 2026-09-08 |
| [0050](0050-the-generators-tests-grade-what-is-wrong.md) | The generator's tests grade what is wrong, not what is different | 🤔 Proposed | 2026-09-08 |
| [0051](0051-the-app-is-named-groovdle.md) | The app is named Groovdle | ✅ Accepted — supersedes [0018](0018-the-app-is-named-eardle.md) | 2026-09-11 |
| [0052](0052-a-groove-is-not-built-from-a-named-song.md) | A groove is not built from a named song | 🚫 Rejected — replaces [0045](0045-a-song-becomes-a-groove-inside-the-existing-styles.md) | 2026-09-11 |
| [0053](0053-stats-are-computed-on-the-server.md) | Stats are computed on the server | ✅ Accepted — amends [0001](0001-progress-lives-in-the-browser-only.md) | 2026-09-11 |
| [0054](0054-the-stats-page-shows-no-guilt.md) | The stats page shows no guilt | ✅ Accepted | 2026-09-11 |
