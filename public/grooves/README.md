# Groove audio

**Generated — do not edit or add files here by hand.**

Every `groove-NN.mp3` in this directory is rendered by `npm run grooves` from
`scripts/grooves/catalogue.json`, using the CC0 sample pack committed at
`scripts/grooves/samples/`. The same run writes the answers that go with the audio
to `src/features/daily-groove/lib/grooves.generated.ts`, so a groove's stated scale,
chord and progression are always the ones actually played — they come out of the
same render, rather than being transcribed by hand.

To add grooves, run `npm run grooves:add <n>` and commit what it writes. Full
documentation — the pipeline, what is committed, and the freeze rule that keeps an
existing groove's audio and answers stable once it has shipped — is in
[`scripts/grooves/README.md`](../../scripts/grooves/README.md). The sample pack and its
licensing are covered in [`scripts/grooves/samples/README.md`](../../scripts/grooves/samples/README.md).

These files are guarded. `npm run grooves:verify` runs as `prebuild` and compares every
mp3 here against the checksum recorded in `scripts/grooves/grooves.lock.json` when it was
rendered; a missing, zero-byte or altered file fails the build and names the groove.
`src/features/daily-groove/lib/grooves.generated.test.ts` separately asserts that every
groove the manifest names has a real, non-empty file behind it.

> These files were zero-byte placeholders until feature-3, and nothing caught it. That is
> what the checksum guard exists to prevent.
