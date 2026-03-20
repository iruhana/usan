import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const appRoot = process.cwd()
const repoRoot = resolve(appRoot, '..', '..')
const outputDir = resolve(appRoot, 'output', 'phase0-readiness')
const commitHandoffPath = resolve(outputDir, 'phase0-commit-handoff.json')
const jsonOutputPath = resolve(outputDir, 'phase0-simulate-publish.json')
const markdownOutputPath = resolve(outputDir, 'phase0-simulate-publish.md')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function normalizePath(path) {
  return path.replace(/\\/g, '/')
}

function runGit(args, env = process.env) {
  try {
    const stdout = execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    return {
      ok: true,
      stdout,
      stderr: '',
      status: 0,
    }
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout?.toString?.() ?? '',
      stderr: error.stderr?.toString?.() ?? error.message,
      status: error.status ?? 1,
    }
  }
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
        path: normalizePath(path),
      }
    })
}

function parsePorcelain(output) {
  if (!output) {
    return []
  }

  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      if (line.startsWith('## ')) {
        return []
      }

      if (line.startsWith('?? ')) {
        return [{
          code: '??',
          category: 'untracked',
          path: normalizePath(line.slice(3)),
        }]
      }

      const code = line.slice(0, 2)
      const rawPath = line.slice(3)
      const path = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1) : rawPath
      let category = 'modified'

      if (code.includes('D')) {
        category = 'deleted'
      } else if (code.includes('R')) {
        category = 'renamed'
      } else if (code.includes('A')) {
        category = 'added'
      }

      return [{
        code,
        category,
        path: normalizePath(path),
      }]
    })
}

function buildMarkdown(report) {
  const lines = [
    '# Phase 0 Simulate Publish',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Repo root: ${report.repoRoot}`,
    `- Status: ${report.status}`,
    `- Simulated ready: ${report.simulatedReady ? 'yes' : 'no'}`,
    `- Simulation mode: ${report.simulationMode}`,
    `- Real staged outside-scope entries: ${report.realStagedOutsideScopeEntries.length}`,
    `- Real scoped worktree entries: ${report.realScopedWorktreeEntries.length}`,
    `- Simulated staged entries: ${report.simulatedStagedEntries.length}`,
    `- Commit message file: ${report.commitMessagePath}`,
    '',
    '## Notes',
    '- This simulation uses a temporary git index and does not mutate the real index.',
  ]

  if (report.blockers.length > 0) {
    lines.push('', '## Blockers')
    for (const blocker of report.blockers) {
      lines.push(`- ${blocker}`)
    }
  }

  if (report.nextSteps.length > 0) {
    lines.push('', '## Next Steps')
    for (const nextStep of report.nextSteps) {
      lines.push(`- ${nextStep}`)
    }
  }

  if (report.realStagedOutsideScopeEntries.length > 0) {
    lines.push('', '## Real Staged Outside Scope Entries')
    for (const entry of report.realStagedOutsideScopeEntries) {
      lines.push(`- [${entry.category}] ${entry.path}`)
    }
  }

  if (report.realScopedWorktreeEntries.length > 0) {
    lines.push('', '## Real Scoped Worktree Entries')
    for (const entry of report.realScopedWorktreeEntries) {
      lines.push(`- [${entry.category}] ${entry.path}`)
    }
  }

  if (report.simulatedStagedEntries.length > 0) {
    lines.push('', '## Simulated Staged Entries')
    for (const entry of report.simulatedStagedEntries) {
      lines.push(`- [${entry.category}] ${entry.path}`)
    }
  }

  if (report.simulatedCommitDryRun) {
    lines.push('', '## Simulated Commit Dry Run')
    lines.push(`- Exit status: ${report.simulatedCommitDryRun.status}`)
    lines.push(`- Command ok: ${report.simulatedCommitDryRun.ok ? 'yes' : 'no'}`)

    if (report.simulatedCommitDryRun.stdout.trim()) {
      lines.push('', '```text', report.simulatedCommitDryRun.stdout.trimEnd(), '```')
    }

    if (report.simulatedCommitDryRun.stderr.trim()) {
      lines.push('', '```text', report.simulatedCommitDryRun.stderr.trimEnd(), '```')
    }
  }

  return `${lines.join('\n')}\n`
}

mkdirSync(outputDir, { recursive: true })

if (!existsSync(commitHandoffPath)) {
  throw new Error('Missing phase0-commit-handoff.json. Run `npm run phase0:commit-handoff` first.')
}

const commitHandoff = readJson(commitHandoffPath)
const publishScopeRoots = commitHandoff.publishScopeRoots ?? ['ISSUES.md', '.github/workflows/pro-quality.yml', 'apps/pro']
const commitMessagePath = commitHandoff.commitMessagePath ?? resolve(outputDir, 'phase0-commit-message.txt')

if (!existsSync(commitMessagePath)) {
  throw new Error('Missing phase0-commit-message.txt. Run `npm run phase0:commit-handoff` first.')
}

const isWithinPublishScope = (path) =>
  publishScopeRoots.some((scopeRoot) => {
    const normalizedScopeRoot = normalizePath(scopeRoot)
    const normalizedPath = normalizePath(path)
    return normalizedPath === normalizedScopeRoot || normalizedPath.startsWith(`${normalizedScopeRoot}/`)
  })

const realStagedEntries = parseNameStatus(runGit(['diff', '--cached', '--name-status', '--find-renames']).stdout)
const realStagedOutsideScopeEntries = realStagedEntries.filter((entry) => !isWithinPublishScope(entry.path))
const realScopedWorktreeEntries = parsePorcelain(
  runGit(['status', '--porcelain', '--', ...publishScopeRoots]).stdout,
).filter((entry) => isWithinPublishScope(entry.path))

const tempDir = mkdtempSync(join(tmpdir(), 'usan-pro-phase0-sim-'))
const tempIndexPath = join(tempDir, 'index')
const tempEnv = {
  ...process.env,
  GIT_INDEX_FILE: tempIndexPath,
}

let simulatedStagedEntries = []
let simulatedCommitDryRun = null

try {
  const readTree = runGit(['read-tree', 'HEAD'], tempEnv)
  if (!readTree.ok) {
    throw new Error(readTree.stderr || 'git read-tree HEAD failed')
  }

  const addResult = runGit(['add', '--', ...publishScopeRoots], tempEnv)
  if (!addResult.ok) {
    throw new Error(addResult.stderr || 'git add failed in temporary index')
  }

  simulatedStagedEntries = parseNameStatus(
    runGit(['diff', '--cached', '--name-status', '--find-renames'], tempEnv).stdout,
  )

  simulatedCommitDryRun = runGit(['commit', '--dry-run', '--no-verify', '-F', commitMessagePath], tempEnv)
} finally {
  rmSync(tempDir, { recursive: true, force: true })
}

const report = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  status: 'phase0-simulate-publish-ready',
  simulatedReady: Boolean(simulatedCommitDryRun?.ok),
  simulationMode: 'staged-scope',
  publishScopeRoots,
  commitMessagePath,
  realStagedOutsideScopeEntries,
  realScopedWorktreeEntries,
  simulatedStagedEntries,
  simulatedCommitDryRun,
  blockers: [],
  nextSteps: [],
}

const cleanTreeNoOp = realScopedWorktreeEntries.length === 0 && simulatedStagedEntries.length === 0

if (realStagedOutsideScopeEntries.length > 0) {
  report.status = 'phase0-simulate-publish-blocked'
  report.blockers.push('Real staged entries outside the Phase 0 publish scope already exist.')
  report.nextSteps.push(`Unstage or isolate the outside-scope staged files before following the push handoff: ${realStagedOutsideScopeEntries.map((entry) => entry.path).join(', ')}`)
}

if (realStagedOutsideScopeEntries.length === 0 && cleanTreeNoOp) {
  report.status = 'phase0-simulate-publish-clean-tree'
  report.simulatedReady = true
  report.simulationMode = 'clean-tree-noop'
  report.nextSteps.push('No local Phase 0 publish-scope changes are pending. You can move directly to remote observation or rerun the publish flow only after new scope changes appear.')
}

if (report.status === 'phase0-simulate-publish-ready' && !simulatedCommitDryRun?.ok) {
  report.status = 'phase0-simulate-publish-blocked'
  report.blockers.push('Temporary-index commit dry run did not succeed for the standard Phase 0 scope.')
}

if (report.status === 'phase0-simulate-publish-ready' && simulatedStagedEntries.length === 0) {
  report.status = 'phase0-simulate-publish-blocked'
  report.blockers.push('Simulation staged no entries for the standard Phase 0 scope.')
}

if (report.status === 'phase0-simulate-publish-ready') {
  report.nextSteps.push('The simulated publish path is clean. Follow the real push handoff when ready.')
}

writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`)
writeFileSync(markdownOutputPath, buildMarkdown(report))

console.log(`Phase 0 simulate publish written to ${markdownOutputPath}`)
