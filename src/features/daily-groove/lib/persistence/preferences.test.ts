import { describe, it, expect, afterEach, vi } from 'vitest'
import { createLocalPreferenceStore } from './preferences'

const PREFS_KEY = 'daily-groove:v1:prefs'
const RESULTS_KEY = 'daily-groove:v2:results'

describe('createLocalPreferenceStore', () => {
  it('round-trips a saved preference (E5 R7, AC7)', async () => {
    const store = createLocalPreferenceStore()
    await store.update({ simpleMode: true })
    expect(await store.get()).toEqual({ simpleMode: true, tapSounds: true })
  })

  it('round-trips the preference switched back off (E5 R7)', async () => {
    const store = createLocalPreferenceStore()
    await store.update({ simpleMode: true })
    await store.update({ simpleMode: false })
    expect(await store.get()).toEqual({ simpleMode: false, tapSounds: true })
  })

  it('merges a patch, leaving the field it does not name where it was (F16 E2 R7, R3)', async () => {
    const store = createLocalPreferenceStore()

    await store.update({ simpleMode: true })
    expect(await store.get()).toEqual({ simpleMode: true, tapSounds: true })

    await store.update({ tapSounds: false })
    expect(await store.get()).toEqual({ simpleMode: true, tapSounds: false })

    await store.update({ simpleMode: false })
    expect(await store.get()).toEqual({ simpleMode: false, tapSounds: false })
  })

  it('persists across a fresh store, simulating a reload (E5 R7, AC7)', async () => {
    await createLocalPreferenceStore().update({ simpleMode: true })

    const reloaded = createLocalPreferenceStore()
    expect(await reloaded.get()).toEqual({ simpleMode: true, tapSounds: true })
  })

  it('holds no simpleMode when nothing was ever stored (F22 E1 R1, R4)', async () => {
    const store = createLocalPreferenceStore()
    await expect(store.get()).resolves.toStrictEqual({ tapSounds: true })
    const prefs = await store.get()
    expect('simpleMode' in prefs).toBe(false)
  })

  it('writes the first-visit decision as a patch, beside the default tapSounds (F22 E1 R2, R5)', async () => {
    await createLocalPreferenceStore().update({ simpleMode: true })
    expect(JSON.parse(localStorage.getItem(PREFS_KEY) as string)).toStrictEqual({
      tapSounds: true,
      simpleMode: true,
    })
  })

  it('a patch onto an empty store invents no simpleMode (F22 E1 R2, R5)', async () => {
    await createLocalPreferenceStore().update({ tapSounds: false })
    expect(JSON.parse(localStorage.getItem(PREFS_KEY) as string)).toStrictEqual({
      tapSounds: false,
    })
  })

  it('loads a blob written before tapSounds existed with simple mode intact (F16 E2 R7, AC7)', async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ simpleMode: true }))

    expect(await createLocalPreferenceStore().get()).toEqual({
      simpleMode: true,
      tapSounds: true,
    })
  })

  it('writing the new field onto a legacy blob keeps the field it never wrote (F16 E2 R7, AC7)', async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ simpleMode: true }))

    const store = createLocalPreferenceStore()
    await store.update({ tapSounds: false })

    expect(await store.get()).toEqual({ simpleMode: true, tapSounds: false })
  })

  it('holds no simpleMode when the stored value is corrupt JSON (F22 E1 R4, R8)', async () => {
    localStorage.setItem(PREFS_KEY, 'not-json{')
    const store = createLocalPreferenceStore()
    await expect(store.get()).resolves.toStrictEqual({ tapSounds: true })
  })

  it('holds no simpleMode when the stored blob is the wrong shape (F22 E1 R4, R8)', async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ nope: true }))
    await expect(createLocalPreferenceStore().get()).resolves.toStrictEqual({ tapSounds: true })

    localStorage.setItem(PREFS_KEY, JSON.stringify({ simpleMode: 'yes' }))
    await expect(createLocalPreferenceStore().get()).resolves.toStrictEqual({ tapSounds: true })

    localStorage.setItem(PREFS_KEY, JSON.stringify(['simpleMode']))
    await expect(createLocalPreferenceStore().get()).resolves.toStrictEqual({ tapSounds: true })

    localStorage.setItem(PREFS_KEY, JSON.stringify(null))
    await expect(createLocalPreferenceStore().get()).resolves.toStrictEqual({ tapSounds: true })
  })

  it('one corrupt field does not cost the good one beside it (F16 E2 R7, F22 E1 R4)', async () => {
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ simpleMode: true, tapSounds: 'no' }),
    )
    await expect(createLocalPreferenceStore().get()).resolves.toEqual({
      simpleMode: true,
      tapSounds: true,
    })

    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ simpleMode: 'yes', tapSounds: false }),
    )
    await expect(createLocalPreferenceStore().get()).resolves.toStrictEqual({ tapSounds: false })
  })

  it('writes under its own key, leaving the results envelope alone (E5 A2)', async () => {
    const resultsBlob = JSON.stringify({ version: 2, byDate: {} })
    localStorage.setItem(RESULTS_KEY, resultsBlob)

    await createLocalPreferenceStore().update({ simpleMode: true })

    expect(JSON.parse(localStorage.getItem(PREFS_KEY) as string)).toEqual({
      simpleMode: true,
      tapSounds: true,
    })
    expect(localStorage.getItem(RESULTS_KEY)).toBe(resultsBlob)
  })

  it('round-trips the instrument key beside the others (F23 E1 R2, AC2)', async () => {
    const store = createLocalPreferenceStore()
    await store.update({ instrumentKey: 'E♭' })
    await expect(store.get()).resolves.toEqual({ tapSounds: true, instrumentKey: 'E♭' })
    await expect(createLocalPreferenceStore().get()).resolves.toEqual({
      tapSounds: true,
      instrumentKey: 'E♭',
    })
  })

  it('holds no instrument key when nothing was stored (F23 E1 R2, AC3)', async () => {
    const prefs = await createLocalPreferenceStore().get()
    expect('instrumentKey' in prefs).toBe(false)
  })

  it.each(['G', 'Eb', 'concert', 3, null, true])(
    'drops a stored instrument key of %j (F23 E1 R2, R3)',
    async (raw) => {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ tapSounds: true, instrumentKey: raw }))
      await expect(createLocalPreferenceStore().get()).resolves.toStrictEqual({
        tapSounds: true,
      })
    },
  )

  it('patches the instrument key without moving simpleMode or tapSounds (F23 E1 R10, AC12)', async () => {
    const store = createLocalPreferenceStore()
    await store.update({ simpleMode: true, tapSounds: false })
    await store.update({ instrumentKey: 'B♭' })
    await expect(store.get()).resolves.toEqual({
      simpleMode: true,
      tapSounds: false,
      instrumentKey: 'B♭',
    })
  })

  describe('a hostile storage never throws into the UI (E5 R7, F16 E2 R8)', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('falls back to the default when getItem throws', async () => {
      vi.spyOn(globalThis.localStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      await expect(createLocalPreferenceStore().get()).resolves.toStrictEqual({
        tapSounds: true,
      })
    })

    it('resolves rather than rejecting when setItem throws', async () => {
      vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
      await expect(
        createLocalPreferenceStore().update({ tapSounds: false }),
      ).resolves.toBeUndefined()
    })

    it('resolves rather than rejecting when the merge read throws', async () => {
      vi.spyOn(globalThis.localStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError')
      })
      await expect(
        createLocalPreferenceStore().update({ tapSounds: false }),
      ).resolves.toBeUndefined()
    })
  })
})
