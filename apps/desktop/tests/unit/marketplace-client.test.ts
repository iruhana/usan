import { createServer } from 'http'
import AdmZip from 'adm-zip'
import { createHash } from 'crypto'
import { mkdtempSync, mkdirSync, writeFileSync } from 'fs'
import { readFile, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const electronState = vi.hoisted(() => ({
  appPath: '',
  tempPath: '',
  userDataPath: '',
}))

const pluginManagerMock = vi.hoisted(() => ({
  getPlugin: vi.fn(() => null),
  install: vi.fn(),
  installFromMarketplace: vi.fn(),
  searchMarketplace: vi.fn(),
  uninstall: vi.fn(),
}))

vi.mock('electron', () => ({
  app: {
    getAppPath: () => electronState.appPath,
    getPath: (name: string) => {
      if (name === 'userData') return electronState.userDataPath
      if (name === 'temp') return electronState.tempPath
      return electronState.userDataPath
    },
    isPackaged: false,
  },
}))

vi.mock('../../src/main/infrastructure/plugin-manager', () => ({
  pluginManager: pluginManagerMock,
}))

import { MarketplaceClient } from '../../src/main/marketplace/marketplace-client'

function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex')
}

describe('marketplace-client remote archives', () => {
  let workspaceRoot: string
  let catalogPath: string
  let archiveBytes: Buffer
  let archiveHash: string
  let server: ReturnType<typeof createServer> | null
  let archiveUrl: string

  beforeEach(async () => {
    vi.clearAllMocks()

    workspaceRoot = mkdtempSync(join(tmpdir(), 'usan-marketplace-client-'))
    electronState.userDataPath = join(workspaceRoot, 'user-data')
    electronState.appPath = join(workspaceRoot, 'app')
    electronState.tempPath = join(workspaceRoot, 'temp')
    mkdirSync(electronState.userDataPath, { recursive: true })
    mkdirSync(electronState.appPath, { recursive: true })
    mkdirSync(electronState.tempPath, { recursive: true })

    const zip = new AdmZip()
    zip.addFile('remote-helper/manifest.json', Buffer.from(JSON.stringify({
      id: 'remote-helper',
      name: 'Remote Helper',
      version: '1.0.0',
      description: 'Remote plugin bundle.',
      author: 'Usan',
      skills: ['automation'],
      mcpServers: [
        {
          id: 'bridge',
          name: 'Remote Bridge',
          transport: 'sse',
          url: 'https://example.com/mcp',
          autoConnect: false,
        },
      ],
    }, null, 2), 'utf8'))
    zip.addFile('remote-helper/readme.txt', Buffer.from('remote bundle', 'utf8'))
    archiveBytes = zip.toBuffer()
    archiveHash = sha256(archiveBytes)

    server = createServer((request, response) => {
      if (request.url === '/plugin.zip') {
        response.writeHead(200, { 'Content-Type': 'application/zip' })
        response.end(archiveBytes)
        return
      }

      response.writeHead(404)
      response.end('not found')
    })

    await new Promise<void>((resolve) => {
      server?.listen(0, '127.0.0.1', resolve)
    })
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Test server did not bind to a TCP port')
    }
    archiveUrl = `http://127.0.0.1:${address.port}/plugin.zip`

    catalogPath = join(workspaceRoot, 'catalog.json')
    process.env['USAN_MARKETPLACE_CATALOG_PATHS'] = catalogPath
    delete process.env['USAN_MARKETPLACE_CATALOG_URLS']

    pluginManagerMock.searchMarketplace.mockResolvedValue([])
    pluginManagerMock.install.mockImplementation(async (sourcePath: string) => {
      const manifest = JSON.parse(await readFile(join(sourcePath, 'manifest.json'), 'utf8')) as {
        id: string
        name: string
        version: string
        description: string
        author: string
        skills: string[]
      }
      return {
        manifest,
        path: sourcePath,
        enabled: true,
        installedAt: 1742342400000,
      }
    })
  })

  afterEach(async () => {
    delete process.env['USAN_MARKETPLACE_CATALOG_PATHS']
    delete process.env['USAN_MARKETPLACE_CATALOG_URLS']
    await new Promise<void>((resolve, reject) => {
      if (!server) {
        resolve()
        return
      }
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }
        resolve()
      })
    })
    await rm(workspaceRoot, { recursive: true, force: true })
  })

  it('downloads remote plugin archives from the marketplace catalog and installs the extracted bundle', async () => {
    writeFileSync(catalogPath, JSON.stringify({
      plugins: [
        {
          id: 'remote-helper',
          name: 'Remote Helper',
          version: '1.0.0',
          description: 'Remote plugin bundle.',
          author: 'Usan',
          tags: ['automation'],
          source: archiveUrl,
          sourceSha256: archiveHash,
          mcpServerCount: 1,
        },
      ],
    }, null, 2), 'utf8')

    const client = new MarketplaceClient()

    const entries = await client.search('remote')
    expect(entries).toHaveLength(1)
    expect(entries[0]?.mcpServerCount).toBe(1)

    const installed = await client.install('remote-helper')
    expect(pluginManagerMock.install).toHaveBeenCalledTimes(1)
    expect(installed.manifest.id).toBe('remote-helper')
    expect(pluginManagerMock.install.mock.calls[0]?.[0]).toContain('usan-marketplace-')
  })

  it('rejects remote archives whose checksum does not match the catalog metadata', async () => {
    writeFileSync(catalogPath, JSON.stringify({
      plugins: [
        {
          id: 'remote-helper',
          name: 'Remote Helper',
          version: '1.0.0',
          description: 'Remote plugin bundle.',
          author: 'Usan',
          tags: ['automation'],
          source: archiveUrl,
          sourceSha256: 'deadbeef',
        },
      ],
    }, null, 2), 'utf8')

    const client = new MarketplaceClient()

    await expect(client.install('remote-helper')).rejects.toThrow('checksum mismatch')
    expect(pluginManagerMock.install).not.toHaveBeenCalled()
  })
})
