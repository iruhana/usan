import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { fileURLToPath } from 'node:url'

const appRoot = process.cwd()
const repoRoot = resolve(appRoot, '..', '..')
const outputDir = resolve(appRoot, 'output', 'phase0-readiness')
const commitHandoffPath = resolve(outputDir, 'phase0-commit-handoff.json')
const publishStatusPath = resolve(outputDir, 'phase0-publish-status.json')
const jsonOutputPath = resolve(outputDir, 'phase0-stage-scope.json')
const markdownOutputPath = resolve(outputDir, 'phase0-stage-scope.md')
const publishStatusScriptPath = fileURLToPath(new URL('./report-phase0-publish-status.mjs', import.meta.url))

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function quote(value) {
  return `"${value}"`
}

function runGit(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
  }).trim()
}

function parseNameStatus(output) {
  if (!output) {
    return []
  }

  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [statusToken, ...rest] = line.split('\t')
      const path = rest.at(-1) ?? ''
      const statusCode = statusToken[0] ?? '?'
      let category = 'modified'

      if (statusCode === 'A') {
        category = 'added'
      } else if (statusCode === 'D') {
        category = 'deleted'
      } else if (statusCode === 'R') {
        category = 'renamed'
      }

      return {
        statusCode,
        category,
        path: path.replace(/\\/g, '/'),
      }
    })
}

function buildMarkdown(report) {
  const lines = [
    '# Phase 0 Stage Scope',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Repo root: ${report.repoRoot}`,
    `- App root: ${report.appRoot}`,
    `- Mode: ${report.mode}`,
    `- Applied: ${report.applied ? 'yes' : 'no'}`,
    `- Stage command: ${report.stageCommand}`,
    `- Staged scope entries after run: ${report.stagedScopeEntries.length}`,
    `- Publish status: ${report.publishStatus?.status ?? 'unknown'}`,
    `- Publish ready: ${report.publishStatus?.readyToCommit ? 'yes' : 'no'}`,
  ]

  if (report.notes.length > 0) {
    lines.push('', '## Notes')
    for (const note of report.notes) {
      lines.push(`- ${note}`)
    }
  }

  if (report.nextSteps.length > 0) {
    lines.push('', '## Next Steps')
    for (const nextStep of report.nextSteps) {
      lines.push(`- ${nextStep}`)
    }
  }

  if (report.stagedScopeEntries.length > 0) {
    lines.push('', '## Staged Scope Entries')
    for (const entry of report.stagedScopeEntries) {
      lines.push(`- [${entry.category}] ${entry.path}`)
    }
  }

  lines.push('', '## Evidence')
  lines.push(`- ${publishStatusPath}`)

  return `${lines.join('\n')}\n`
}

mkdirSync(outputDir, { recursive: true })

if (!existsSync(commitHandoffPath)) {
  throw new Error('Missing phase0-commit-handoff.json. Run `npm run phase0:commit-handoff` first.')
}

const { values } = parseArgs({
  options: {
    apply: {
      type: 'boolean',
      default: false,
    },
  },
})

const commitHandoff = readJson(commitHandoffPath)
const publishScopeRoots = commitHandoff.publishScopeRoots ?? ['ISSUES.md', '.github/workflows/pro-quality.yml', 'apps/pro']
const stageCommand = commitHandoff.stageCommand
  ?? `git -C ${quote(repoRoot)} add -- ${publishScopeRoots.map(quote).join(' ')}`

if (values.apply) {
  execFileSync('git', ['add', '--', ...publishScopeRoots], {
    cwd: repoRoot,
    stdio: 'pipe',
  })
}

execFileSync(process.execPath, [publishStatusScriptPath], {
  cwd: appRoot,
  stdio: 'pipe',
  encoding: 'utf8',
})

const publishStatus = existsSync(publishStatusPath) ? readJson(publishStatusPath) : null
const stagedScopeEntries = parseNameStatus(
  runGit(['diff', '--cached', '--name-status', '--find-renames', '--', ...publishScopeRoots]),
)

const report = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  appRoot,
  mode: values.apply ? 'apply' : 'dry-run',
  applied: values.apply,
  publishScopeRoots,
  stageCommand,
  stagedScopeEntries,
  publishStatus,
  notes: [],
  nextSteps: [],
}

if (!values.apply) {
  report.notes.push('Dry-run only. No git index changes were made.')
  report.nextSteps.push(`Run ${quote(`npm run phase0:stage-scope -- --apply`)} to stage the standard Phase 0 scope.`)
} else {
  report.notes.push('Applied the standard Phase 0 stage command and refreshed publish-status evidence.')
}

if (publishStatus?.readyToCommit) {
  report.nextSteps.push('Review phase0-publish-status.md, then create the Phase 0 closeout commit.')
} else {
  report.nextSteps.push('Review phase0-publish-status.md and resolve the remaining blockers before commit.')
}

writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`)
writeFileSync(markdownOutputPath, buildMarkdown(report))

console.log(`Phase 0 stage scope written to ${markdownOutputPath}`)
