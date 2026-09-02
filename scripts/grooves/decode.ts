import { spawn } from 'node:child_process'
import { deinterleave } from './pcmio.ts'
import type { Pcm } from './types.ts'

export const DEFAULT_SAMPLE_RATE = 44100

export type Decoder = (path: string, sampleRate?: number) => Promise<Pcm>

export function decodeAudioFile(
  path: string,
  sampleRate: number = DEFAULT_SAMPLE_RATE,
): Promise<Pcm> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', path,
      '-f', 'f32le',
      '-acodec', 'pcm_f32le',
      '-ac', '2',
      '-ar', String(sampleRate),
      'pipe:1',
    ])

    const stdout: Buffer[] = []
    const stderr: Buffer[] = []

    ffmpeg.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    ffmpeg.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))

    ffmpeg.on('error', (error) => {
      reject(new Error(`ffmpeg could not be started to decode ${path}: ${error.message}`))
    })

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `ffmpeg exited ${code} while decoding ${path}: ${Buffer.concat(stderr).toString().trim()}`,
          ),
        )
        return
      }

      resolve(deinterleave(toFloat32(Buffer.concat(stdout)), sampleRate))
    })
  })
}

function toFloat32(bytes: Buffer): Float32Array {
  const frames = Math.floor(bytes.length / 4)
  const raw = new Float32Array(frames)

  for (let i = 0; i < frames; i += 1) {
    raw[i] = bytes.readFloatLE(i * 4)
  }

  return raw
}
