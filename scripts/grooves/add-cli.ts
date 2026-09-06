import { resolve } from 'node:path'
import { addGrooves, type AddOptions } from './add.ts'

const USAGE =
  'usage: npm run grooves:add <n> [-- --template <id>]   — mint n new grooves (n a positive integer)'

const TEMPLATE_FLAG = '--template'
const TEMPLATE_EQ = `${TEMPLATE_FLAG}=`

export type AddArgs = { n: number; templateId?: string }

export function parseArgs(argv: readonly string[]): AddArgs {
  let count: string | undefined
  let templateId: string | undefined

  const valueFor = (flag: string, i: number): string => {
    const value = argv[i + 1]
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} needs a value`)
    return value
  }

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]

    if (token.startsWith(TEMPLATE_EQ)) {
      templateId = token.slice(TEMPLATE_EQ.length)
      if (templateId === '') throw new Error(`${TEMPLATE_FLAG} needs a value`)
      continue
    }

    if (token === TEMPLATE_FLAG) {
      templateId = valueFor(token, i)
      i++
      continue
    }

    if (token.startsWith('-') || count !== undefined) {
      throw new Error(`unknown argument: ${token}`)
    }
    count = token
  }

  if (count === undefined) throw new Error(`how many grooves? ${USAGE}`)

  const n = Number(count)
  if (!Number.isInteger(n) || n < 1) {
    throw new Error(`"${count}" is not a positive integer. ${USAGE}`)
  }

  return templateId === undefined ? { n } : { n, templateId }
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export async function main(
  argv: readonly string[] = [],
  options: AddOptions = {},
): Promise<number> {
  const out = options.log ?? ((line: string) => console.log(line))
  const fail = options.log ?? ((line: string) => console.error(line))

  let args: AddArgs
  try {
    args = parseArgs(argv)
  } catch (error) {
    fail(`grooves:add — ${reason(error)}`)
    return 1
  }

  try {
    const minted = await addGrooves(args.n, {
      ...options,
      ...(args.templateId === undefined ? {} : { templateId: args.templateId }),
      log: out,
    })
    out(`grooves:add — minted ${minted.length} groove(s):`)
    for (const spec of minted) {
      out(`  ${spec.id}  ${spec.template.padEnd(16)} seed ${spec.seed}`)
    }
    out('  review them, then commit the audio, catalogue, manifest and lock together.')
    return 0
  } catch (error) {
    fail(`grooves:add — ${reason(error)}`)
    fail('  nothing was written; the catalogue is unchanged.')
    return 1
  }
}

const entry = process.argv[1]
if (entry !== undefined && resolve(entry) === resolve(import.meta.filename)) {
  process.exitCode = await main(process.argv.slice(2))
}
