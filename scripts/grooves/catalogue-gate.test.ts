import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { buildEvents } from './events.ts'
import { readCatalogue } from './catalogue.ts'
import { gateCandidate } from './gate.ts'
import { mixTracks } from './mix.ts'
import { loadPack } from './pack.ts'
import { templateById } from './templates/index.ts'
import { renderVoices } from './voices.ts'
import type { Pcm } from './types.ts'

/**
 * The gate, run over the whole committed catalogue.
 *
 * `gate.test.ts` proves the gate rejects what it should, on one groove. This
 * proves the shipped catalogue passes it — which is a different claim, and the
 * one nothing was making.
 *
 * It is worth its cost because `npm run grooves` does **not** gate: only
 * `grooves:add` does. A change to the generator can therefore render, lock and
 * ship 44 grooves that the gate would have refused, and nothing says so. That
 * happened once during feature-9: two grooves went over the seam threshold and
 * were found by sweeping this by hand, three epics after the sweep should have
 * been a test.
 */

const SAMPLE_RATE = 44100
const OVERHANG_BARS = 1

const pack = await loadPack(fileURLToPath(new URL('./samples', import.meta.url)))

function render(spec: ReturnType<typeof readCatalogue>[number]) {
  const template = templateById(spec.template)
  const { events, music, harmony } = buildEvents(spec, template)
  const tracks = renderVoices(events, pack, SAMPLE_RATE, {
    id: spec.id,
    bars: music.loopBars,
    bpm: music.bpm,
    passes: music.loopBars / music.bars,
    overhangBars: OVERHANG_BARS,
  })
  const pcm = mixTracks(tracks, template, { loopBars: music.loopBars, bpm: music.bpm })
  return { pcm, events, music, harmony, template }
}

describe('the committed catalogue, through the gate', () => {
  const specs = readCatalogue()

  it('has grooves to check', () => {
    expect(specs.length).toBeGreaterThan(0)
  })

  it.each(specs)('accepts $id ($template)', (spec) => {
    const failure = gateCandidate(render(spec))
    expect(failure, failure ? `${failure.check}: ${failure.detail}` : '').toBeNull()
  })
})

describe('the render is deterministic', () => {
  /**
   * Two renders of one spec, compared sample for sample.
   *
   * The claim `npm run grooves` rests on — run it twice and `git status` is
   * clean — measured where it is cheap to measure. Encoding is left out: ffmpeg
   * is deterministic given identical PCM, and the property at risk is upstream
   * of it, in anything that might read a clock or an unseeded generator.
   */
  it('renders the same spec to the same samples twice', () => {
    const spec = readCatalogue()[0]
    const a = render(spec).pcm
    const b = render(spec).pcm

    expect(a.left.length).toBe(b.left.length)
    expect(firstDifference(a, b), 'the two renders diverge').toBe(-1)
  })
})

/** The first frame at which two buffers differ, or -1. */
function firstDifference(a: Pcm, b: Pcm): number {
  for (let i = 0; i < a.left.length; i += 1) {
    if (a.left[i] !== b.left[i] || a.right[i] !== b.right[i]) return i
  }
  return -1
}
