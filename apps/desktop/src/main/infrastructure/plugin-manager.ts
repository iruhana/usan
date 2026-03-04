/**
 * Plugin Manager: install/uninstall/enable/disable external skills and plugins.
 * Adds basic supply-chain hardening: digest checks, provenance checks, and symlink blocking.
 */
import { readFile, writeFile, mkdir, rm, readdir, stat, cp } from 'fs/promises'
import { createHash } from 'crypto'
import { join, resolve, sep } from 'path'
import { app } from 'electron'
import type { PluginManifest, InstalledPlugin, MarketplaceEntry } from '@shared/types/infrastructure'
import { eventBus } from './event-bus'

const PLUGINS_DIR = 'plugins'
const REGISTRY_FILE = 'plugin-registry.json'

export class PluginManager {
  private installed: Map<string, InstalledPlugin> = new Map()
  private marketplaceSourceById: Map<string, string> = new Map()

  private getPluginsDir(): string {
    return join(app.getPath('userData'), PLUGINS_DIR)
  }

  private getRegistryPath(): string {
    return join(app.getPath('userData'), REGISTRY_FILE)
  }

  private shouldEnforceIntegrity(): boolean {
    const env = process.env['USAN_REQUIRE_PLUGIN_INTEGRITY']
    if (env === 'true') return true
    if (env === 'false') return false
    return app.isPackaged
  }

  private shouldEnforceProvenance(): boolean {
    const env = process.env['USAN_REQUIRE_PLUGIN_PROVENANCE']
    if (env === 'true') return true
    if (env === 'false') return false
    return app.isPackaged
  }

  async init(): Promise<void> {
    await mkdir(this.getPluginsDir(), { recursive: true })
    await this.loadRegistry()
  }

  async install(source: string): Promise<InstalledPlugin> {
    const sourceDir = resolve(source)
    const sourceStats = await stat(sourceDir).catch(() => null)
    if (!sourceStats || !sourceStats.isDirectory()) {
      throw new Error(`Invalid plugin source directory: ${source}`)
    }

    await this.assertNoSymlinks(sourceDir)

    const manifestPath = join(sourceDir, 'manifest.json')
    const raw = await readFile(manifestPath, 'utf-8')
    const manifest = JSON.parse(raw) as PluginManifest

    this.validateManifest(manifest)
    await this.enforceManifestSecurity(manifest, sourceDir)

    // Do not allow reinstall without uninstall.
    if (this.installed.has(manifest.id)) {
      throw new Error(`Plugin already installed: ${manifest.id}`)
    }

    const pluginsRoot = resolve(this.getPluginsDir())
    const pluginDir = resolve(join(pluginsRoot, manifest.id))
    if (!this.isSubPath(pluginDir, pluginsRoot)) {
      throw new Error('Invalid plugin path: path traversal detected')
    }

    await cp(sourceDir, pluginDir, { recursive: true, force: false, errorOnExist: true })

    // Re-check copied payload digest to catch TOCTOU source mutations during copy.
    if (manifest.integrity?.filesDigest) {
      const expected = manifest.integrity.filesDigest.trim().toLowerCase()
      const copiedDigest = await this.computeDirectoryDigest(pluginDir, new Set(['manifest.json']))
      if (copiedDigest !== expected) {
        await rm(pluginDir, { recursive: true, force: true })
        throw new Error('Plugin integrity verification failed after copy')
      }
    }

    const plugin: InstalledPlugin = {
      manifest,
      path: pluginDir,
      enabled: true,
      installedAt: Date.now(),
    }

    this.installed.set(manifest.id, plugin)
    await this.saveRegistry()

    eventBus.emit('plugin.installed', { id: manifest.id, name: manifest.name }, 'plugin-manager')
    return plugin
  }

  async uninstall(id: string): Promise<void> {
    const plugin = this.installed.get(id)
    if (!plugin) throw new Error(`Plugin not found: ${id}`)

    try {
      await rm(plugin.path, { recursive: true, force: true })
    } catch {
      // Ignore: plugin dir may already be gone.
    }

    this.installed.delete(id)
    await this.saveRegistry()

    eventBus.emit('plugin.uninstalled', { id }, 'plugin-manager')
  }

  enable(id: string): void {
    const plugin = this.installed.get(id)
    if (!plugin) throw new Error(`Plugin not found: ${id}`)
    plugin.enabled = true
    this.saveRegistry()
    eventBus.emit('plugin.enabled', { id }, 'plugin-manager')
  }

  disable(id: string): void {
    const plugin = this.installed.get(id)
    if (!plugin) throw new Error(`Plugin not found: ${id}`)
    plugin.enabled = false
    this.saveRegistry()
    eventBus.emit('plugin.disabled', { id }, 'plugin-manager')
  }

  listInstalled(): InstalledPlugin[] {
    return Array.from(this.installed.values())
  }

  getPlugin(id: string): InstalledPlugin | undefined {
    return this.installed.get(id)
  }

  isEnabled(id: string): boolean {
    return this.installed.get(id)?.enabled ?? false
  }

  async searchMarketplace(query: string): Promise<MarketplaceEntry[]> {
    const entries = await this.discoverMarketplaceEntries()
    const normalized = query.trim().toLowerCase()
    if (!normalized) return entries

    return entries.filter((entry) => {
      const haystacks = [entry.id, entry.name, entry.description, entry.author, ...entry.tags]
      return haystacks.some((value) => value.toLowerCase().includes(normalized))
    })
  }

  async installFromMarketplace(id: string): Promise<InstalledPlugin> {
    const normalizedId = id.trim()
    if (!normalizedId) {
      throw new Error('Marketplace plugin id is required')
    }

    let source = this.marketplaceSourceById.get(normalizedId)
    if (!source) {
      await this.discoverMarketplaceEntries()
      source = this.marketplaceSourceById.get(normalizedId)
    }

    if (!source) {
      // Backward compatibility: allow direct local path installs through marketplace endpoint.
      const localCandidate = resolve(normalizedId)
      const stats = await stat(localCandidate).catch(() => null)
      if (stats?.isDirectory()) {
        return this.install(localCandidate)
      }
      throw new Error(`Marketplace source not found for plugin: ${normalizedId}`)
    }

    return this.install(source)
  }

  private validateManifest(manifest: PluginManifest): void {
    if (!manifest.id || !manifest.name || !manifest.version) {
      throw new Error('Invalid plugin manifest: missing required fields')
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(manifest.id)) {
      throw new Error('Invalid plugin ID: only alphanumeric, hyphens, and underscores allowed')
    }

    if (!Array.isArray(manifest.skills)) {
      throw new Error('Invalid plugin manifest: skills must be an array')
    }
  }

  private getMarketplaceRoots(): string[] {
    const roots = new Set<string>()
    const envRoot = process.env['USAN_MARKETPLACE_DIR']?.trim()
    if (envRoot) roots.add(resolve(envRoot))
    roots.add(resolve(join(app.getPath('userData'), 'marketplace')))
    roots.add(resolve(join(app.getAppPath(), 'marketplace')))
    return Array.from(roots)
  }

  private toMarketplaceEntry(manifest: PluginManifest): MarketplaceEntry {
    return {
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      description: manifest.description,
      author: manifest.author,
      downloads: 0,
      rating: 0,
      tags: (manifest.skills ?? []).slice(0, 6),
    }
  }

  private async discoverMarketplaceEntries(): Promise<MarketplaceEntry[]> {
    this.marketplaceSourceById.clear()
    const entries: MarketplaceEntry[] = []

    for (const root of this.getMarketplaceRoots()) {
      const rootStats = await stat(root).catch(() => null)
      if (!rootStats?.isDirectory()) continue

      const candidates = await readdir(root, { withFileTypes: true }).catch(() => [])
      for (const candidate of candidates) {
        if (!candidate.isDirectory()) continue
        const sourceDir = resolve(join(root, candidate.name))
        const manifest = await this.readManifest(sourceDir)
        if (!manifest) continue

        try {
          this.validateManifest(manifest)
        } catch {
          continue
        }

        if (this.marketplaceSourceById.has(manifest.id)) continue
        this.marketplaceSourceById.set(manifest.id, sourceDir)
        entries.push(this.toMarketplaceEntry(manifest))
      }
    }

    for (const installed of this.installed.values()) {
      if (entries.some((entry) => entry.id === installed.manifest.id)) continue
      entries.push(this.toMarketplaceEntry(installed.manifest))
    }

    entries.sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating
      if (b.downloads !== a.downloads) return b.downloads - a.downloads
      return a.name.localeCompare(b.name)
    })

    return entries
  }

  private async readManifest(sourceDir: string): Promise<PluginManifest | null> {
    const manifestPath = join(sourceDir, 'manifest.json')
    try {
      const raw = await readFile(manifestPath, 'utf-8')
      return JSON.parse(raw) as PluginManifest
    } catch {
      return null
    }
  }

  private async enforceManifestSecurity(manifest: PluginManifest, sourceDir: string): Promise<void> {
    const requireIntegrity = this.shouldEnforceIntegrity()
    const requireProvenance = this.shouldEnforceProvenance()

    if (!manifest.integrity) {
      if (requireIntegrity) {
        throw new Error('Plugin integrity metadata is required in packaged builds')
      }
    } else {
      if (manifest.integrity.algorithm !== 'sha256') {
        throw new Error('Unsupported integrity algorithm (only sha256 is allowed)')
      }

      const manifestDigest = manifest.integrity.manifestDigest?.trim().toLowerCase()
      const filesDigest = manifest.integrity.filesDigest?.trim().toLowerCase()
      if (!manifestDigest && !filesDigest) {
        throw new Error('Plugin integrity metadata is present but no digest is provided')
      }

      if (manifestDigest) {
        const actualManifestDigest = this.computeManifestDigest(manifest)
        if (actualManifestDigest !== manifestDigest) {
          throw new Error('Plugin manifest digest mismatch')
        }
      }

      if (filesDigest) {
        const actualFilesDigest = await this.computeDirectoryDigest(sourceDir, new Set(['manifest.json']))
        if (actualFilesDigest !== filesDigest) {
          throw new Error('Plugin payload digest mismatch')
        }
      }
    }

    if (!manifest.provenance) {
      if (requireProvenance) {
        throw new Error('Plugin provenance metadata is required in packaged builds')
      }
      return
    }

    if (manifest.provenance.source !== 'local' && manifest.provenance.source !== 'marketplace') {
      throw new Error('Invalid plugin provenance source')
    }

    if (manifest.provenance.repository && !/^https:\/\//i.test(manifest.provenance.repository)) {
      throw new Error('Plugin provenance.repository must be an https URL')
    }

    if (manifest.provenance.commit && !/^[a-f0-9]{7,64}$/i.test(manifest.provenance.commit)) {
      throw new Error('Plugin provenance.commit must be a git SHA')
    }

    if (
      requireProvenance
      && manifest.provenance.source === 'marketplace'
      && (!manifest.provenance.repository || !manifest.provenance.commit)
    ) {
      throw new Error('Marketplace plugins require repository and commit provenance')
    }
  }

  private computeManifestDigest(manifest: PluginManifest): string {
    const digestTarget = JSON.parse(JSON.stringify(manifest)) as PluginManifest

    if (digestTarget.integrity) {
      delete digestTarget.integrity.manifestDigest
      delete digestTarget.integrity.filesDigest
      if (Object.keys(digestTarget.integrity).length === 0) {
        delete digestTarget.integrity
      }
    }

    const stableJson = JSON.stringify(this.sortKeysDeep(digestTarget))
    return this.sha256(stableJson)
  }

  private async computeDirectoryDigest(rootDir: string, exclude: Set<string>): Promise<string> {
    const hash = createHash('sha256')
    const files = await this.collectFiles(rootDir)

    for (const relativePath of files) {
      const normalized = relativePath.replace(/\\/g, '/')
      if (exclude.has(normalized)) continue
      const absolutePath = join(rootDir, relativePath)
      const bytes = await readFile(absolutePath)
      hash.update(normalized)
      hash.update('\0')
      hash.update(bytes)
      hash.update('\0')
    }

    return hash.digest('hex')
  }

  private async collectFiles(rootDir: string, relativeDir = ''): Promise<string[]> {
    const currentDir = relativeDir ? join(rootDir, relativeDir) : rootDir
    const entries = await readdir(currentDir, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name))

    const files: string[] = []
    for (const entry of entries) {
      const relPath = relativeDir ? join(relativeDir, entry.name) : entry.name
      if (entry.isSymbolicLink()) {
        throw new Error(`Plugin contains unsupported symlink: ${relPath.replace(/\\/g, '/')}`)
      }
      if (entry.isDirectory()) {
        files.push(...(await this.collectFiles(rootDir, relPath)))
      } else if (entry.isFile()) {
        files.push(relPath)
      }
    }

    return files
  }

  private async assertNoSymlinks(rootDir: string, relativeDir = ''): Promise<void> {
    const currentDir = relativeDir ? join(rootDir, relativeDir) : rootDir
    const entries = await readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const relPath = relativeDir ? join(relativeDir, entry.name) : entry.name
      if (entry.isSymbolicLink()) {
        throw new Error(`Plugin contains unsupported symlink: ${relPath.replace(/\\/g, '/')}`)
      }
      if (entry.isDirectory()) {
        await this.assertNoSymlinks(rootDir, relPath)
      }
    }
  }

  private sha256(value: string | Buffer): string {
    return createHash('sha256').update(value).digest('hex')
  }

  private sortKeysDeep(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.sortKeysDeep(item))
    }

    if (value && typeof value === 'object') {
      const input = value as Record<string, unknown>
      const out: Record<string, unknown> = {}
      const keys = Object.keys(input).sort((a, b) => a.localeCompare(b))
      for (const key of keys) {
        const next = input[key]
        if (next !== undefined) {
          out[key] = this.sortKeysDeep(next)
        }
      }
      return out
    }

    return value
  }

  private isSubPath(candidatePath: string, rootPath: string): boolean {
    const normalizedRoot = rootPath.endsWith(sep) ? rootPath : `${rootPath}${sep}`
    return candidatePath === rootPath || candidatePath.startsWith(normalizedRoot)
  }

  private async loadRegistry(): Promise<void> {
    try {
      const data = await readFile(this.getRegistryPath(), 'utf-8')
      const plugins = JSON.parse(data) as InstalledPlugin[]
      for (const p of plugins) {
        try {
          await stat(p.path)
          this.installed.set(p.manifest.id, p)
        } catch {
          // Skip missing plugin directories.
        }
      }
    } catch {
      // Fresh start.
    }
  }

  private async saveRegistry(): Promise<void> {
    try {
      const data = JSON.stringify(this.listInstalled(), null, 2)
      await writeFile(this.getRegistryPath(), data, 'utf-8')
    } catch {
      // Keep runtime state even if persistence fails.
    }
  }

  destroy(): void {
    this.installed.clear()
    this.marketplaceSourceById.clear()
  }
}

/** Singleton instance */
export const pluginManager = new PluginManager()
