import { spawn } from 'node:child_process'
import { interleave } from './pcmio.ts'
import type { Pcm } from './types.ts'

export const MP3_BITRATE = '192k'

export function encodeMp3(pcm: Pcm, outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', [
      '-hide_banner',
      '-loglevel', 'error',
      '-y',
      '-f', 'f32le',
      '-ar', String(pcm.sampleRate),
      '-ac', '2',
      '-i', 'pipe:0',
      '-codec:a', 'libmp3lame',
      '-b:a', MP3_BITRATE,
      outPath,
    ])

    const stderr: Buffer[] = []
    ffmpeg.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))

    ffmpeg.on('error', (error) => {
      reject(new Error(`ffmpeg could not be started to encode ${outPath}: ${error.message}`))
    })

    ffmpeg.stdin.on('error', () => {})

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `ffmpeg exited ${code} while encoding ${outPath}: ${Buffer.concat(stderr).toString().trim()}`,
          ),
        )
        return
      }
      resolve()
    })

    const raw = interleave(pcm)
    ffmpeg.stdin.end(Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength))
  })
}
