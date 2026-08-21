export type AudioPlayer = {
  play(): Promise<void>
  stop(): void
  dispose(): void
}

/**
 * Wraps an HTML5 `Audio` element. Nothing outside this module touches the
 * element directly.
 */
export function createAudioPlayer(src: string): AudioPlayer {
  const element = new Audio(src)

  return {
    play() {
      // Always restart from the beginning so replay works.
      element.currentTime = 0
      // Return the element's play promise so load/play failures propagate to
      // the caller and the UI can surface a retry.
      return Promise.resolve(element.play())
    },
    stop() {
      element.pause()
    },
    dispose() {
      element.pause()
      // Release the media resource.
      element.src = ''
    },
  }
}
