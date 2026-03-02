import { describe, expect, it } from 'vitest'
import { mkdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { loadAllSkills } from '@main/skills/skill-loader'

describe('skill import interop e2e flow', () => {
  it('imports legacy openclaw format and normalizes to usan-compatible metadata', async () => {
    const root = join(tmpdir(), `usan-e2e-import-${Date.now()}`)
    const imported = join(root, 'legacy-import')
    await mkdir(imported, { recursive: true })

    const content = `---
name: OpenClaw Browser Helper
read_when:
  - User asks browser automation.
allowed-tools: Read, Write, Bash(playwright-cli:*)
metadata:
  openclaw:
    emoji: "🧩"
---
# Procedure
Run safe browser helper steps.
`

    await writeFile(join(imported, 'SKILL.md'), content, 'utf-8')
    const skills = await loadAllSkills(root)

    expect(skills.length).toBe(1)
    expect(skills[0].meta.name).toBe('Usan Browser Helper')
    expect(skills[0].meta.triggers).toEqual(['User asks browser automation.'])
    expect(skills[0].meta.tools).toContain('run_command')
    expect(skills[0].meta.tools).toContain('read_file')
    expect(skills[0].meta.tools).toContain('write_file')
    expect(skills[0].meta.metadata.emoji).toBe('🧩')

    await rm(root, { recursive: true, force: true })
  })
})
