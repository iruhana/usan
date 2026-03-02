#!/usr/bin/env node

import { promises as fs } from 'fs'
import path from 'path'

function parseArgs(argv) {
  const args = {
    root: process.env.USAN_USER_SKILLS_DIR || path.join(process.env.APPDATA || '', 'usan', 'skills'),
    dryRun: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--root' && argv[i + 1]) {
      args.root = argv[i + 1]
      i++
    } else if (arg === '--dry-run') {
      args.dryRun = true
    }
  }
  return args
}

function hasFrontmatter(content) {
  return /^---\r?\n[\s\S]*?\r?\n---\r?\n/.test(content)
}

function toSlug(input) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'imported-skill'
}

function toDisplayName(folderName) {
  return folderName
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Imported Skill'
}

function yamlEscape(value) {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function walkSkillFiles(dir) {
  const found = []
  const entries = await fs.readdir(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      const skillPath = path.join(fullPath, 'SKILL.md')
      try {
        const stat = await fs.stat(skillPath)
        if (stat.isFile()) found.push(skillPath)
        continue
      } catch {
        // recurse
      }
      found.push(...await walkSkillFiles(fullPath))
    }
  }
  return found
}

async function main() {
  const { root, dryRun } = parseArgs(process.argv.slice(2))
  const absRoot = path.resolve(root)

  const stat = await fs.stat(absRoot).catch(() => null)
  if (!stat || !stat.isDirectory()) {
    console.error(`skills root not found: ${absRoot}`)
    process.exit(1)
  }

  const skillFiles = await walkSkillFiles(absRoot)
  let patched = 0
  let skipped = 0

  for (const filePath of skillFiles) {
    const raw = await fs.readFile(filePath, 'utf8')
    if (hasFrontmatter(raw)) {
      skipped++
      continue
    }

    const folderName = path.basename(path.dirname(filePath))
    const id = toSlug(folderName)
    const name = toDisplayName(folderName)
    const frontmatter = [
      '---',
      `id: "${yamlEscape(id)}"`,
      `name: "${yamlEscape(name)}"`,
      `description: "Imported OpenClaw skill (${yamlEscape(folderName)})"`,
      `triggers: ["${yamlEscape(name)}"]`,
      'category: "imported"',
      '---',
      '',
    ].join('\n')

    const patchedContent = `${frontmatter}${raw.replace(/^\uFEFF/, '').trimStart()}`
    if (!dryRun) {
      await fs.writeFile(filePath, patchedContent, 'utf8')
    }
    patched++
    console.log(`${dryRun ? 'would patch' : 'patched'}: ${filePath}`)
  }

  console.log(`done. scanned=${skillFiles.length} patched=${patched} skipped=${skipped} dryRun=${dryRun}`)
}

main().catch((err) => {
  console.error(err?.message || err)
  process.exit(1)
})

