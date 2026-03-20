import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { executeTool, getToolExecutionPolicy } from '../index'

const tempDirs: string[] = []

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(tempDirs.pop()!, { recursive: true, force: true })
  }
})

describe('tool execution policy', () => {
  it('requires approval for shell execution tools', () => {
    expect(getToolExecutionPolicy('bash')).toMatchObject({
      capability: 'shell:execute',
      risk: 'high',
      requiresApproval: true,
    })
    expect(getToolExecutionPolicy('write_file')).toMatchObject({
      capability: 'filesystem:write',
      risk: 'high',
      requiresApproval: true,
    })
  })

  it('keeps read-only tools approval-free', () => {
    expect(getToolExecutionPolicy('read_file')).toMatchObject({
      capability: 'filesystem:read',
      risk: 'low',
      requiresApproval: false,
    })
    expect(getToolExecutionPolicy('web_fetch')).toMatchObject({
      capability: 'network:fetch',
      risk: 'low',
      requiresApproval: false,
    })
  })

  it('writes files through the write_file tool', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'usan-tool-write-'))
    tempDirs.push(tempDir)
    const filePath = join(tempDir, 'output.txt')

    const result = await executeTool('write_file', {
      path: filePath,
      content: 'hello from write_file',
    })

    expect(readFileSync(filePath, 'utf8')).toBe('hello from write_file')
    expect(result).toContain(filePath)
  })
})
