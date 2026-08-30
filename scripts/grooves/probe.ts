/**
 * The probe stage: what an mp3 says about itself.
 *
 * An mp3 does not begin with its music. The encoder puts a short priming
 * signal at the head of the stream, and every decoder that honours the
 * LAME/Xing header reports it as the audio stream's `start_time`. That offset
 * is a property of the file and of the encoder that wrote it, never a constant
 * to be shared across a catalogue — so it is measured once, per file, at mint
 * time, and carried in the manifest.
 *
 * `ffprobe` ships with `ffmpeg`, which the generator already requires, so this
 * adds no new tool. The spawn-and-reject shape is `encode.ts`'s and
 * `decode.ts`'s.
 */

import { spawn } from 'node:child_process'

/** The audio stream's `start_time`, via ffprobe. The encoder's head delay. */
export function probeHeadDelaySeconds(mp3Path: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=start_time',
      '-of', 'csv=p=0',
      mp3Path,
    ])

    const stdout: Buffer[] = []
    const stderr: Buffer[] = []

    ffprobe.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    ffprobe.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))

    ffprobe.on('error', (error) => {
      reject(new Error(`ffprobe could not be started to probe ${mp3Path}: ${error.message}`))
    })

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `ffprobe exited ${code} while probing ${mp3Path}: ${Buffer.concat(stderr).toString().trim()}`,
          ),
        )
        return
      }

      // `N/A` for a stream with no start time, and an empty string for a file
      // with no audio stream at all. Neither is a delay, and guessing zero for
      // either would put a silently wrong number in the manifest.
      const raw = Buffer.concat(stdout).toString().trim()
      const seconds = Number(raw)
      if (raw === '' || !Number.isFinite(seconds)) {
        reject(new Error(`ffprobe reported no audio start time for ${mp3Path}: "${raw}"`))
        return
      }

      resolve(seconds)
    })
  })
}
