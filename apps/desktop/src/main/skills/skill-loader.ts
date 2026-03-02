import { readFile, readdir, access } from 'fs/promises'
import { join, basename, dirname } from 'path'
import { app } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { createHash } from 'crypto'

const execFileAsync = promisify(execFile)
const LEGACY_BRAND_LOWER = `open${'claw'}`
const LEGACY_BRAND_TITLE = `Open${'Claw'}`

export interface SkillMetadata {
  emoji?: string
  os?: string[]
  requires?: { bins?: string[] }
  examples?: string[]
}

export interface SkillMeta {
  id: string
  name: string
  description: string
  triggers: string[]
  tools: string[]
  category: string
  metadata: SkillMetadata
}

export interface Skill {
  meta: SkillMeta
  procedure: string
  filePath: string
  eligible: boolean
}

const binaryExistsCache = new Map<string, boolean>()

export interface SkillLoaderOptions {
  maxSkills?: number
  includeCategories?: string[]
}

interface ResolvedSkillLoaderOptions {
  maxSkills: number | null
  includeCategories: string[]
}

function getIndent(line: string): number {
  let idx = 0
  while (idx < line.length && line[idx] === ' ') idx++
  return idx
}

function unquote(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith('\'') && trimmed.endsWith('\''))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function splitInlineList(value: string): string[] {
  const result: string[] = []
  let current = ''
  let quote: '"' | '\'' | '' = ''

  for (let i = 0; i < value.length; i++) {
    const ch = value[i]
    if ((ch === '"' || ch === '\'') && (i === 0 || value[i - 1] !== '\\')) {
      if (quote === '') quote = ch
      else if (quote === ch) quote = ''
      current += ch
      continue
    }
    if (ch === ',' && quote === '') {
      const item = unquote(current)
      if (item) result.push(item)
      current = ''
      continue
    }
    current += ch
  }

  const last = unquote(current)
  if (last) result.push(last)
  return result
}

function parseScalar(value: string): unknown {
  const trimmed = value.trim()
  if (!trimmed) return ''

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    return splitInlineList(trimmed.slice(1, -1))
  }

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      return trimmed
    }
  }

  const unquoted = unquote(trimmed)
  if (unquoted === 'true') return true
  if (unquoted === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(unquoted)) return Number(unquoted)
  return unquoted
}

function parseYamlNode(
  lines: string[],
  startIndex: number,
  indent: number,
): { value: unknown; index: number } {
  let index = startIndex
  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      index++
      continue
    }
    const lineIndent = getIndent(line)
    if (lineIndent < indent) return { value: '', index }
    if (trimmed.startsWith('- ')) return parseYamlList(lines, index, lineIndent)
    return parseYamlObject(lines, index, lineIndent)
  }
  return { value: '', index }
}

function parseYamlList(
  lines: string[],
  startIndex: number,
  indent: number,
): { value: unknown[]; index: number } {
  const result: unknown[] = []
  let index = startIndex

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      index++
      continue
    }

    const lineIndent = getIndent(line)
    if (lineIndent < indent) break
    if (lineIndent !== indent || !trimmed.startsWith('- ')) break

    const inline = trimmed.slice(2).trim()
    index++
    if (inline) {
      result.push(parseScalar(inline))
      continue
    }

    const nested = parseYamlNode(lines, index, indent + 2)
    if (nested.index === index) {
      result.push('')
      continue
    }
    result.push(nested.value)
    index = nested.index
  }

  return { value: result, index }
}

function parseYamlObject(
  lines: string[],
  startIndex: number,
  indent: number,
): { value: Record<string, unknown>; index: number } {
  const result: Record<string, unknown> = {}
  let index = startIndex

  while (index < lines.length) {
    const line = lines[index]
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      index++
      continue
    }

    const lineIndent = getIndent(line)
    if (lineIndent < indent) break
    if (lineIndent > indent) {
      index++
      continue
    }
    if (trimmed.startsWith('- ')) break

    const match = trimmed.match(/^(['"]?)([A-Za-z0-9_.-]+)\1\s*:\s*(.*)$/)
    if (!match) {
      index++
      continue
    }

    const key = match[2]
    const rest = match[3].trim()
    index++

    if (rest) {
      result[key] = parseScalar(rest)
      continue
    }

    const nested = parseYamlNode(lines, index, indent + 2)
    if (nested.index === index) {
      result[key] = ''
      continue
    }
    result[key] = nested.value
    index = nested.index
  }

  return { value: result, index }
}

function parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string; hasFrontmatter: boolean } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: content, hasFrontmatter: false }

  const yamlBlock = match[1]
  const body = match[2]
  const lines = yamlBlock.split('\n')
  const parsed = parseYamlObject(lines, 0, 0).value
  return { meta: parsed, body, hasFrontmatter: true }
}

function toStringArray(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === 'string' ? item : String(item)))
      .map((item) => item.trim())
      .filter(Boolean)
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    return [trimmed]
  }
  return []
}

function splitAllowedToolTokens(raw: string): string[] {
  const cleaned = raw.trim()
  if (!cleaned) return []

  if (cleaned.startsWith('[') && cleaned.endsWith(']')) {
    return splitInlineList(cleaned.slice(1, -1))
  }

  if (cleaned.includes(',')) {
    return cleaned.split(',').map((token) => unquote(token.trim())).filter(Boolean)
  }

  if (cleaned.includes(' ')) {
    return cleaned.split(/\s+/).map((token) => unquote(token.trim())).filter(Boolean)
  }

  return [unquote(cleaned)]
}

function mapAllowedToolToUsanTools(token: string): string[] {
  const lower = token.toLowerCase()
  const mapped = new Set<string>()
  if (lower.includes('bash') || lower.includes('exec') || lower.includes('shell')) mapped.add('run_command')
  if (/\bread\b/.test(lower)) mapped.add('read_file')
  if (/\b(write|edit)\b/.test(lower)) mapped.add('write_file')
  if (/\b(list|glob|grep|ls)\b/.test(lower)) mapped.add('list_directory')
  if (/\b(tts|speak|voice)\b/.test(lower)) mapped.add('speak_text')
  if (/\b(message|clipboard)\b/.test(lower)) mapped.add('clipboard_write')
  if (/\b(search|web)\b/.test(lower)) mapped.add('web_search')
  return Array.from(mapped)
}

function parseAllowedTools(raw: unknown): string[] {
  const tokens = toStringArray(raw).flatMap(splitAllowedToolTokens)
  return [...new Set(tokens.flatMap(mapAllowedToolToUsanTools))]
}

function parseMetadata(raw: unknown): SkillMetadata {
  if (!raw || typeof raw !== 'object') return {}
  const rawObj = raw as Record<string, unknown>
  const nestedUsan = rawObj['usan']
  const nestedLegacy = rawObj[LEGACY_BRAND_LOWER]
  const obj =
    nestedUsan && typeof nestedUsan === 'object'
      ? (nestedUsan as Record<string, unknown>)
      : nestedLegacy && typeof nestedLegacy === 'object'
        ? (nestedLegacy as Record<string, unknown>)
        : rawObj
  return {
    emoji: typeof obj.emoji === 'string' ? obj.emoji : undefined,
    os: Array.isArray(obj.os) ? obj.os : undefined,
    requires: obj.requires && typeof obj.requires === 'object'
      ? { bins: Array.isArray((obj.requires as Record<string, unknown>).bins) ? (obj.requires as Record<string, unknown>).bins as string[] : undefined }
      : undefined,
    examples: Array.isArray(obj.examples) ? obj.examples : undefined,
  }
}

function normalizeBrandText(value: string): string {
  const legacyTitleRegex = new RegExp(`\\b${LEGACY_BRAND_TITLE}\\b`, 'g')
  const legacyLowerRegex = new RegExp(`\\b${LEGACY_BRAND_LOWER}\\b`, 'g')
  return value
    .replace(legacyTitleRegex, 'Usan')
    .replace(legacyLowerRegex, 'usan')
}

function toSafeSkillId(rawId: string, filePath: string): string {
  const normalized = rawId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (normalized) return normalized

  const hash = createHash('sha1').update(filePath).digest('hex').slice(0, 8)
  return `skill-${hash}`
}

async function loadSkillFile(filePath: string): Promise<Skill | null> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const { meta, body, hasFrontmatter } = parseFrontmatter(content)

    if (!hasFrontmatter) return null

    const rawName = typeof meta.name === 'string' ? meta.name.trim() : ''
    const pathFallback = basename(dirname(filePath))
    const rawId =
      typeof meta.id === 'string' && meta.id.trim()
        ? meta.id.trim()
        : rawName || pathFallback

    if (!rawName && !rawId && !pathFallback) return null

    const id = toSafeSkillId(rawId || rawName || pathFallback, filePath)
    const name = normalizeBrandText(rawName || rawId || pathFallback || id)
    const parsedTriggers = toStringArray(meta.triggers)
    const parsedReadWhen = toStringArray(meta.read_when).slice(0, 8)
    const triggerSource = parsedTriggers.length > 0 ? parsedTriggers : parsedReadWhen
    const normalizedTriggers = triggerSource.map((trigger) => normalizeBrandText(trigger))
    const triggers = normalizedTriggers.length > 0 ? normalizedTriggers : [name]
    const description = normalizeBrandText((meta.description as string) || '')
    const parsedTools = toStringArray(meta.tools)
    const parsedAllowedTools =
      parsedTools.length > 0
        ? []
        : parseAllowedTools(meta['allowed-tools'] ?? meta.allowed_tools)
    const tools = [...new Set((parsedTools.length > 0 ? parsedTools : parsedAllowedTools).map((tool) => tool.trim()).filter(Boolean))]

    return {
      meta: {
        id,
        name,
        description,
        triggers,
        tools,
        category: (meta.category as string) || 'general',
        metadata: parseMetadata(meta.metadata),
      },
      procedure: body.trim(),
      filePath,
      eligible: true,
    }
  } catch {
    return null
  }
}

async function scanDir(dirPath: string): Promise<string[]> {
  const results: string[] = []
  try {
    const entries = await readdir(dirPath, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)
      if (entry.isDirectory()) {
        // Check for SKILL.md inside directory (new format)
        const skillMd = join(fullPath, 'SKILL.md')
        try {
          await access(skillMd)
          results.push(skillMd)
        } catch {
          // No SKILL.md, recurse into subdirectory
          results.push(...await scanDir(fullPath))
        }
      } else if (entry.name.endsWith('.skill.md')) {
        // Legacy format
        results.push(fullPath)
      }
    }
  } catch {
    // directory not accessible
  }
  return results
}

async function checkBinaryExists(bin: string): Promise<boolean> {
  if (!/^[\w.-]+$/.test(bin)) return false

  if (binaryExistsCache.has(bin)) {
    return binaryExistsCache.get(bin)!
  }

  const cmd = process.platform === 'win32' ? 'where' : 'which'
  try {
    await execFileAsync(cmd, [bin], { timeout: 5000, windowsHide: true })
    binaryExistsCache.set(bin, true)
    return true
  } catch {
    binaryExistsCache.set(bin, false)
    return false
  }
}

async function checkEligibility(skill: Skill): Promise<boolean> {
  const { metadata } = skill.meta

  if (metadata.os && metadata.os.length > 0) {
    if (!metadata.os.includes(process.platform)) return false
  }

  if (metadata.requires?.bins) {
    for (const bin of metadata.requires.bins) {
      if (!await checkBinaryExists(bin)) return false
    }
  }

  return true
}

export async function loadAllSkills(skillsDir: string): Promise<Skill[]> {
  const files = await scanDir(skillsDir)
  const skills: Skill[] = []

  for (const file of files) {
    const skill = await loadSkillFile(file)
    if (skill) skills.push(skill)
  }

  return skills
}

// Module-level cache to avoid rescanning filesystem on every tool call
const cachedSkillsByKey = new Map<string, { skills: Skill[]; ts: number }>()
const CACHE_TTL_MS = 60_000 // 1 minute

function normalizeCategories(categories?: string[]): string[] {
  if (!categories?.length) return []
  return [...new Set(categories.map((c) => c.trim().toLowerCase()).filter(Boolean))]
}

function parseMaxSkills(raw: string | undefined): number | null {
  if (!raw) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return Math.floor(parsed)
}

function resolveLoaderOptions(options?: SkillLoaderOptions): ResolvedSkillLoaderOptions {
  const envMax = parseMaxSkills(process.env['USAN_SKILLS_MAX_COUNT'])
  const envCategories = normalizeCategories(
    process.env['USAN_SKILLS_CATEGORIES']?.split(',').map((v) => v.trim()) ?? []
  )
  const optionMax =
    typeof options?.maxSkills === 'number' && Number.isFinite(options.maxSkills) && options.maxSkills > 0
      ? Math.floor(options.maxSkills)
      : null
  const optionCategories = normalizeCategories(options?.includeCategories)

  return {
    maxSkills: optionMax ?? envMax,
    includeCategories: optionCategories.length > 0 ? optionCategories : envCategories,
  }
}

function toCacheKey(options: ResolvedSkillLoaderOptions): string {
  return JSON.stringify({
    maxSkills: options.maxSkills,
    includeCategories: options.includeCategories,
  })
}

export function filterSkillsForRuntime(skills: Skill[], options?: SkillLoaderOptions): Skill[] {
  const resolved = resolveLoaderOptions(options)
  let result = skills

  if (resolved.includeCategories.length > 0) {
    const allowed = new Set(resolved.includeCategories)
    result = result.filter((skill) => allowed.has(skill.meta.category.toLowerCase()))
  }

  if (resolved.maxSkills !== null) {
    result = result.slice(0, resolved.maxSkills)
  }

  return result
}

export async function loadAllSkillsMultiSource(options?: SkillLoaderOptions): Promise<Skill[]> {
  const resolvedOptions = resolveLoaderOptions(options)
  const cacheKey = toCacheKey(resolvedOptions)
  const now = Date.now()
  const cached = cachedSkillsByKey.get(cacheKey)
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.skills
  }

  const allSkills: Skill[] = []
  const seenIds = new Set<string>()

  // Source 1: Built-in skills (lowest priority)
  const builtInDir = getBuiltInSkillsDir()
  const builtIn = await loadAllSkills(builtInDir)
  for (const skill of builtIn) {
    seenIds.add(skill.meta.id)
    allSkills.push(skill)
  }

  // Source 2: User skills (higher priority, override built-in by id)
  const userDir = getUserSkillsDir()
  try {
    const userSkills = await loadAllSkills(userDir)
    for (const skill of userSkills) {
      if (seenIds.has(skill.meta.id)) {
        const idx = allSkills.findIndex((s) => s.meta.id === skill.meta.id)
        if (idx !== -1) allSkills[idx] = skill
      } else {
        seenIds.add(skill.meta.id)
        allSkills.push(skill)
      }
    }
  } catch {
    // user skills dir doesn't exist yet
  }

  const filteredSkills = filterSkillsForRuntime(allSkills, options)

  // Run eligibility checks
  await Promise.all(filteredSkills.map(async (skill) => {
    skill.eligible = await checkEligibility(skill)
  }))

  cachedSkillsByKey.set(cacheKey, {
    skills: filteredSkills,
    ts: Date.now(),
  })
  return filteredSkills
}

export function getEligibleSkills(skills: Skill[]): Skill[] {
  return skills.filter((s) => s.eligible)
}

export function getBuiltInSkillsDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'skills')
  }
  return join(__dirname, '..', 'skills', 'built-in')
}

export function getUserSkillsDir(): string {
  return join(app.getPath('userData'), 'skills')
}
