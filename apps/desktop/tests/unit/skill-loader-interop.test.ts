import { describe, expect, it } from 'vitest'
import { mkdir, rm, writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { loadAllSkills } from '@main/skills/skill-loader'

describe('skill-loader interop parsing', () => {
  it('parses multiline yaml arrays for triggers/tools', async () => {
    const root = join(tmpdir(), `usan-skill-yaml-${Date.now()}`)
    const skillDir = join(root, 'multi-yaml')
    await mkdir(skillDir, { recursive: true })

    const content = `---
name: Multi YAML
triggers:
  - ask weather
  - weather report
tools:
  - web_search
  - browser_open
metadata:
  emoji: "🌤"
  requires:
    bins: ["node"]
---
# Steps
Use weather tools.
`

    await writeFile(join(skillDir, 'SKILL.md'), content, 'utf-8')
    const skills = await loadAllSkills(root)

    expect(skills.length).toBe(1)
    expect(skills[0].meta.triggers).toEqual(['ask weather', 'weather report'])
    expect(skills[0].meta.tools).toEqual(['web_search', 'browser_open'])
    expect(skills[0].meta.metadata.emoji).toBe('🌤')
    expect(skills[0].meta.metadata.requires?.bins).toEqual(['node'])

    await rm(root, { recursive: true, force: true })
  })

  it('maps allowed-tools and read_when fallback for imported skills', async () => {
    const root = join(tmpdir(), `usan-skill-allowed-tools-${Date.now()}`)
    const skillDir = join(root, 'imported')
    await mkdir(skillDir, { recursive: true })

    const content = `---
name: Imported Browser Helper
read_when:
  - User asks to automate browser actions.
  - User asks to run shell automation.
allowed-tools: Read, Write, Bash(playwright-cli:*)
---
# Imported Skill
Follow safe execution.
`

    await writeFile(join(skillDir, 'SKILL.md'), content, 'utf-8')
    const skills = await loadAllSkills(root)

    expect(skills.length).toBe(1)
    expect(skills[0].meta.triggers).toEqual([
      'User asks to automate browser actions.',
      'User asks to run shell automation.',
    ])
    expect(skills[0].meta.tools).toContain('read_file')
    expect(skills[0].meta.tools).toContain('write_file')
    expect(skills[0].meta.tools).toContain('run_command')

    await rm(root, { recursive: true, force: true })
  })
})
