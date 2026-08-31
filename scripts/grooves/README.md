# The groove generator

This directory is an offline tool. It renders the audio the app plays and, in the same
pass, writes down the answers that go with it — the scale, the chord, the progression,
the root, the flavour, the tempo. Both the audio and the answers are committed to the
repository; nothing is generated in the browser and nothing is generated during a build.

The app only ever imports the finished manifest. If you never touch a groove, you never
need any of this. If you want more grooves, you need two commands, and they are at the
top of the next two sections.

## The pipeline, in four stages

`npm run grooves` walks the committed catalogue and puts every entry through the same
four stages. `cli.ts` is the whole pipeline in one function if you want to read it.

**1. Events** — `events.ts`. A `{ template, seed }` pair goes in. The feel template is
the part a human decided: tempo range, subdivision, swing, which voices play, how loud,
where in the stereo image, the two flavours it is allowed to use, and the note-density
band it must stay inside. The seed decides everything else. Out comes a list of note
events — voice, time, duration, velocity, and a MIDI pitch for the bass and the comp —
**and** a `MusicMeta` describing them: `C minor`, `Cm7`, `Cm–Fm–G7`, 96 bpm, 4 bars.

This is the stage worth understanding, because the answers and the audio leave it
together. The words are not transcribed from the music by a human, and they are not
attached to the music afterwards: one function derives the harmony, spells it as a
display string, and emits the note events from that same harmony. A groove's stated
scale therefore cannot drift from what it plays. There is no path through the code where
they disagree.

**2. Voices** — `voices.ts`. Events plus the sample pack become one PCM buffer per voice.
The event's velocity picks the sample layer, a seeded round-robin picks the alternate
within it, and pitched voices are shifted from the nearest sampled note. The buffer is
rendered one bar *past* the end of the loop, so a cymbal struck near the end of bar 4 is
not simply cut off.

**3. Mix** — `mix.ts`. The per-voice tracks become one stereo buffer: template gain,
template pan, summed, then that extra bar of overhang is folded back onto bar 1. That is
what makes the loop seamless — the tail of bar 4 rings over bar 1 exactly as it would if
the loop were really repeating, and the downbeat transient is left untouched rather than
smeared by a crossfade. The bus rounds the crest and the master is scaled so its true
peak sits just under full scale, so a groove is never clipped and never arrives silent.

**4. Encode** — `encode.ts`. The stereo buffer is piped into ffmpeg as raw `f32le` and
comes back as a 192 kbps mp3 in `public/grooves/`.

After the loop over the catalogue, the run writes the manifest and then the lock file.

## Adding grooves

```bash
npm run grooves:add 3      # mint three new grooves
git add -A && git commit   # the artifacts are part of the repo
```

`grooves:add <n>` mints exactly `n` new grooves and stops. For each one it takes a fresh
seed, renders it all the way through the four stages in memory, and puts the result
through an automated quality gate: harmony valid for the flavour it claims, peak in
range, not silent, note density inside the template's band, and a clean loop seam. A
candidate that fails is discarded — it never reaches disk — the failed check is printed,
and the next seed is tried. A run that rejects a dozen candidates still ends with exactly
`n` grooves and never asks you anything. If it cannot find `n` good grooves within a
bounded number of attempts it fails loudly and leaves the tree untouched, rather than
quietly adding fewer.

A batch is spread across the templates rather than piled onto one, and new ids continue
from the highest number ever used — never from the catalogue's length — so removing a
groove from rotation does not renumber anything.

When it succeeds, the working tree contains everything the new grooves need: the appended
`catalogue.json` entries, their mp3s, the regenerated manifest, and their lock entries.
There is no follow-up edit. Commit the lot. The command does not touch git itself.

The starting seed comes from the wall clock, which is the one deliberately
non-reproducible moment in the whole system: two people minting on the same day get
different grooves and both batches can be merged instead of colliding. Once the chosen
seed is written into `catalogue.json`, that groove renders identically forever.

## Regenerating

```bash
npm run grooves
```

Re-renders every entry in `catalogue.json` from scratch: all the mp3s, the manifest, and
the lock. On an unchanged tree with an unchanged generator, `git status` afterwards shows
nothing — the render is deterministic given the catalogue.

You need this after changing the generator, and after any hand edit to
`catalogue.json`. It is a normal operation, not a last resort: a groove is defined by its
`{ id, template, seed }` entry, and the audio and the answers are output. Changing the
generator and re-rendering is how the whole catalogue is meant to change. Expect the
committed mp3s to change bytes when you do — that is the point of the command, and the
diff is reviewed by listening.

## What is committed, and why

| Path | Role |
| :-- | :-- |
| `scripts/grooves/catalogue.json` | **The input.** One `{ id, template, seed }` per groove — that is the entire definition of a groove. |
| `public/grooves/groove-NN.mp3` | Output. The rendered audio the app serves. |
| `src/features/daily-groove/lib/grooves.generated.ts` | Output. The manifest the app imports directly: every groove's answers, plus the distractor pools built from them. Marked do-not-edit; a hand edit is lost on the next render *and* fails the build guard. |
| `scripts/grooves/grooves.lock.json` | Output. A sha256 and byte count per mp3, plus one hash for the manifest and one for the catalogue. |
| `scripts/grooves/samples/` | The CC0 sample pack (VCSL), a generation-time asset. Never served, never bundled. See its own README for licensing and voice mapping. |

Everything except `catalogue.json` and the sample pack is generated. The reason all of it
is committed rather than built is that rendering needs ffmpeg and 40-odd sample files, and
a deploy should need neither.

The one asymmetry worth remembering: **the manifest is output, never input.** If you want
different music, change the catalogue or the generator and re-render. Editing the manifest
changes what the app *says* without changing what it *plays*, which is the exact failure
this whole arrangement exists to make impossible.

## The build guard

```bash
npm run grooves:verify
```

This runs automatically as `prebuild`, so `npm run build` cannot ship a broken catalogue.
It reads `grooves.lock.json` and compares it against what is on disk. It renders nothing,
imports no audio code, and touches neither ffmpeg nor the sample pack — its whole
dependency list is `node:fs`, `node:crypto` and `node:path`, and there is a test that
reads the source and asserts exactly that. It runs on any CI machine with Node on it.

It reports three kinds of failure, each naming the file:

- **A broken mp3** — `missing`, `empty` (zero bytes), or `checksum` (the bytes changed).
  The zero-byte case is the one that matters historically: this project once shipped seven
  zero-byte placeholder mp3s and nothing noticed.
- **A stale manifest** — `manifest-stale`. `grooves.generated.ts` no longer hashes to what
  the last render produced. Somebody edited it by hand.
- **A stale catalogue** — `catalogue-stale`. `catalogue.json` changed and nobody
  re-rendered. This is the one the audio checksums cannot see: the manifest and the lock
  still agree with each other perfectly, while both disagree with the input that produced
  them.

A missing lock file is also a failure — the guard tells you to run `npm run grooves`.

## Ids never move

**A groove's `id` is permanent. Re-rendering may change what `groove-07` sounds like;
nothing may make `groove-07` a different entry in the catalogue.**

The reason is the player, not tidiness. A player's stored history refers to grooves by id,
so renumbering silently reassigns their history to other music. `grooves:add` guarantees
this mechanically: it only ever appends, and new ids continue from the highest number ever
used rather than from the catalogue's length, so retiring a groove renumbers nothing.

Re-rendering is the safe half of that: `groove-07` stays `groove-07`, and a player who
solved it has a record of a groove that still exists.

## Requirements

- **Rendering** (`npm run grooves`, `npm run grooves:add`) needs **ffmpeg** on the `PATH`.
  It is used at both ends of the pipeline: decoding the FLAC sample pack, and encoding the
  mp3.
- **Verifying** (`npm run grooves:verify`, and therefore `npm run build`) needs **nothing
  but Node**. No ffmpeg, no sample pack, no audio code. That is the point of it.
- The scripts are TypeScript and are run directly by Node (`node scripts/grooves/cli.ts`),
  with no build step of their own.

## Troubleshooting

**The build fails saying the catalogue is stale.** You changed `catalogue.json` — probably
by hand, possibly through a merge — and the committed audio and manifest are from before
that change. Run `npm run grooves` and commit what changes.

**The build fails saying the manifest is stale.** Someone edited `grooves.generated.ts`
directly. It is generated; the edit is not the fix. Put whatever you wanted into the
catalogue or the generator, run `npm run grooves`, and commit.

**The build names a groove as missing, empty or checksum-mismatched.** Its mp3 is not the
one that was minted. Restore it from git if the change was accidental (`git checkout --
public/grooves/groove-NN.mp3`). If it is genuinely gone, `npm run grooves` re-renders it —
it renders the whole catalogue, so commit every mp3 that changes, not just the named one.

**`grooves:add` fails naming an attempt limit.** The gate rejected every candidate it
tried. Nothing was written; the tree is exactly as it was. This usually means a template
or a threshold has been changed into something no seed can satisfy — look at the rejection
reasons it printed on the way.

**`ffmpeg could not be started`.** Install ffmpeg. Only rendering needs it; verification
does not, so this never blocks a build.

**Running the generator's tests.** They live beside the code they cover and run under the
`generator` vitest project, in a **node** environment rather than jsdom:

```bash
npx vitest run --project generator
```

`npm test` runs them along with the app's tests.
