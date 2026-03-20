import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appRoot = process.cwd()
const repoRoot = resolve(appRoot, '..', '..')
const outputDir = resolve(appRoot, 'output', 'phase0-readiness')
const closeoutPath = resolve(outputDir, 'phase0-closeout.json')
const commitHandoffPath = resolve(outputDir, 'phase0-commit-handoff.json')
const jsonOutputPath = resolve(outputDir, 'phase0-publish-status.json')
const markdownOutputPath = resolve(outputDir, 'phase0-publish-status.md')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function normalizePath(path) {
  return path.replace(/\\/g, '/')
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
    '# Phase 0 Publish Status',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Repo root: ${report.repoRoot}`,
    `- Branch: ${report.branchName}`,
    `- Status: ${report.status}`,
    `- Ready to commit: ${report.readyToCommit ? 'yes' : 'no'}`,
    `- Staged scoped entries: ${report.stagedScopedEntries.length}`,
    `- Unstaged scoped entries: ${report.unstagedScopedEntries.length}`,
    `- Untracked scoped entries: ${report.untrackedScopedEntries.length}`,
    `- Staged outside-scope entries: ${report.stagedOutsideScopeEntries.length}`,
  ]

  if (report.stageCommand) {
    lines.push('', '## Stage Command', `- ${report.stageCommand}`)
  }

  if (report.commitCommand) {
    lines.push('', '## Commit Command', `- ${report.commitCommand}`)
  }

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

  if (report.stagedScopedEntries.length > 0) {
    lines.push('', '## Staged Scoped Entries')
    for (const entry of report.stagedScopedEntries) {
      lines.push(`- [${entry.category}] ${entry.path}`)
    }
  }

  if (report.unstagedScopedEntries.length > 0) {
    lines.push('', '## Unstaged Scoped Entries')
    for (const entry of report.unstagedScopedEntries) {
      lines.push(`- [${entry.category}] ${entry.path}`)
    }
  }

  if (report.untrackedScopedEntries.length > 0) {
    lines.push('', '## Untracked Scoped Entries')
    for (const entry of report.untrackedScopedEntries) {
      lines.push(`- [${entry.category}] ${entry.path}`)
    }
  }

  if (report.stagedOutsideScopeEntries.length > 0) {
    lines.push('', '## Staged Outside Scope Entries')
    for (const entry of report.stagedOutsideScopeEntries) {
      lines.push(`- [${entry.category}] ${entry.path}`)
    }
  }

  return `${lines.join('\n')}\n`
}

mkdirSync(outputDir, { recursive: true })

if (!existsSync(closeoutPath)) {
  throw new Error('Missing phase0-closeout.json. Run `npm run phase0:closeout` first.')
}

if (!existsSync(commitHandoffPath)) {
  throw new Error('Missing phase0-commit-handoff.json. Run `npm run phase0:commit-handoff` first.')
}

const closeout = readJson(closeoutPath)
const commitHandoff = readJson(commitHandoffPath)
const publishScopeRoots = commitHandoff.publishScopeRoots ?? ['ISSUES.md', '.github/workflows/pro-quality.yml', 'apps/pro']

const isWithinPublishScope = (path) => {
  const normalizedPath = normalizePath(path)
  return publishScopeRoots.some((scopeRoot) => {
    const normalizedScopeRoot = normalizePath(scopeRoot)
    return normalizedPath === normalizedScopeRoot || normalizedPath.startsWith(`${normalizedScopeRoot}/`)
  })
}

const stagedAllEntries = parseNameStatus(runGit(['diff', '--cached', '--name-status', '--find-renames']))
const stagedScopedEntries = stagedAllEntries.filter((entry) => isWithinPublishScope(entry.path))
const stagedOutsideScopeEntries = stagedAllEntries.filter((entry) => !isWithinPublishScope(entry.path))

const unstagedScopedEntries = parseNameStatus(
  runGit(['diff', '--name-status', '--find-renames', '--', ...publishScopeRoots]),
).filter((entry) => isWithinPublishScope(entry.path))

const porcelainEntries = parsePorcelain(runGit(['status', '--porcelain', '--branch']))
const untrackedScopedEntries = porcelainEntries
  .filter((entry) => entry.category === 'untracked' && isWithinPublishScope(entry.path))

const report = {
  generatedAt: new Date().toISOString(),
  repoRoot,
  branchName: closeout.gitSummary?.branchName ?? 'main',
  status: 'phase0-publish-ready',
  readyToCommit: true,
  publishScopeRoots,
  stageCommand: commitHandoff.stageCommand ?? null,
  commitCommand: commitHandoff.commitCommand ?? null,
  stagedScopedEntries,
  unstagedScopedEntries,
  untrackedScopedEntries,
  stagedOutsideScopeEntries,
  blockers: [],
  nextSteps: [],
}

if (stagedScopedEntries.length === 0) {
  report.status = 'phase0-publish-not-ready'
  report.readyToCommit = false
  report.blockers.push('No staged Phase 0 publish-scope entries were found.')
  report.nextSteps.push(`Run the stage command first: ${report.stageCommand ?? `git -C ${quote(repoRoot)} add -- ${publishScopeRoots.map(quote).join(' ')}`}`)
}

if (unstagedScopedEntries.length > 0) {
  report.status = 'phase0-publish-not-ready'
  report.readyToCommit = false
  report.blockers.push('Some Phase 0 publish-scope entries are still unstaged.')
  report.nextSteps.push(`Stage or revert the remaining scoped changes before commit: ${unstagedScopedEntries.map((entry) => entry.path).join(', ')}`)
}

if (untrackedScopedEntries.length > 0) {
  report.status = 'phase0-publish-not-ready'
  report.readyToCommit = false
  report.blockers.push('Some Phase 0 publish-scope entries are still untracked.')
  report.nextSteps.push(`Add the untracked scoped files before commit: ${untrackedScopedEntries.map((entry) => entry.path).join(', ')}`)
}

if (stagedOutsideScopeEntries.length > 0) {
  report.status = 'phase0-publish-not-ready'
  report.readyToCommit = false
  report.blockers.push('Staged entries exist outside the standard Phase 0 publish scope.')
  report.nextSteps.push(`Unstage or isolate the outside-scope staged files before commit: ${stagedOutsideScopeEntries.map((entry) => entry.path).join(', ')}`)
}

if (report.status === 'phase0-publish-ready') {
  report.nextSteps.push('Commit the staged Phase 0 scope, push the branch, then run the CI observe command.')
}

writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`)
writeFileSync(markdownOutputPath, buildMarkdown(report))

console.log(`Phase 0 publish status written to ${markdownOutputPath}`)
