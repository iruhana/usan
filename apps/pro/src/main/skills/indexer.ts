/**
 * Skills Indexer
 * Reads SKILL.md files from a local directory tree, parses metadata,
 * and caches everything in SQLite for fast queries.
 *
 * Directory layout expected (OpenClaw convention):
 *   <root>/<slug>/<version>/SKILL.md
 *   <root>/<slug>/<version>/_clawhub_meta.json
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'fs'
import { join } from 'path'
import type { SkillMeta } from '@shared/types'

let _db: import('better-sqlite3').Database | null = null
let _dbPath: string | null = null

interface ClawhubMeta {
  slug?: string
  version?: string
  downloads?: number
  stars?: number
}

interface SkillFrontmatter {
  name?: string
  description?: string
  emoji?: string
  author?: string
  category?: string
}

function isRecoverableSqliteError(error: unknown): boolean {
  const text = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return /SQLITE_CORRUPT|SQLITE_NOTADB|malformed|disk image is malformed|corrupt/i.test(text)
}

function closeCachedDb(): void {
  if (!_db) return
  try {
    _db.close()
  } catch {
    // Ignore close failures while recovering a broken cache.
  } finally {
    _db = null
    _dbPath = null
  }
}

function archiveCorruptDb(dbPath: string): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dbDir = dbPath.replace(/[\\/][^\\/]+$/, '')
  mkdirSync(dbDir, { recursive: true })

  for (const suffix of ['', '-wal', '-shm']) {
    const source = `${dbPath}${suffix}`
    if (!existsSync(source)) continue

    if (suffix === '') {
      const backup = `${dbPath}.corrupt-${stamp}.bak`
      try {
        renameSync(source, backup)
      } catch {
        rmSync(source, { force: true })
      }
      continue
    }

    rmSync(source, { force: true })
  }
}

function initializeSchema(db: import('better-sqlite3').Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      slug        TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      version     TEXT NOT NULL DEFAULT '1.0.0',
      author      TEXT NOT NULL DEFAULT '',
      downloads   INTEGER NOT NULL DEFAULT 0,
      stars       INTEGER NOT NULL DEFAULT 0,
      emoji       TEXT NOT NULL DEFAULT '*',
      category    TEXT NOT NULL DEFAULT 'general',
      skill_path  TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS skills_fts
      USING fts5(slug, name, description, content='skills', content_rowid='rowid');
  `)
}

function createDb(dbPath: string): import('better-sqlite3').Database {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3') as typeof import('better-sqlite3')
  const db = new Database(dbPath)
  initializeSchema(db)
  db.prepare('PRAGMA integrity_check').get()
  _db = db
  _dbPath = dbPath
  return db
}

function getDb(dbPath: string): import('better-sqlite3').Database {
  if (_db && _dbPath === dbPath) return _db
  closeCachedDb()

  try {
    return createDb(dbPath)
  } catch (error) {
    if (!isRecoverableSqliteError(error)) throw error
    archiveCorruptDb(dbPath)
    return createDb(dbPath)
  }
}

function withDbRecovery<T>(dbPath: string, action: (db: import('better-sqlite3').Database) => T): T {
  try {
    return action(getDb(dbPath))
  } catch (error) {
    if (!isRecoverableSqliteError(error)) throw error
    closeCachedDb()
    archiveCorruptDb(dbPath)
    return action(getDb(dbPath))
  }
}

function parseFrontmatter(md: string): SkillFrontmatter {
  const match = md.match(/^---\s*\n([\s\S]*?)\n---/)
  if (!match) return {}

  const block = match[1]
  const result: SkillFrontmatter = {}

  for (const line of block.split('\n')) {
    const kv = line.match(/^(\w+):\s*(.+)$/)
    if (!kv) continue

    const [, key, val] = kv
    const clean = val.trim().replace(/^['"]|['"]$/g, '')
    if (key === 'name') result.name = clean
    else if (key === 'description') result.description = clean
    else if (key === 'author') result.author = clean
    else if (key === 'category') result.category = clean
  }

  const emojiMatch = block.match(/emoji:\s*(\S+)/)
  if (emojiMatch) result.emoji = emojiMatch[1]

  return result
}

function deriveCategory(slug: string): string {
  const map: Record<string, string[]> = {
    ai: ['ai-', 'llm', 'gpt', 'openai', 'anthropic', 'gemini'],
    dev: ['github', 'git', 'docker', 'k8s', 'kubernetes', 'vercel', 'netlify', 'aws', 'gcp', 'azure', 'terraform', 'ansible'],
    productivity: ['notion', 'linear', 'jira', 'asana', 'trello', 'slack', 'discord', 'email', 'calendar'],
    data: ['sql', 'postgres', 'mysql', 'mongo', 'redis', 'elasticsearch', 'snowflake', 'bigquery', 'dbt'],
    research: ['arxiv', 'academic', 'research', 'paper', 'scholar'],
    finance: ['stock', 'crypto', 'finance', 'trading', 'coinbase', 'binance'],
    marketing: ['twitter', 'linkedin', 'instagram', 'facebook', 'seo', 'analytics', 'hubspot'],
    security: ['security', '1password', 'vault', 'auth', 'oauth', 'saml'],
    media: ['youtube', 'spotify', 'podcast', 'video', 'image', 'photo'],
    agent: ['agent', 'autonomy', 'agentic', 'browser', 'computer-use'],
  }

  for (const [category, patterns] of Object.entries(map)) {
    if (patterns.some((pattern) => slug.includes(pattern))) return category
  }

  return 'general'
}

export function indexSkills(skillsRoot: string, dbPath: string): number {
  if (!existsSync(skillsRoot)) return 0

  return withDbRecovery(dbPath, (db) => {
    const upsert = db.prepare(`
      INSERT INTO skills (slug, name, description, version, author, downloads, stars, emoji, category, skill_path)
      VALUES (@slug, @name, @description, @version, @author, @downloads, @stars, @emoji, @category, @skillPath)
      ON CONFLICT(slug) DO UPDATE SET
        name=excluded.name,
        description=excluded.description,
        version=excluded.version,
        author=excluded.author,
        downloads=excluded.downloads,
        stars=excluded.stars,
        emoji=excluded.emoji,
        category=excluded.category,
        skill_path=excluded.skill_path
    `)

    const insertMany = db.transaction((rows: SkillMeta[]) => {
      db.exec('DELETE FROM skills; DELETE FROM skills_fts;')
      for (const row of rows) upsert.run(row)
      db.exec('INSERT INTO skills_fts(rowid, slug, name, description) SELECT rowid, slug, name, description FROM skills;')
    })

    const slugDirs = readdirSync(skillsRoot, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())

    const rows: SkillMeta[] = []

    for (const slugDir of slugDirs) {
      const slug = slugDir.name
      const slugPath = join(skillsRoot, slug)

      let versionDirs: string[] = []
      try {
        versionDirs = readdirSync(slugPath, { withFileTypes: true })
          .filter((dirent) => dirent.isDirectory())
          .map((dirent) => dirent.name)
          .sort()
      } catch {
        continue
      }

      if (versionDirs.length === 0) continue
      const latestVersion = versionDirs[versionDirs.length - 1]
      const versionPath = join(slugPath, latestVersion)

      let frontmatter: SkillFrontmatter = {}
      const skillMdPath = join(versionPath, 'SKILL.md')
      if (existsSync(skillMdPath)) {
        try {
          frontmatter = parseFrontmatter(readFileSync(skillMdPath, 'utf-8'))
        } catch {
          // Ignore unreadable markdown and keep indexing.
        }
      }

      let clawMeta: ClawhubMeta = {}
      const clawMetaPath = join(versionPath, '_clawhub_meta.json')
      if (existsSync(clawMetaPath)) {
        try {
          clawMeta = JSON.parse(readFileSync(clawMetaPath, 'utf-8'))
        } catch {
          // Ignore malformed metadata and keep indexing.
        }
      }

      rows.push({
        slug,
        name: frontmatter.name ?? slug,
        description: frontmatter.description ?? '',
        version: clawMeta.version ?? latestVersion,
        author: frontmatter.author ?? '',
        downloads: clawMeta.downloads ?? 0,
        stars: clawMeta.stars ?? 0,
        emoji: frontmatter.emoji ?? '*',
        category: frontmatter.category ?? deriveCategory(slug),
        skillPath: versionPath,
      })
    }

    insertMany(rows)
    return rows.length
  })
}

export function querySkills(dbPath: string, query?: string, limit = 100): SkillMeta[] {
  return withDbRecovery(dbPath, (db) => {
    if (query && query.trim()) {
      const rows = db.prepare(`
        SELECT s.* FROM skills_fts f
        JOIN skills s ON s.rowid = f.rowid
        WHERE skills_fts MATCH ?
        ORDER BY s.downloads DESC
        LIMIT ?
      `).all(`${query.trim()}*`, limit) as Record<string, unknown>[]

      return rows.map(rowToMeta)
    }

    return (db.prepare('SELECT * FROM skills ORDER BY downloads DESC LIMIT ?').all(limit) as Record<string, unknown>[]).map(rowToMeta)
  })
}

export function readSkillContent(skillPath: string): string {
  const mdPath = join(skillPath, 'SKILL.md')
  if (!existsSync(mdPath)) return '# Skill\n\nNo documentation found.'
  return readFileSync(mdPath, 'utf-8')
}

export function closeSkillIndexCache(): void {
  closeCachedDb()
}

function rowToMeta(row: Record<string, unknown>): SkillMeta {
  return {
    slug: row.slug as string,
    name: row.name as string,
    description: row.description as string,
    version: row.version as string,
    author: row.author as string,
    downloads: row.downloads as number,
    stars: row.stars as number,
    emoji: row.emoji as string,
    category: row.category as string,
    skillPath: row.skill_path as string,
  }
}
