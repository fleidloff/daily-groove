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
    // A tier an epic owns no files in must exit zero, not 1. The partition
    // assertion in scripts/tiers.test.ts keeps that from hiding a broken glob.
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
          // Measured: these cases decode the FLAC pack and mix seconds of
          // audio, so 25 of them exceed 2.5s and the worst take ~13s. More
          // workers make each one slower. The honest way to shrink these two
          // numbers is a cheaper render.
          testTimeout: 30_000,
          maxWorkers: 4,
          // Required: two projects that disagree about `maxWorkers` may not
          // share a groupOrder, and `npm run test:all` then silently collects
          // no tests at all rather than erroring.
          sequence: { groupOrder: 1 },
        },
      },
      {
        test: {
          name: 'tooling',
          environment: 'node',
          globals: true,
          include: ['scripts/*.{test,spec}.ts'],
        },
      },
    ],
  },
})
