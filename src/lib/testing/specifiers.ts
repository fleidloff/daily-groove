const SPECIFIER_FORMS = [
  /\bfrom\s*(['"])([^'"]+)\1/g,
  /\bimport\s*(['"])([^'"]+)\1/g,
  /\bimport\s*\(\s*(['"])([^'"]+)\1/g,
  /\brequire\s*\(\s*(['"])([^'"]+)\1/g,
  /\bvi\s*\.\s*(?:mock|doMock)\s*\(\s*(['"])([^'"]+)\1/g,
]

function liveCode(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart()
      return !trimmed.startsWith('//') && !trimmed.startsWith('*')
    })
    .join('\n')
}

export function moduleSpecifiers(source: string): string[] {
  const hits = new Set<string>()
  for (const form of SPECIFIER_FORMS) {
    for (const match of liveCode(source).matchAll(form)) hits.add(match[2])
  }
  return [...hits].sort()
}
