import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const appRoot = process.cwd()
const repo = 'iruhana/usan'
const workflowPath = '.github/workflows/pro-quality.yml'
const outputDir = resolve(appRoot, 'output', 'phase0-readiness')
const jsonOutputPath = resolve(outputDir, 'phase0-ci-status.json')
const markdownOutputPath = resolve(outputDir, 'phase0-ci-status.md')
const latestDownloadPath = resolve(outputDir, 'ci-artifacts', 'latest-download.json')
const compareReportPath = resolve(outputDir, 'phase0-ci-compare.json')
const observedRunPath = resolve(outputDir, 'phase0-ci-observed-run.json')
const requiredArtifactNames = ['pro-electron-smoke', 'pro-phase0-readiness']
const fixturePath = process.env.PHASE0_CI_STATUS_FIXTURE
  ? resolve(process.env.PHASE0_CI_STATUS_FIXTURE)
  : null

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readFixture() {
  if (!fixturePath || !existsSync(fixturePath)) {
    return null
  }

  return readJson(fixturePath)
}

function getArgValue(flagName) {
  const index = process.argv.indexOf(flagName)
  if (index === -1 || index === process.argv.length - 1) {
    return null
  }

  return process.argv[index + 1]
}

function getCurrentBranch() {
  return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: resolve(appRoot, '..', '..'),
    encoding: 'utf8',
  }).trim()
}

function runGh(args) {
  const fixture = readFixture()
  if (fixture) {
    if (args[0] === 'auth' && args[1] === 'status') {
      return fixture.authOk === false
        ? { ok: false, stdout: '', stderr: 'fixture auth failed', status: 1 }
        : { ok: true, stdout: '' }
    }

    return {
      ok: false,
      stdout: '',
      stderr: `unsupported fixture command: ${args.join(' ')}`,
      status: 1,
    }
  }

  try {
    const stdout = execFileSync('gh', args, {
      cwd: appRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    return { ok: true, stdout }
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout?.toString?.() ?? '',
      stderr: error.stderr?.toString?.() ?? error.message,
      status: error.status ?? null,
    }
  }
}

function runGhJson(args) {
  const fixture = readFixture()
  if (fixture) {
    if (args[0] === 'api' && args[1] === `repos/${repo}/actions/workflows`) {
      return {
        ok: true,
        data: fixture.workflows ?? { workflows: fixture.workflow ? [fixture.workflow] : [] },
      }
    }

    if (args[0] === 'run' && args[1] === 'list') {
      return { ok: true, data: fixture.runs ?? [] }
    }

    if (args[0] === 'run' && args[1] === 'view') {
      return {
        ok: true,
        data: fixture.runViews?.[args[2]] ?? { jobs: [] },
      }
    }

    const artifactsMatch = args[0] === 'api'
      ? args[1].match(/^repos\/iruhana\/usan\/actions\/runs\/(\d+)\/artifacts$/)
      : null

    if (artifactsMatch) {
      return {
        ok: true,
        data: fixture.artifacts?.[artifactsMatch[1]] ?? { artifacts: [] },
      }
    }

    const runMatch = args[0] === 'api'
      ? args[1].match(/^repos\/iruhana\/usan\/actions\/runs\/(\d+)$/)
      : null

    if (runMatch) {
      const runRecord = fixture.runsById?.[runMatch[1]]
      return runRecord
        ? { ok: true, data: runRecord }
        : { ok: false, stderr: `missing fixture run ${runMatch[1]}`, stdout: '', status: 1 }
    }

    return {
      ok: false,
      stderr: `unsupported fixture command: ${args.join(' ')}`,
      stdout: '',
      status: 1,
    }
  }

  const result = runGh(args)
  if (!result.ok) {
    return result
  }

  try {
    return { ok: true, data: JSON.parse(result.stdout) }
  } catch (error) {
    return {
      ok: false,
      stderr: `failed to parse gh output: ${error.message}`,
      stdout: result.stdout,
      status: null,
    }
  }
}

function addBlocker(blockers, message) {
  if (!blockers.includes(message)) {
    blockers.push(message)
  }
}

function buildMarkdown(report) {
  const lines = [
    '# Phase 0 CI Status',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Repo: ${report.repo}`,
    `- Workflow path: ${report.workflowPath}`,
    `- Target branch: ${report.targetBranch}`,
    `- Local workflow exists: ${report.localWorkflowExists ? 'yes' : 'no'}`,
    `- Remote workflow exists: ${report.remoteWorkflowExists ? 'yes' : 'no'}`,
    `- Ready for live Phase 0 confirmation: ${report.ready ? 'yes' : 'no'}`,
    '',
    '## Summary',
    `- Status: ${report.status}`,
  ]

  if (report.remoteWorkflow) {
    lines.push(`- Remote workflow: ${report.remoteWorkflow.name} (#${report.remoteWorkflow.id})`)
    lines.push(`- Remote workflow state: ${report.remoteWorkflow.state}`)
  }

  if (report.latestRun) {
    lines.push(`- Latest run on target branch: #${report.latestRun.databaseId} (${report.latestRun.event})`)
    lines.push(`- Latest run status: ${report.latestRun.status}`)
    lines.push(`- Latest run conclusion: ${report.latestRun.conclusion ?? 'pending'}`)
    lines.push(`- Latest run branch: ${report.latestRun.headBranch}`)
    lines.push(`- Latest run SHA: ${report.latestRun.headSha}`)
    lines.push(`- Latest run URL: ${report.latestRun.url}`)
  }

  if (report.observedRun) {
    lines.push('', '## Observed Run')
    lines.push(`- Run id: ${report.observedRun.runId}`)
    lines.push(`- Branch: ${report.observedRun.branchName}`)
    lines.push(`- Observed at: ${report.observedRun.observedAt}`)
    lines.push(`- Status: ${report.observedRun.status}`)
    lines.push(`- Conclusion: ${report.observedRun.conclusion ?? 'pending'}`)
    lines.push(`- URL: ${report.observedRun.runUrl}`)
    lines.push(`- Artifact directory: ${report.observedRun.artifactDir}`)
    lines.push(`- Matches target branch: ${report.observedRun.matchesTargetBranch ? 'yes' : 'no'}`)
  }

  if (report.artifacts.length > 0) {
    lines.push('', '## Artifacts')
    for (const artifact of report.artifacts) {
      lines.push(`- ${artifact.name}: ${artifact.expired ? 'expired' : 'available'}`)
    }
  }

  if (report.latestDownload) {
    lines.push('', '## Downloaded Artifacts')
    lines.push(`- Run id: ${report.latestDownload.runId}`)
    lines.push(`- Downloaded at: ${report.latestDownload.downloadedAt}`)
    lines.push(`- Directory: ${report.latestDownload.artifactDir}`)
    lines.push(`- Matches latest run: ${report.latestDownload.matchesLatestRun ? 'yes' : 'no'}`)
    lines.push(`- Matches target branch: ${report.latestDownload.matchesTargetBranch ? 'yes' : 'no'}`)
    for (const artifactName of report.latestDownload.artifactNames) {
      lines.push(
        `- ${artifactName}: ${report.latestDownload.presentArtifacts.includes(artifactName) ? 'downloaded' : 'missing'}`,
      )
    }
  }

  if (report.compareReport) {
    lines.push('', '## Compare Report')
    lines.push(`- Result: ${report.compareReport.status.toUpperCase()}`)
    lines.push(`- Checks: ${report.compareReport.passedChecks}/${report.compareReport.totalChecks}`)
  }

  if (report.jobs.length > 0) {
    lines.push('', '## Jobs')
    for (const job of report.jobs) {
      lines.push(`- ${job.name}: ${job.status} / ${job.conclusion ?? 'pending'}`)
    }
  }

  if (report.notes.length > 0) {
    lines.push('', '## Notes')
    for (const note of report.notes) {
      lines.push(`- ${note}`)
    }
  }

  if (report.blockers.length > 0) {
    lines.push('', '## Blockers')
    for (const blocker of report.blockers) {
      lines.push(`- ${blocker}`)
    }
  }

  return `${lines.join('\n')}\n`
}

mkdirSync(outputDir, { recursive: true })

const report = {
  generatedAt: new Date().toISOString(),
  repo,
  workflowPath,
  targetBranch: getArgValue('--ref') ?? getCurrentBranch(),
  localWorkflowExists: existsSync(resolve(appRoot, '..', '..', workflowPath)),
  remoteWorkflowExists: false,
  remoteWorkflow: null,
  latestRun: null,
  observedRun: null,
  artifacts: [],
  latestDownload: null,
  compareReport: null,
  jobs: [],
  notes: [],
  blockers: [],
  ready: false,
  status: 'unknown',
}

if (existsSync(latestDownloadPath)) {
  const latestDownload = readJson(latestDownloadPath)
  report.latestDownload = {
    ...latestDownload,
    presentArtifacts: Array.isArray(latestDownload.artifactNames)
      ? latestDownload.artifactNames.filter((artifactName) =>
        existsSync(resolve(latestDownload.artifactDir, artifactName)),
      )
      : [],
    matchesLatestRun: false,
    matchesTargetBranch: latestDownload.branchName === report.targetBranch,
  }
}

if (existsSync(compareReportPath)) {
  const compareReport = readJson(compareReportPath)
  report.compareReport = {
    passed: Boolean(compareReport.passed),
    passedChecks: compareReport.passedChecks ?? 0,
    totalChecks: compareReport.totalChecks ?? 0,
    status: compareReport.passed ? 'pass' : 'fail',
  }
}

if (existsSync(observedRunPath)) {
  const observedRun = readJson(observedRunPath)
  report.observedRun = {
    ...observedRun,
    matchesTargetBranch: observedRun.branchName === report.targetBranch,
    presentArtifacts: Array.isArray(observedRun.artifactNames)
      ? observedRun.artifactNames.filter((artifactName) =>
        existsSync(resolve(observedRun.artifactDir, artifactName)),
      )
      : [],
  }
}

const authStatus = runGh(['auth', 'status'])
if (!authStatus.ok) {
  report.status = 'gh-auth-missing'
  addBlocker(report.blockers, 'GitHub CLI is not authenticated for github.com.')
} else {
  const workflowsResult = runGhJson(['api', `repos/${repo}/actions/workflows`])

  if (!workflowsResult.ok) {
    report.status = 'workflow-query-failed'
    addBlocker(report.blockers, workflowsResult.stderr ?? 'failed to query workflows')
  } else {
    const remoteWorkflow = workflowsResult.data.workflows.find((workflow) => workflow.path === workflowPath)

    if (!remoteWorkflow) {
      report.status = 'remote-workflow-missing'
      addBlocker(
        report.blockers,
        `Remote repo does not yet contain ${workflowPath}. Push the current branch before observing a live Phase 0 run.`,
      )
    } else {
      report.remoteWorkflowExists = true
      report.remoteWorkflow = {
        id: remoteWorkflow.id,
        name: remoteWorkflow.name,
        state: remoteWorkflow.state,
        htmlUrl: remoteWorkflow.html_url,
      }

      const runsResult = runGhJson([
        'run',
        'list',
        '-R',
        repo,
        '-w',
        String(remoteWorkflow.id),
        '-b',
        report.targetBranch,
        '-L',
        '1',
        '--json',
        'databaseId,name,displayTitle,status,conclusion,event,headBranch,headSha,createdAt,updatedAt,url',
      ])

      if (!runsResult.ok) {
        report.status = 'run-query-failed'
        addBlocker(report.blockers, runsResult.stderr ?? 'failed to query workflow runs')
      } else if (runsResult.data.length === 0) {
        report.status = 'no-remote-runs-for-branch'
        addBlocker(
          report.blockers,
          `Remote workflow exists but no runs have been observed for branch ${report.targetBranch} yet.`,
        )
      } else {
        const latestRun = runsResult.data[0]
        report.latestRun = latestRun

        const runDetailResult = runGhJson([
          'run',
          'view',
          String(latestRun.databaseId),
          '-R',
          repo,
          '--json',
          'jobs,status,conclusion,createdAt,updatedAt,startedAt,url,workflowName',
        ])

        if (runDetailResult.ok) {
          report.jobs = Array.isArray(runDetailResult.data.jobs)
            ? runDetailResult.data.jobs.map((job) => ({
              name: job.name,
              status: job.status,
              conclusion: job.conclusion,
            }))
            : []
        }

        const artifactsResult = runGhJson([
          'api',
          `repos/${repo}/actions/runs/${latestRun.databaseId}/artifacts`,
        ])

        if (artifactsResult.ok) {
          report.artifacts = Array.isArray(artifactsResult.data.artifacts)
            ? artifactsResult.data.artifacts.map((artifact) => ({
              name: artifact.name,
              expired: Boolean(artifact.expired),
            }))
            : []
        }

        const artifactNames = new Set(report.artifacts.map((artifact) => artifact.name))
        const hasObservedRun = Boolean(report.observedRun)
        for (const artifactName of requiredArtifactNames) {
          if (!artifactNames.has(artifactName)) {
            const message = `Latest run is missing expected artifact: ${artifactName}`
            if (hasObservedRun) {
              report.notes.push(message)
            } else {
              addBlocker(report.blockers, message)
            }
          }
        }

        if (latestRun.conclusion !== 'success') {
          const message = `Latest run conclusion is ${latestRun.conclusion ?? latestRun.status}, not success.`
          if (hasObservedRun) {
            report.notes.push(message)
          } else {
            addBlocker(report.blockers, message)
          }
        }

        if (report.latestDownload) {
          report.latestDownload.matchesLatestRun = report.latestDownload.runId === latestRun.databaseId

          if (!report.latestDownload.matchesTargetBranch) {
            addBlocker(
              report.blockers,
              `Latest downloaded artifacts are for branch ${report.latestDownload.branchName}, not target branch ${report.targetBranch}.`,
            )
          }

          if (!hasObservedRun) {
            if (!report.latestDownload.matchesLatestRun) {
              addBlocker(
                report.blockers,
                `Latest downloaded artifacts are for run ${report.latestDownload.runId}, not latest run ${latestRun.databaseId}.`,
              )
            }

            for (const artifactName of requiredArtifactNames) {
              if (!report.latestDownload.presentArtifacts.includes(artifactName)) {
                addBlocker(report.blockers, `Downloaded artifact directory is missing: ${artifactName}`)
              }
            }
          }
        }

        const observedRunStatus = report.observedRun
          ? runGhJson(['api', `repos/${repo}/actions/runs/${report.observedRun.runId}`])
          : null

        if (report.observedRun) {
          if (!report.observedRun.matchesTargetBranch) {
            addBlocker(
              report.blockers,
              `Observed run ${report.observedRun.runId} is for branch ${report.observedRun.branchName}, not target branch ${report.targetBranch}.`,
            )
          }

          if (!observedRunStatus?.ok) {
            addBlocker(
              report.blockers,
              `Failed to query observed run ${report.observedRun.runId} from GitHub.`,
            )
          } else {
            report.observedRun.status = observedRunStatus.data.status
            report.observedRun.conclusion = observedRunStatus.data.conclusion
            report.observedRun.runUrl = observedRunStatus.data.html_url
            report.observedRun.headSha = observedRunStatus.data.head_sha

            if (observedRunStatus.data.status !== 'completed' || observedRunStatus.data.conclusion !== 'success') {
              addBlocker(
                report.blockers,
                `Observed run ${report.observedRun.runId} is ${observedRunStatus.data.status}/${observedRunStatus.data.conclusion ?? 'pending'}, not completed/success.`,
              )
            }
          }

          for (const artifactName of requiredArtifactNames) {
            if (!report.observedRun.presentArtifacts.includes(artifactName)) {
              addBlocker(report.blockers, `Observed artifact directory is missing: ${artifactName}`)
            }
          }

          if (!report.compareReport?.passed) {
            addBlocker(report.blockers, 'Downloaded remote artifacts do not match the local Phase 0 evidence bundle.')
          }

          if (report.latestRun.databaseId !== report.observedRun.runId) {
            report.notes.push(
              `Latest run on ${report.targetBranch} is ${report.latestRun.databaseId}, but Phase 0 is currently anchored to observed run ${report.observedRun.runId}.`,
            )
          }
        } else {
          addBlocker(
            report.blockers,
            `No observed run receipt exists for branch ${report.targetBranch}. Run \`npm run phase0:ci-observe -- --ref ${report.targetBranch}\` after pushing.`,
          )
        }

        report.status = report.blockers.length === 0 ? 'observed-run-confirmed' : 'observation-pending'
      }
    }
  }
}

if (report.compareReport && (!report.observedRun || !report.remoteWorkflowExists || !report.latestRun)) {
  report.compareReport.status = 'pending'
}

report.ready = report.status === 'observed-run-confirmed'

writeFileSync(jsonOutputPath, `${JSON.stringify(report, null, 2)}\n`)
writeFileSync(markdownOutputPath, buildMarkdown(report))

console.log(
  `Phase 0 CI status: ${report.status} (${report.ready ? 'ready' : 'not ready'}) -> ${markdownOutputPath}`,
)
