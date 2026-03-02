import { readFile, readdir, access } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

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

function parseFrontmatter(content: string): { meta: Record<string, unknown>; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) return { meta: {}, body: content }

  const yamlBlock = match[1]
  const body = match[2]
  const meta: Record<string, unknown> = {}

  for (const line of yamlBlock.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const colonIdx = trimmed.indexOf(':')
    if (colonIdx === -1) continue

    const key = trimmed.slice(0, colonIdx).trim()
    let value: unknown = trimmed.slice(colonIdx + 1).trim()

    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map((s) => s.trim().replace(/^["']|["']$/g, ''))
    }

    if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
      try {
        value = JSON.parse(value)
      } catch {
        // leave as string if JSON parse fails
      }
    }

    meta[key] = value
  }

  return { meta, body }
}

function parseMetadata(raw: unknown): SkillMetadata {
  if (!raw || typeof raw !== 'object') return {}
  const obj = raw as Record<string, unknown>
  return {
    emoji: typeof obj.emoji === 'string' ? obj.emoji : undefined,
    os: Array.isArray(obj.os) ? obj.os : undefined,
    requires: obj.requires && typeof obj.requires === 'object'
      ? { bins: Array.isArray((obj.requires as Record<string, unknown>).bins) ? (obj.requires as Record<string, unknown>).bins as string[] : undefined }
      : undefined,
    examples: Array.isArray(obj.examples) ? obj.examples : undefined,
  }
}

async function loadSkillFile(filePath: string): Promise<Skill | null> {
  try {
    const content = await readFile(filePath, 'utf-8')
    const { meta, body } = parseFrontmatter(content)

    if (!meta.id || !meta.name) return null

    return {
      meta: {
        id: meta.id as string,
        name: meta.name as string,
        description: (meta.description as string) || '',
        triggers: Array.isArray(meta.triggers)
          ? meta.triggers as string[]
          : typeof meta.triggers === 'string'
            ? [meta.triggers]
            : [],
        tools: Array.isArray(meta.tools)
          ? meta.tools as string[]
          : typeof meta.tools === 'string'
            ? [meta.tools]
            : [],
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
  const cmd = process.platform === 'win32' ? 'where' : 'which'
  try {
    await execFileAsync(cmd, [bin], { timeout: 5000, windowsHide: true })
    return true
  } catch {
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
let cachedSkills: Skill[] | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 60_000 // 1 minute

export async function loadAllSkillsMultiSource(): Promise<Skill[]> {
  const now = Date.now()
  if (cachedSkills && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedSkills
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

  // Run eligibility checks
  await Promise.all(allSkills.map(async (skill) => {
    skill.eligible = await checkEligibility(skill)
  }))

  cachedSkills = allSkills
  cacheTimestamp = Date.now()
  return allSkills
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
