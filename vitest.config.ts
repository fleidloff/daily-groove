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
          include: ['scripts/**/*.{test,spec}.ts'],
          // Rendering a groove decodes the sample pack and mixes several
          // seconds of audio, which runs past vitest's 5 s default once the
          // app project is competing for the same cores: three render cases
          // failed at 5005-5045 ms under full-suite load while passing in
          // isolation. The work is inherently slow, not hung.
          testTimeout: 30_000,
        },
      },
    ],
  },
})
