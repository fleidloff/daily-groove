import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readCatalogue } from './catalogue.ts'

const MANIFEST = '../../src/features/daily-groove/data/grooves.generated.ts'

// FROZEN. docs/music.md § What must never change names a groove's uuid: a share
// link resolves it, so moving one silently breaks a link somebody sent. These
// pairs are the freeze, and editing a line here is the only way to move a uuid
// without a red test — which is the point. catalogue.json and the manifest move
// together on one render, so pinning them against each other proves nothing.
//
// Adding a groove: run the tests, paste the block the failure prints. Never
// regenerate this table wholesale — an append can only add ids that are absent,
// so a changed uuid always shows up as a - / + on a line that says FROZEN above it.
//
// The same table under the same name lives on the app side, in the
// data/uuidFreeze.test.ts beside the manifest, which this file may not name or
// import — `grep -rn FROZEN_UUIDS` finds both halves. Both are pinned against
// the manifest's bindings, so neither can drift from the other.
const FROZEN_UUIDS: ReadonlyArray<readonly [id: string, uuid: string]> = [
  ['groove-01', 'f12e18e4-c781-4195-ace6-5908cb0a2915'],
  ['groove-02', '323eedd7-0c46-4394-abed-21e601dd0f94'],
  ['groove-03', '427ca78f-675e-4fc7-a30c-dc89bf0de679'],
  ['groove-04', 'd65589bc-3bbc-48ee-8c2d-9a576c04b3eb'],
  ['groove-07', '4f574115-57c4-40c7-be39-57bfd9243c46'],
  ['groove-08', '2a06094b-3459-46b5-a37c-8c4c205b9a7d'],
  ['groove-09', 'c0d364d4-1436-4083-8c50-ed41b4207005'],
  ['groove-10', '75be2390-4050-491f-8f87-1690bfe6d4f5'],
  ['groove-11', 'a1ed8a53-0c00-4632-a87f-b22e4bf1ac0d'],
  ['groove-12', '575634b3-7ff8-4ce5-90a3-c12bff6273b8'],
  ['groove-13', 'da953189-43ff-47a5-aa34-30152adffb49'],
  ['groove-14', '367a0649-d43a-4746-8bc1-fe37c96a271a'],
  ['groove-17', '2d960964-37a4-4f9c-b638-630a76233ad0'],
  ['groove-18', 'b57d8551-7ee6-4095-a1fa-abfa4b3178a4'],
  ['groove-19', '201a5bd6-fd90-4dbc-b7aa-4ec774f3b2dc'],
  ['groove-20', '470a40ea-a004-4ae3-94b1-051d81ab462f'],
  ['groove-21', 'baf90061-1f6b-4457-82ce-6ff39e316b91'],
  ['groove-22', 'c804b1df-5f1b-4cd2-936a-8225c40547e7'],
  ['groove-28', '6751d1de-962b-43ac-b2e1-94aea044162e'],
  ['groove-34', 'd60a7a22-f991-436a-8b13-74fac0585f21'],
  ['groove-38', 'f29bf1d8-5799-467e-8616-7268a7d43db6'],
  ['groove-40', '12fa50e9-318e-4180-bd04-8b63d90b7485'],
  ['groove-42', '45d84df7-18a2-40f7-80a5-24726266255b'],
  ['groove-44', 'f4828027-ea17-46d3-b6c4-2d8b315e6a3c'],
  ['groove-46', '88b0070c-8909-431c-ba32-865ab5eed64d'],
  ['groove-48', 'c4b79639-8d00-4d98-a958-eb7b10e55b5a'],
  ['groove-49', '40582d50-d06b-48cb-9c19-f016b8e1dc89'],
  ['groove-50', '4aeaeb8c-dde5-487e-a063-ed1367013272'],
  ['groove-51', 'bae35df1-eaa8-48ef-b02c-814fbfe2340f'],
  ['groove-52', '663a6eda-b223-4a70-9842-647cc36255ab'],
  ['groove-53', '5ce24a2f-d6bb-4f66-bbac-1700e00de2d6'],
  ['groove-54', 'b9d62620-775e-4a99-b776-c4db5ec44c7c'],
  ['groove-55', 'f7b5667f-3458-4681-bcc2-20ee933f48c8'],
  ['groove-56', '0e632f6a-6ee8-4007-aa21-211a1f1b389f'],
  ['groove-57', '10bb886f-71d6-4cea-8b1d-66dbaeb28169'],
  ['groove-58', 'b596c20a-6b80-4a23-8974-ebf48d1f8679'],
  ['groove-65', 'ecea73f6-b8a0-4863-8fa6-cab2ffb54814'],
  ['groove-66', '69f64f22-bc34-45b1-8937-eac99dcb4164'],
  ['groove-67', '00c6a264-d6fd-4ec3-a38e-a137a44d5ec9'],
  ['groove-68', 'e7ac5bbf-d545-4f35-a511-3a0e09c7eb32'],
  ['groove-69', 'd0149515-7ba4-42f8-a760-8f9a7b83b38c'],
  ['groove-70', '5fc9b9c6-9a3c-4f6f-9fdb-06809b3cc51c'],
  ['groove-71', 'f3ee8631-e9e7-4379-aef3-7ce0ae4c0b81'],
  ['groove-72', 'cc666694-9d7c-4b3c-856f-b8361aecf0ae'],
  ['groove-73', 'b648ad0c-a2fa-457e-9cbd-0504a72cb1bb'],
  ['groove-74', 'b79625d9-501e-4477-b42f-81e5506d0b28'],
  ['groove-75', 'cd1d5f2e-8788-44b7-bd47-883cda16ad22'],
  ['groove-76', '2e0d7708-a0d6-4dbc-9277-9a79fd261df9'],
]

function pasteable(missing: readonly (readonly [string, string])[]): string {
  return missing.map(([id, uuid]) => `  ['${id}', '${uuid}'],`).join('\n')
}

function manifestUuids(): Map<string, string> {
  const source = readFileSync(join(import.meta.dirname, MANIFEST), 'utf8')
  const out = new Map<string, string>()
  for (const block of source.match(/\{[^{}]+\}/g) ?? []) {
    const id = /\bid:\s*'([^']+)'/.exec(block)?.[1]
    const uuid = /\buuid:\s*'([^']+)'/.exec(block)?.[1]
    if (id !== undefined && uuid !== undefined) out.set(id, uuid)
  }
  return out
}

describe('the uuids a share link resolves are frozen', () => {
  it('holds each id once and each uuid once', () => {
    const ids = FROZEN_UUIDS.map(([id]) => id)
    const uuids = FROZEN_UUIDS.map(([, uuid]) => uuid)
    expect(new Set(ids).size, 'an id is frozen twice').toBe(ids.length)
    expect(new Set(uuids).size, 'a uuid is frozen twice').toBe(uuids.length)
  })

  it('pins a uuid for every groove the catalogue holds', () => {
    const frozen = new Set(FROZEN_UUIDS.map(([id]) => id))
    const unpinned = readCatalogue()
      .filter((spec) => !frozen.has(spec.id))
      .map((spec) => [spec.id, spec.uuid] as const)
    expect(
      unpinned.map(([id]) => id),
      unpinned.length === 0
        ? ''
        : 'newly minted grooves are not frozen yet — paste these lines into ' +
          `FROZEN_UUIDS in this file and in the app-side half:\n${pasteable(unpinned)}`,
    ).toEqual([])
  })

  it('pins a uuid for every groove the manifest ships', () => {
    const frozen = new Set(FROZEN_UUIDS.map(([id]) => id))
    const unpinned = [...manifestUuids()].filter(([id]) => !frozen.has(id))
    expect(
      unpinned.map(([id]) => id),
      unpinned.length === 0
        ? ''
        : 'the manifest ships grooves this file does not freeze — paste these ' +
          `lines into FROZEN_UUIDS in this file and in the app-side half:\n${pasteable(unpinned)}`,
    ).toEqual([])
  })

  it.each(FROZEN_UUIDS)('keeps %s minted as %s in catalogue.json', (id, uuid) => {
    const spec = readCatalogue().find((entry) => entry.id === id)
    expect(spec, `${id} has left catalogue.json — a frozen share link now resolves nothing`)
      .toBeDefined()
    expect(spec!.uuid, `${id}'s uuid moved in catalogue.json`).toBe(uuid)
  })

  it.each(FROZEN_UUIDS)('renders %s as %s in the manifest', (id, uuid) => {
    const shipped = manifestUuids()
    expect(shipped.has(id), `${id} has left the manifest`).toBe(true)
    expect(shipped.get(id), `${id}'s uuid moved in the manifest`).toBe(uuid)
  })
})
