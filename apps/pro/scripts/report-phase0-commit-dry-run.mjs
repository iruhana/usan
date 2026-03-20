import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appRoot = process.cwd()
const repoRoot = resolve(appRoot, '..', '..')
const outputDir = resolve(appRoot, 'output', 'phase0-readiness')
const commitHandoffPath = resolve(outputDir, 'phase0-commit-handoff.json')
const jsonOutputPath = resolve(outputDir, 'phase0-commit-dry-run.json')
const markdownOutputPath = resolve(outputDir, 'phase0-commit-dry-run.md')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function normalizePath(path) {
  return path.replace(/\\/g, '/')
}

function runGit(args) {
  try {
    const stdout = execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
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

function buildMarkdown(report) {
  const lines = [
    '# Phase 0 Commit Dry Run',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Repo root: ${report.repoRoot}`,
    `- Status: ${report.status}`,
    `- Ready to commit: ${report.readyToCommit ? 'yes' : 'no'}`,
    `- Commit command: ${report.commitCommand}`,
    `- Commit message file: ${report.commitMessagePath}`,
    `- Staged entries: ${report.stagedEntries.length}`,
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

  if (report.stagedEntries.length > 0) {
    lines.push('', '## Staged Entries')
    for (const entry of report.stagedEntries) {
      lines.push(`- [${entry.category}] ${entry.path}`)
    }
  }

  if (report.dryRunResult) {
    lines.push('', '## Dry Run Result')
    lines.push(`- Exit status: ${report.dryRunResult.status}`)
    lines.push(`- Command ok: ${report.dryRunResult.ok ? 'yes' : 'no'}`)

    if (report.dryRunResult.stdout.trim()) {
      lines.push('', '```text', report.dryRunResult.stdout.trimEnd(), '```')
    }

    if (report.dryRunResult.stderr.trim()) {
      lines.push('', '```text', report.dryRunResult.stderr.trimEnd(), '```')
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
const commitCommand = commitHandoff.commitCommand ?? `git -C "${repoRoot}" commit -F "${commitMessagePath}"`
const isWithinPublishScope = (path) =>
  publishScopeRoots.some((scopeRoot) => {
    const normalizedScopeRoot = normalizePath(scopeRoot)
    const normalizedPath = normalizePath(path)
    return normalizedPath === normalizedScopeRoot || normalizedPath.startsWith(`${normalizedScopeRoot}/`)
  })

const stagedEntries = parseNameStatus(runGit(['diff', '--cached', '--name-status', '--find-renames']).stdout)
const stagedOutsideScopeEntries = stagedEntries.filter((entry) => !isWithinPublishScope(entry.path))

const report = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  status: 'phase0-commit-not-ready',
  readyToCommit: false,
  commitCommand,
  commitMessagePath,
  stagedEntries,
  stagedOutsideScopeEntries,
  blockers: [],
  nextSteps: [],
  dryRunResult: null,
}

if (!existsSync(commitMessagePath)) {
  report.blockers.push('Commit message file is missing.')
}

if (stagedEntries.length === 0) {
  report.blockers.push('No staged entries exist for the Phase 0 commit.')
}

if (stagedOutsideScopeEntries.length > 0) {
  report.blockers.push('Some staged entries fall outside the standard Phase 0 publish scope.')
  report.nextSteps.push(`Unstage or isolate the outside-scope entries before commit: ${stagedOutsideScopeEntries.map((entry) => entry.path).join(', ')}`)
}

if (report.blockers.length === 0) {
  const dryRunResult = runGit(['commit', '--dry-run', '--no-verify', '-F', commitMessagePath])
  report.dryRunResult = dryRunResult
  report.readyToCommit = dryRunResult.ok
  report.status = dryRunResult.ok ? 'phase0-commit-ready' : 'phase0-commit-not-ready'

  if (!dryRunResult.ok) {
    report.blockers.push('git commit --dry-run failed for the current staged Phase 0 scope.')
  } else {
    report.nextSteps.push('Run the real commit command, then push and observe the remote workflow.')
  }
} else {
  report.nextSteps.push('Stage the standard Phase 0 scope and ensure the commit message file exists before retrying the dry run.')
}

writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`)
writeFileSync(markdownOutputPath, buildMarkdown(report))

console.log(`Phase 0 commit dry run written to ${markdownOutputPath}`)
