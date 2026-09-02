export type OutputClaim = {
  isHeld(): boolean
  release(): void
}

export type ReferenceOutput = {
  claim(cancel: () => void): OutputClaim
  isClaimed(): boolean
}

type Entry = {
  cancel: () => void
  live: boolean
}

let holder: Entry | null = null

function claim(cancel: () => void): OutputClaim {
  const previous = holder
  const entry: Entry = { cancel, live: true }

  holder = entry

  if (previous?.live) {
    previous.live = false
    try {
      previous.cancel()
    } catch {
      // A voice that cannot silence itself must not stop the arriving one.
    }
  }

  return {
    isHeld: () => entry.live && holder === entry,
    release: () => {
      if (!entry.live) return
      entry.live = false
      if (holder === entry) holder = null
    },
  }
}

const output: ReferenceOutput = Object.freeze({
  claim,
  isClaimed: () => holder !== null,
})

export function referenceOutput(): ReferenceOutput {
  return output
}

export function resetReferenceOutput(): void {
  if (holder) holder.live = false
  holder = null
}
