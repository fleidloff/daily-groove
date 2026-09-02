import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { probeHeadDelaySeconds } from './probe.ts'

const GROOVE_01 = join(process.cwd(), 'public', 'grooves', 'groove-01.mp3')

describe('probeHeadDelaySeconds', () => {
  it("reports the committed mp3's encoder delay in seconds", async () => {
    await expect(probeHeadDelaySeconds(GROOVE_01)).resolves.toBeCloseTo(0.025057, 6)
  }, 30_000)

  it('rejects with a message naming the file when there is nothing to probe', async () => {
    const missing = join(process.cwd(), 'public', 'grooves', 'no-such-groove.mp3')
    await expect(probeHeadDelaySeconds(missing)).rejects.toThrow(/no-such-groove\.mp3/)
  }, 30_000)
})
