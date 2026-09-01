import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    // A tier selected for an epic that owns no files in it must report zero
    // tests and exit zero, not fail for having been selected. Vitest's default
    // is to exit 1 on "No test files found"; the partition assertion in
    // scripts/tiers.test.ts is what keeps that from hiding a broken glob.
    passWithNoTests: true,
    projects: [
      {
        plugins: [react()],
        resolve: {
          alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
        },
        test: {
          name: 'app',
          environment: 'jsdom',
          globals: true,
          setupFiles: ['./vitest.setup.ts'],
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
        },
      },
      {
        test: {
          name: 'generator',
          environment: 'node',
          globals: true,
          include: ['scripts/grooves/**/*.{test,spec}.ts'],
          /**
           * Four workers, on a machine with twelve cores.
           *
           * These files decode the committed FLAC pack and mix several seconds
           * of audio, so they are CPU-bound rather than IO-bound and more
           * workers than this make every one of them slower. Three render cases
           * take ~3s each in isolation — 60% of vitest's 5s default — and lose
           * the rest to contention: unbounded and at 50% (six workers here) they
           * time out; at four they pass, and the whole tier finishes FASTER
           * (58s against 64s) because the thrashing goes away.
           *
           * It sits ALONGSIDE the `testTimeout` above, not instead of it. An
           * earlier version of this comment claimed it replaced that override;
           * it does not, and the override is back — the tiers were separated,
           * the app project stopped competing, and the generator still timed
           * out, because it saturates the cores by itself.
           *
           * The margin is thin. A slower machine, or a fourth slow render case,
           * lands back in timeouts — and the honest fix then is a cheaper
           * render, not a bigger number here.
           */
          /**
           * The generator tier gets a longer budget than vitest's 5s default,
           * and this is the note the original override never carried.
           *
           * Feature-14 set out to delete this line, believing it papered over
           * contention with the app project. **That premise was false.** With
           * the tiers fully separated and the app project not running at all,
           * the generator still times out. Measured on this tree:
           *
           * - **25 of its 811 cases exceed 2.5s** — half the default — and the
           *   worst are 13.3s, 12.3s and 9.2s. They decode the committed FLAC
           *   pack and mix seconds of audio; the cost is the work, not overhead.
           * - Worker count is not the lever. Unbounded, 6, 3 and 2 workers all
           *   time out, and 2 is *worse* than 4.
           * - Six full runs across a day: three red, always
           *   `Test timed out in 5000ms`, never an assertion.
           *
           * So a tier-level budget is the right shape — the tier is uniformly
           * expensive, and per-case timeouts turned into whack-a-mole across
           * four files. What the original lacked was this explanation, not the
           * number. The honest way to remove it is a cheaper render.
           */
          testTimeout: 30_000,
          maxWorkers: 4,
          /**
           * Its own group, which vitest requires: two projects that disagree
           * about `maxWorkers` may not share a `sequence.groupOrder`, and
           * `npm run test:all` fails to collect ANY test if they do — silently,
           * as "no tests" rather than as an error, which is how this was missed
           * until §9a's combined pass ran.
           *
           * The grouping is what we want anyway. The fast tiers finish first at
           * full width, then the generator gets the machine to itself at four
           * workers, instead of the two competing for cores — which was the
           * whole cause of the timeouts.
           */
          sequence: { groupOrder: 1 },
        },
      },
      {
        test: {
          // Repo tooling that lives at the root of scripts/. It is
          // milliseconds, so it joins the app project on the default gate
          // rather than the generator's slow tier — the module that decides
          // which tier to run must never be the reason the slow one runs.
          name: 'tooling',
          environment: 'node',
          globals: true,
          include: ['scripts/*.{test,spec}.ts'],
        },
      },
    ],
  },
})
