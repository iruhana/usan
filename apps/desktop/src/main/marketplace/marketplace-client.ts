import AdmZip from 'adm-zip'
import { createHash } from 'crypto'
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'fs/promises'
import { app } from 'electron'
import { extname, isAbsolute, join, resolve, sep } from 'path'
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
  sourceSha256?: string
  mcpServerCount?: number
}

interface MarketplaceCatalogPayload {
  plugins?: MarketplaceCatalogEntry[]
}

interface CatalogSourceMetadata {
  sourceSha256?: string
}

interface ResolvedInstallSource {
  path: string
  cleanupPath?: string
}

const CATALOG_CACHE_MS = 5 * 60 * 1000
const FETCH_TIMEOUT_MS = 30_000
const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024

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

function isArchivePath(pathLike: string): boolean {
  return extname(pathLike).toLowerCase() === '.zip'
}

async function isDirectory(pathLike: string): Promise<boolean> {
  const meta = await stat(pathLike).catch(() => null)
  return !!meta?.isDirectory()
}

async function isFile(pathLike: string): Promise<boolean> {
  const meta = await stat(pathLike).catch(() => null)
  return !!meta?.isFile()
}

function decodeFileUrl(value: string): string {
  return value.startsWith('file:///')
    ? decodeURIComponent(value.replace(/^file:\/\//i, ''))
    : value
}

export class MarketplaceClient {
  private catalogEntriesCache: MarketplaceEntry[] = []
  private catalogSourceById: Map<string, string> = new Map()
  private catalogMetadataById: Map<string, CatalogSourceMetadata> = new Map()
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

    const resolvedSource = await this.resolveSource(normalizedId)
    if (resolvedSource) {
      try {
        return await pluginManager.install(resolvedSource.path)
      } finally {
        if (resolvedSource.cleanupPath) {
          await rm(resolvedSource.cleanupPath, { recursive: true, force: true }).catch(() => {})
        }
      }
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

  private async resolveSource(pluginId: string): Promise<ResolvedInstallSource | null> {
    let source = this.catalogSourceById.get(pluginId)
    if (!source) {
      await this.loadCatalogEntries(true)
      source = this.catalogSourceById.get(pluginId)
    }

    if (!source) return null

    const metadata = this.catalogMetadataById.get(pluginId)
    if (isLikelyUrl(source)) {
      return this.resolveRemoteArchive(pluginId, source, metadata)
    }

    const asPath = decodeFileUrl(source)
    const resolved = resolve(asPath)
    if (await isDirectory(resolved)) {
      return { path: resolved }
    }
    if (await isFile(resolved) && isArchivePath(resolved)) {
      return this.resolveArchiveFromFile(pluginId, resolved, metadata)
    }

    throw new Error(`Plugin source not found or unsupported: ${resolved}`)
  }

  private async resolveRemoteArchive(
    pluginId: string,
    sourceUrl: string,
    metadata?: CatalogSourceMetadata,
  ): Promise<ResolvedInstallSource> {
    const response = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new Error(`Failed to download plugin archive: ${response.status}`)
    }

    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length === 0 || bytes.length > MAX_ARCHIVE_BYTES) {
      throw new Error('Plugin archive is empty or exceeds the supported size limit')
    }

    if (metadata?.sourceSha256) {
      const actual = this.sha256(bytes)
      if (actual !== metadata.sourceSha256.trim().toLowerCase()) {
        throw new Error('Plugin archive checksum mismatch')
      }
    }

    return this.extractArchive(bytes)
  }

  private async resolveArchiveFromFile(
    pluginId: string,
    archivePath: string,
    metadata?: CatalogSourceMetadata,
  ): Promise<ResolvedInstallSource> {
    const bytes = await readFile(archivePath)
    if (bytes.length === 0 || bytes.length > MAX_ARCHIVE_BYTES) {
      throw new Error('Plugin archive is empty or exceeds the supported size limit')
    }

    if (metadata?.sourceSha256) {
      const actual = this.sha256(bytes)
      if (actual !== metadata.sourceSha256.trim().toLowerCase()) {
        throw new Error('Plugin archive checksum mismatch')
      }
    }

    return this.extractArchive(bytes)
  }

  private async extractArchive(bytes: Buffer): Promise<ResolvedInstallSource> {
    const stagingRoot = await mkdtemp(join(app.getPath('temp'), 'usan-marketplace-'))
    const extractRoot = join(stagingRoot, 'archive')
    try {
      await mkdir(extractRoot, { recursive: true })

      const archive = new AdmZip(bytes)
      let totalUncompressedBytes = 0

      for (const entry of archive.getEntries()) {
        const entryName = entry.entryName.replace(/\\/g, '/').replace(/^\/+/, '')
        if (!entryName) continue
        if (
          entryName.includes('../')
          || entryName.startsWith('..')
          || /^[a-zA-Z]:/.test(entryName)
        ) {
          throw new Error(`Plugin archive contains an invalid path: ${entryName}`)
        }

        const normalizedDest = resolve(join(extractRoot, entryName))
        const normalizedRoot = resolve(extractRoot)
        if (!normalizedDest.startsWith(normalizedRoot + sep) && normalizedDest !== normalizedRoot) {
          throw new Error(`Plugin archive escaped extraction root: ${entryName}`)
        }
        const destination = normalizedDest

        if (entry.isDirectory) {
          await mkdir(destination, { recursive: true })
          continue
        }

        totalUncompressedBytes += entry.header.size
        if (totalUncompressedBytes > MAX_ARCHIVE_BYTES) {
          throw new Error('Plugin archive expands beyond the supported size limit')
        }

        await mkdir(resolve(join(destination, '..')), { recursive: true })
        await writeFile(destination, entry.getData())
      }

      const pluginRoot = await this.findPluginRoot(extractRoot)
      return { path: pluginRoot, cleanupPath: stagingRoot }
    } catch (error) {
      await rm(stagingRoot, { recursive: true, force: true }).catch(() => {})
      throw error
    }
  }

  private async findPluginRoot(extractRoot: string): Promise<string> {
    if (await isFile(join(extractRoot, 'manifest.json'))) {
      return extractRoot
    }

    const entries = await readdir(extractRoot, { withFileTypes: true })
    const directories = entries.filter((entry) => entry.isDirectory())
    if (directories.length !== 1) {
      throw new Error('Plugin archive must contain manifest.json at the root or in a single top-level folder')
    }

    const candidateRoot = join(extractRoot, directories[0].name)
    if (!(await isFile(join(candidateRoot, 'manifest.json')))) {
      throw new Error('Plugin archive is missing manifest.json')
    }

    return candidateRoot
  }

  private async loadCatalogEntries(force = false): Promise<MarketplaceEntry[]> {
    const now = Date.now()
    if (!force && now < this.cacheExpiresAt) {
      return this.catalogEntriesCache
    }

    const sourceById = new Map<string, string>()
    const metadataById = new Map<string, CatalogSourceMetadata>()
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
          metadataById.set(item.entry.id, item.metadata ?? {})
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
          metadataById.set(item.entry.id, item.metadata ?? {})
        }
      }
    }

    this.catalogSourceById = sourceById
    this.catalogMetadataById = metadataById
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

  private async readCatalogFromFile(
    filePath: string,
  ): Promise<Array<{ entry: MarketplaceEntry; sourcePath?: string; metadata?: CatalogSourceMetadata }>> {
    const raw = await readFile(filePath, 'utf-8').catch(() => null)
    if (!raw) return []
    return this.parseCatalog(raw, filePath)
  }

  private async readCatalogFromUrl(
    url: string,
  ): Promise<Array<{ entry: MarketplaceEntry; sourcePath?: string; metadata?: CatalogSourceMetadata }>> {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    }).catch(() => null)
    if (!response?.ok) return []
    const raw = await response.text().catch(() => '')
    if (!raw) return []
    return this.parseCatalog(raw, url)
  }

  private parseCatalog(
    raw: string,
    sourceHint: string,
  ): Array<{ entry: MarketplaceEntry; sourcePath?: string; metadata?: CatalogSourceMetadata }> {
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

    const out: Array<{ entry: MarketplaceEntry; sourcePath?: string; metadata?: CatalogSourceMetadata }> = []
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
        mcpServerCount: parseNumber(item.mcpServerCount, 0),
      }

      const source = typeof item.source === 'string' ? item.source.trim() : ''
      const metadata: CatalogSourceMetadata = {
        sourceSha256: typeof item.sourceSha256 === 'string' ? item.sourceSha256.trim().toLowerCase() : undefined,
      }

      if (source) {
        const sourcePath = this.resolveCatalogSource(source, sourceHint)
        out.push({ entry, sourcePath, metadata })
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

  private sha256(value: string | Buffer): string {
    return createHash('sha256').update(value).digest('hex')
  }
}

export const marketplaceClient = new MarketplaceClient()
