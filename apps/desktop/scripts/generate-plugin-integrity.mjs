import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

function usage() {
  console.error('Usage: node scripts/generate-plugin-integrity.mjs <pluginDir> [--source local|marketplace] [--repository <https-url>] [--commit <sha>]')
}

function toPosixPath(value) {
  return value.replace(/\\/g, '/')
}

function sha256Buffer(buffer) {
  return createHash('sha256').update(buffer).digest('hex')
}

function sortKeysDeep(value) {
  if (Array.isArray(value)) return value.map((item) => sortKeysDeep(item))
  if (value && typeof value === 'object') {
    const input = value
    const out = {}
    for (const key of Object.keys(input).sort((a, b) => a.localeCompare(b))) {
      const next = input[key]
      if (next !== undefined) out[key] = sortKeysDeep(next)
    }
    return out
  }
  return value
}

function collectFiles(root, relative = '') {
  const directory = relative ? join(root, relative) : root
  const entries = readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))

  const files = []
  for (const entry of entries) {
    const rel = relative ? join(relative, entry.name) : entry.name
    if (entry.isSymbolicLink()) {
      throw new Error(`Symlink is not allowed in plugin payload: ${toPosixPath(rel)}`)
    }
    if (entry.isDirectory()) {
      files.push(...collectFiles(root, rel))
      continue
    }
    if (entry.isFile()) files.push(rel)
  }

  return files
}

function computeDirectoryDigest(root, excludedFiles) {
  const hash = createHash('sha256')
  const files = collectFiles(root)

  for (const rel of files) {
    const posixRel = toPosixPath(rel)
    if (excludedFiles.has(posixRel)) continue

    const content = readFileSync(join(root, rel))
    hash.update(posixRel)
    hash.update('\0')
    hash.update(content)
    hash.update('\0')
  }

  return hash.digest('hex')
}

function computeManifestDigest(manifest) {
  const clone = JSON.parse(JSON.stringify(manifest))
  if (clone.integrity) {
    delete clone.integrity.manifestDigest
    delete clone.integrity.filesDigest
    if (Object.keys(clone.integrity).length === 0) delete clone.integrity
  }
  const stableJson = JSON.stringify(sortKeysDeep(clone))
  return sha256Buffer(Buffer.from(stableJson, 'utf8'))
}

function parseArgs(argv) {
  const args = [...argv]
  const pluginDir = args.shift()
  if (!pluginDir) return null

  const options = {
    source: undefined,
    repository: undefined,
    commit: undefined,
  }

  for (let i = 0; i < args.length; i += 1) {
    const key = args[i]
    const value = args[i + 1]
    if (!value) throw new Error(`Missing value for ${key}`)

    if (key === '--source') options.source = value
    else if (key === '--repository') options.repository = value
    else if (key === '--commit') options.commit = value
    else throw new Error(`Unknown option: ${key}`)

    i += 1
  }

  return { pluginDir, ...options }
}

function gitOutput(cwd, args) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  })
  if (result.status !== 0) return ''
  return (result.stdout || '').trim()
}

function inferGitProvenance(pluginDir) {
  const commit = gitOutput(pluginDir, ['rev-parse', 'HEAD'])
  const repository = gitOutput(pluginDir, ['remote', 'get-url', 'origin'])
  return {
    commit: commit || undefined,
    repository: repository || undefined,
  }
}

try {
  const parsed = parseArgs(process.argv.slice(2))
  if (!parsed) {
    usage()
    process.exit(1)
  }

  const pluginDir = resolve(parsed.pluginDir)
  const manifestPath = join(pluginDir, 'manifest.json')

  const manifestStat = statSync(manifestPath)
  if (!manifestStat.isFile()) {
    throw new Error(`manifest.json is not a file: ${manifestPath}`)
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (!manifest.id || !manifest.name || !manifest.version) {
    throw new Error('Invalid manifest: id/name/version are required')
  }

  const source = parsed.source === 'marketplace' ? 'marketplace' : 'local'
  const gitProvenance = inferGitProvenance(pluginDir)

  manifest.integrity = {
    algorithm: 'sha256',
  }
  manifest.provenance = {
    source,
    repository: parsed.repository || gitProvenance.repository,
    commit: parsed.commit || gitProvenance.commit,
    signature: manifest.provenance?.signature,
  }

  manifest.integrity.filesDigest = computeDirectoryDigest(pluginDir, new Set(['manifest.json']))
  manifest.integrity.manifestDigest = computeManifestDigest(manifest)

  const normalized = `${JSON.stringify(sortKeysDeep(manifest), null, 2)}\n`
  writeFileSync(manifestPath, normalized, 'utf8')

  console.log(`Updated plugin manifest integrity: ${manifestPath}`)
  console.log(`- filesDigest: ${manifest.integrity.filesDigest}`)
  console.log(`- manifestDigest: ${manifest.integrity.manifestDigest}`)
  console.log(`- source: ${manifest.provenance?.source}`)
  if (manifest.provenance?.repository) console.log(`- repository: ${manifest.provenance.repository}`)
  if (manifest.provenance?.commit) console.log(`- commit: ${manifest.provenance.commit}`)
} catch (error) {
  console.error((error && error.message) ? error.message : String(error))
  process.exit(1)
}
