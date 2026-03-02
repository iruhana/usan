import { writeFile } from 'node:fs/promises'
import { loadAllSkills } from '../src/main/skills/skill-loader.ts'

import { readFileSync } from 'node:fs'

const OPENCLAW_ROOT = 'C:/Users/admin/Downloads/openclaw/Skill'
const TOOL_CATALOG_PATH = 'C:/Users/admin/Projects/usan/apps/desktop/src/main/ai/tool-catalog.ts'
const REPORT_DIR = 'C:/Users/admin/Downloads/openclaw/_skill_test'

function extractKnownTools() {
  const text = readFileSync(TOOL_CATALOG_PATH, 'utf-8')
  return new Set(Array.from(text.matchAll(/name:\s*'([^']+)'/g), (m) => m[1]))
}

function normalizeTrigger(v) {
  return String(v || '').toLowerCase().replace(/\s+/g, ' ').trim()
}

function analyze(skills, knownTools) {
  const idMap = new Map()
  const triggerMap = new Map()
  let noToolsCount = 0
  const unknownTools = []

  for (const skill of skills) {
    const id = skill.meta.id
    const list = idMap.get(id) || []
    list.push(skill.filePath)
    idMap.set(id, list)

    if (!Array.isArray(skill.meta.tools) || skill.meta.tools.length === 0) noToolsCount++

    for (const tool of skill.meta.tools || []) {
      if (!knownTools.has(tool)) unknownTools.push({ id: skill.meta.id, tool, path: skill.filePath })
    }

    for (const trigger of skill.meta.triggers || []) {
      const key = normalizeTrigger(trigger)
      if (!key) continue
      const triggerIds = triggerMap.get(key) || new Set()
      triggerIds.add(skill.meta.id)
      triggerMap.set(key, triggerIds)
    }
  }

  const duplicateIds = Array.from(idMap.entries()).filter(([, paths]) => paths.length > 1)
  const ambiguousTriggers = Array.from(triggerMap.entries()).filter(([, ids]) => ids.size > 1)

  const unknownTopMap = new Map()
  for (const item of unknownTools) unknownTopMap.set(item.tool, (unknownTopMap.get(item.tool) || 0) + 1)
  const unknownToolTop = Array.from(unknownTopMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 20)

  return {
    total_skills: skills.length,
    no_tools_count: noToolsCount,
    duplicate_id_count: duplicateIds.length,
    ambiguous_trigger_count: ambiguousTriggers.length,
    unknown_tool_refs_count: unknownTools.length,
    unknown_tool_top: unknownToolTop,
    duplicate_id_examples: Object.fromEntries(duplicateIds.slice(0, 15).map(([id, paths]) => [id, paths.slice(0, 3)])),
    ambiguous_trigger_examples: Object.fromEntries(ambiguousTriggers.slice(0, 15).map(([trigger, ids]) => [trigger, Array.from(ids)])),
  }
}

const knownTools = extractKnownTools()
const all = await loadAllSkills(OPENCLAW_ROOT)
const canonical = all.filter((s) => !s.filePath.toLowerCase().includes('\\_organized_by_skill\\'))

const report = {
  generated_at: new Date().toISOString(),
  parser: 'usan-skill-loader.ts',
  file_counts: {
    all: all.length,
    canonical: canonical.length,
  },
  scopes: {
    all: analyze(all, knownTools),
    canonical: analyze(canonical, knownTools),
  },
}

const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-')
const jsonPath = `${REPORT_DIR}/usan_openclaw_skill_loader_audit_${ts}.json`
const mdPath = `${REPORT_DIR}/usan_openclaw_skill_loader_audit_${ts}.md`

await writeFile(jsonPath, JSON.stringify(report, null, 2), 'utf-8')

const md = [
  '# Usan Skill Loader Audit (OpenClaw)',
  '',
  `- Generated: ${report.generated_at}`,
  `- Parser: ${report.parser}`,
  `- all: ${report.file_counts.all}, canonical: ${report.file_counts.canonical}`,
  '',
  '## All',
  `- no_tools_count: ${report.scopes.all.no_tools_count}`,
  `- duplicate_id_count: ${report.scopes.all.duplicate_id_count}`,
  `- ambiguous_trigger_count: ${report.scopes.all.ambiguous_trigger_count}`,
  `- unknown_tool_refs_count: ${report.scopes.all.unknown_tool_refs_count}`,
  '',
  '## Canonical',
  `- no_tools_count: ${report.scopes.canonical.no_tools_count}`,
  `- duplicate_id_count: ${report.scopes.canonical.duplicate_id_count}`,
  `- ambiguous_trigger_count: ${report.scopes.canonical.ambiguous_trigger_count}`,
  `- unknown_tool_refs_count: ${report.scopes.canonical.unknown_tool_refs_count}`,
  '',
].join('\n')

await writeFile(mdPath, md, 'utf-8')

console.log(JSON.stringify({ jsonPath, mdPath, report }, null, 2))
