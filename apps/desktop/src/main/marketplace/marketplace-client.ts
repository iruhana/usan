import { readFile, stat } from 'fs/promises'
import { app } from 'electron'
import { isAbsolute, join, resolve } from 'path'
import type { InstalledPlugin, MarketplaceEntry } from '@shared/types/infrastructure'
import { pluginManager } from '../infrastructure/plugin-manager'

interface MarketplaceCatalogEntry {
  id?: string
  name?: string
  version?: string
  description?: string
  author?: string
  downloads?: number
  rating?: number
  tags?: string[]
  source?: string
}

interface MarketplaceCatalogPayload {
  plugins?: MarketplaceCatalogEntry[]
}

const CATALOG_CACHE_MS = 5 * 60 * 1000

function parseNumber(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12)
}

function splitCsv(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function isLikelyUrl(value: string): boolean {
  return /^https?:\/\//i.test(value)
}

async function isDirectory(pathLike: string): Promise<boolean> {
  const meta = await stat(pathLike).catch(() => null)
  return !!meta?.isDirectory()
}

export class MarketplaceClient {
  private catalogEntriesCache: MarketplaceEntry[] = []
  private catalogSourceById: Map<string, string> = new Map()
  private cacheExpiresAt = 0

  async search(query: string): Promise<MarketplaceEntry[]> {
    const [localEntries, catalogEntries] = await Promise.all([
      pluginManager.searchMarketplace(''),
      this.loadCatalogEntries(),
    ])

    const merged = new Map<string, MarketplaceEntry>()

    for (const entry of localEntries) {
      merged.set(entry.id, entry)
    }

    for (const entry of catalogEntries) {
      const prev = merged.get(entry.id)
      if (!prev) {
        merged.set(entry.id, entry)
        continue
      }

      // Keep richer catalog metadata while preserving discovered local tags.
      merged.set(entry.id, {
        ...prev,
        ...entry,
        tags: entry.tags.length > 0 ? entry.tags : prev.tags,
      })
    }

    const entries = Array.from(merged.values())
      .sort((a, b) => {
        if (b.rating !== a.rating) return b.rating - a.rating
        if (b.downloads !== a.downloads) return b.downloads - a.downloads
        return a.name.localeCompare(b.name)
      })

    const normalized = query.trim().toLowerCase()
    if (!normalized) return entries

    return entries.filter((entry) => {
      const haystacks = [entry.id, entry.name, entry.description, entry.author, ...entry.tags]
      return haystacks.some((value) => value.toLowerCase().includes(normalized))
    })
  }

  async install(pluginId: string): Promise<InstalledPlugin> {
    const normalizedId = pluginId.trim()
    if (!normalizedId) {
      throw new Error('pluginId is required')
    }

    const source = await this.resolveSource(normalizedId)
    if (source) {
      return pluginManager.install(source)
    }

    return pluginManager.installFromMarketplace(normalizedId)
  }

  async update(pluginId: string): Promise<InstalledPlugin> {
    const normalizedId = pluginId.trim()
    if (!normalizedId) {
      throw new Error('pluginId is required')
    }

    const installed = pluginManager.getPlugin(normalizedId)
    if (installed) {
      await pluginManager.uninstall(normalizedId)
    }

    return this.install(normalizedId)
  }

  private async resolveSource(pluginId: string): Promise<string | null> {
    let source = this.catalogSourceById.get(pluginId)
    if (!source) {
      await this.loadCatalogEntries(true)
      source = this.catalogSourceById.get(pluginId)
    }

    if (!source) return null
    if (isLikelyUrl(source)) {
      throw new Error(`Remote plugin source is not supported yet: ${source}`)
    }

    const asPath = source.startsWith('file:///')
      ? decodeURIComponent(source.replace(/^file:\/\//i, ''))
      : source
    const resolved = resolve(asPath)
    if (!(await isDirectory(resolved))) {
      throw new Error(`Plugin source directory not found: ${resolved}`)
    }

    return resolved
  }

  private async loadCatalogEntries(force = false): Promise<MarketplaceEntry[]> {
    const now = Date.now()
    if (!force && now < this.cacheExpiresAt) {
      return this.catalogEntriesCache
    }

    const sourceById = new Map<string, string>()
    const entriesById = new Map<string, MarketplaceEntry>()

    const filePaths = this.getCatalogFilePaths()
    for (const filePath of filePaths) {
      const parsed = await this.readCatalogFromFile(filePath)
      for (const item of parsed) {
        if (!entriesById.has(item.entry.id)) {
          entriesById.set(item.entry.id, item.entry)
        }
        if (item.sourcePath && !sourceById.has(item.entry.id)) {
          sourceById.set(item.entry.id, item.sourcePath)
        }
      }
    }

    const urls = this.getCatalogUrls()
    for (const url of urls) {
      const parsed = await this.readCatalogFromUrl(url)
      for (const item of parsed) {
        if (!entriesById.has(item.entry.id)) {
          entriesById.set(item.entry.id, item.entry)
        }
        if (item.sourcePath && !sourceById.has(item.entry.id)) {
          sourceById.set(item.entry.id, item.sourcePath)
        }
      }
    }

    this.catalogSourceById = sourceById
    this.catalogEntriesCache = Array.from(entriesById.values())
    this.cacheExpiresAt = now + CATALOG_CACHE_MS
    return this.catalogEntriesCache
  }

  private getCatalogFilePaths(): string[] {
    const envPaths = splitCsv(process.env['USAN_MARKETPLACE_CATALOG_PATHS'])
    const defaults = [
      join(app.getPath('userData'), 'marketplace', 'catalog.json'),
      join(app.getAppPath(), 'marketplace', 'catalog.json'),
    ]

    const candidates = [...envPaths, ...defaults]
    const unique = new Set<string>()
    for (const candidate of candidates) {
      const normalized = isAbsolute(candidate)
        ? resolve(candidate)
        : resolve(app.getAppPath(), candidate)
      unique.add(normalized)
    }

    return Array.from(unique)
  }

  private getCatalogUrls(): string[] {
    return splitCsv(process.env['USAN_MARKETPLACE_CATALOG_URLS'])
      .filter((value) => isLikelyUrl(value))
  }

  private async readCatalogFromFile(filePath: string): Promise<Array<{ entry: MarketplaceEntry; sourcePath?: string }>> {
    const raw = await readFile(filePath, 'utf-8').catch(() => null)
    if (!raw) return []
    return this.parseCatalog(raw, filePath)
  }

  private async readCatalogFromUrl(url: string): Promise<Array<{ entry: MarketplaceEntry; sourcePath?: string }>> {
    const response = await fetch(url).catch(() => null)
    if (!response?.ok) return []
    const raw = await response.text().catch(() => '')
    if (!raw) return []
    return this.parseCatalog(raw, url)
  }

  private parseCatalog(raw: string, sourceHint: string): Array<{ entry: MarketplaceEntry; sourcePath?: string }> {
    let payload: MarketplaceCatalogPayload | MarketplaceCatalogEntry[]
    try {
      payload = JSON.parse(raw) as MarketplaceCatalogPayload | MarketplaceCatalogEntry[]
    } catch {
      return []
    }

    const list = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.plugins)
        ? payload.plugins
        : []

    const out: Array<{ entry: MarketplaceEntry; sourcePath?: string }> = []
    for (const item of list) {
      const id = String(item.id ?? '').trim()
      if (!id) continue

      const entry: MarketplaceEntry = {
        id,
        name: String(item.name ?? id),
        version: String(item.version ?? '0.0.0'),
        description: String(item.description ?? ''),
        author: String(item.author ?? 'unknown'),
        downloads: parseNumber(item.downloads, 0),
        rating: parseNumber(item.rating, 0),
        tags: normalizeTags(item.tags),
      }

      const source = typeof item.source === 'string' ? item.source.trim() : ''
      if (source) {
        const sourcePath = this.resolveCatalogSource(source, sourceHint)
        out.push({ entry, sourcePath })
      } else {
        out.push({ entry })
      }
    }

    return out
  }

  private resolveCatalogSource(source: string, sourceHint: string): string {
    if (isLikelyUrl(source)) return source

    if (isLikelyUrl(sourceHint)) {
      try {
        return new URL(source, sourceHint).toString()
      } catch {
        return source
      }
    }

    return isAbsolute(source)
      ? resolve(source)
      : resolve(join(sourceHint, '..'), source)
  }
}

export const marketplaceClient = new MarketplaceClient()
