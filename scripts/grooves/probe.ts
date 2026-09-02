import { spawn } from 'node:child_process'

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
