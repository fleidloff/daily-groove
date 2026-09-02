// FROZEN. Seeds the generator's RNG and picks the groove of the day, so a
// change re-renders every groove and reassigns every past date.
// See docs/coding-guidelines.md; hash.test.ts pins it.
export function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}
