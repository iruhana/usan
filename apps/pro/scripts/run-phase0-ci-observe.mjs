import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = process.cwd()
const scriptDir = dirname(fileURLToPath(import.meta.url))
const repo = 'iruhana/usan'
const workflowPath = '.github/workflows/pro-quality.yml'
const downloadRoot = resolve(appRoot, 'output', 'phase0-readiness', 'ci-artifacts')
const latestDownloadPath = resolve(downloadRoot, 'latest-download.json')
const observedRunPath = resolve(appRoot, 'output', 'phase0-readiness', 'phase0-ci-observed-run.json')
const requiredArtifactNames = ['pro-electron-smoke', 'pro-phase0-readiness']
const nodeCommand = process.execPath
const fixturePath = process.env.PHASE0_CI_OBSERVE_FIXTURE
  ? resolve(process.env.PHASE0_CI_OBSERVE_FIXTURE)
  : null
let latestRunsCallCount = 0

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: appRoot,
    stdio: options.stdio ?? 'pipe',
    encoding: options.encoding ?? 'utf8',
    shell: false,
    env: options.env ?? process.env,
  })
}

function readFixture() {
  if (!fixturePath || !existsSync(fixturePath)) {
    return null
  }

  return JSON.parse(readFileSync(fixturePath, 'utf8'))
}

function runJson(command, args) {
  const fixture = readFixture()
  if (fixture) {
    if (command === 'gh' && args[0] === 'api' && args[1] === `repos/${repo}/actions/workflows`) {
      return fixture.workflows ?? { workflows: [] }
    }

    if (command === 'gh' && args[0] === 'run' && args[1] === 'list') {
      const queuedRuns = fixture.latestRunsQueue?.[latestRunsCallCount] ?? fixture.runs ?? []
      latestRunsCallCount += 1
      return queuedRuns
    }

    if (command === 'gh' && args[0] === 'api') {
      const runMatch = args[1].match(/^repos\/iruhana\/usan\/actions\/runs\/(\d+)$/)
      if (runMatch) {
        const runRecord = fixture.runsById?.[runMatch[1]]
        if (!runRecord) {
          throw new Error(`missing fixture run ${runMatch[1]}`)
        }

        return runRecord
      }
    }
  }

  const result = run(command, args)
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `${command} ${args.join(' ')} failed`)
  }

  return JSON.parse(result.stdout)
}

function getArgValue(flagName) {
  const index = process.argv.indexOf(flagName)
  if (index === -1 || index === process.argv.length - 1) {
    return null
  }

  return process.argv[index + 1]
}

function ensureGhAuth() {
  const fixture = readFixture()
  if (fixture) {
    if (fixture.authOk === false) {
      throw new Error('GitHub CLI is not authenticated. Run `gh auth login` first.')
    }

    return
  }

  const result = run('gh', ['auth', 'status'])
  if (result.status !== 0) {
    throw new Error('GitHub CLI is not authenticated. Run `gh auth login` first.')
  }
}

function getCurrentBranch() {
  return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: appRoot,
    encoding: 'utf8',
  }).trim()
}

function remoteBranchExists(branchName) {
  const fixture = readFixture()
  if (fixture) {
    return Array.isArray(fixture.remoteBranches) && fixture.remoteBranches.includes(branchName)
  }

  const result = run('git', ['ls-remote', '--heads', 'origin', branchName])
  return result.status === 0 && result.stdout.trim().length > 0
}

function getWorkflow() {
  const fixture = readFixture()
  if (fixture) {
    const workflow = fixture.workflow ?? null
    return workflow && workflow.path === workflowPath ? workflow : null
  }

  const response = runJson('gh', ['api', `repos/${repo}/actions/workflows`])
  return response.workflows.find((workflow) => workflow.path === workflowPath) ?? null
}

function getLatestRun(workflowId, branchName) {
  const runs = runJson('gh', [
    'run',
    'list',
    '-R',
    repo,
    '-w',
    String(workflowId),
    '-b',
    branchName,
    '-L',
    '1',
    '--json',
    'databaseId,status,conclusion,headBranch,headSha,createdAt,updatedAt,url',
  ])

  return runs[0] ?? null
}

function getRunById(runId) {
  const run = runJson('gh', ['api', `repos/${repo}/actions/runs/${runId}`])

  return {
    databaseId: run.id,
    status: run.status,
    conclusion: run.conclusion,
    headBranch: run.head_branch,
    headSha: run.head_sha,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    url: run.html_url,
    event: run.event,
    workflowId: run.workflow_id,
  }
}

function dispatchWorkflow(branchName) {
  const fixture = readFixture()
  if (fixture) {
    if (fixture.dispatchOk === false) {
      throw new Error(`Failed to dispatch ${workflowPath} on ${branchName}.`)
    }

    return
  }

  const result = run(
    'gh',
    ['workflow', 'run', workflowPath, '--repo', repo, '--ref', branchName],
    { stdio: 'inherit', encoding: 'utf8' },
  )

  if (result.status !== 0) {
    throw new Error(`Failed to dispatch ${workflowPath} on ${branchName}.`)
  }
}

function waitForNewRun(workflowId, branchName, previousRunId) {
  const startedAt = Date.now()
  const timeoutMs = 120000

  while (Date.now() - startedAt < timeoutMs) {
    const latestRun = getLatestRun(workflowId, branchName)
    if (latestRun && latestRun.databaseId !== previousRunId) {
      return latestRun
    }

    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000)
  }

  throw new Error('Timed out waiting for the dispatched workflow run to appear.')
}

function watchRun(runId) {
  const fixture = readFixture()
  if (fixture) {
    if (fixture.watchFailures?.includes?.(Number(runId)) || fixture.watchFailures?.includes?.(String(runId))) {
      throw new Error(`Workflow run ${runId} did not finish successfully.`)
    }

    return
  }

  const result = run(
    'gh',
    ['run', 'watch', String(runId), '--repo', repo, '--compact', '--exit-status', '--interval', '5'],
    { stdio: 'inherit', encoding: 'utf8' },
  )

  if (result.status !== 0) {
    throw new Error(`Workflow run ${runId} did not finish successfully.`)
  }
}

function downloadArtifacts(runRecord, branchName) {
  const targetDir = resolve(downloadRoot, `run-${runRecord.databaseId}`)
  mkdirSync(targetDir, { recursive: true })

  const fixture = readFixture()
  if (fixture) {
    const artifactFixture = fixture.downloads?.[String(runRecord.databaseId)] ?? fixture.downloads?.[runRecord.databaseId]
    if (!artifactFixture) {
      throw new Error(`Missing fixture download payload for workflow run ${runRecord.databaseId}.`)
    }

    const readinessDir = resolve(targetDir, 'pro-phase0-readiness')
    const smokeDir = resolve(targetDir, 'pro-electron-smoke')
    mkdirSync(readinessDir, { recursive: true })
    mkdirSync(smokeDir, { recursive: true })

    if (artifactFixture.phase0Readiness) {
      writeFileSync(
        resolve(readinessDir, 'phase0-readiness.json'),
        `${JSON.stringify(artifactFixture.phase0Readiness, null, 2)}\n`,
      )
    }

    if (artifactFixture.verifyStrictReceipt) {
      writeFileSync(
        resolve(readinessDir, 'verify-strict-receipt.json'),
        `${JSON.stringify(artifactFixture.verifyStrictReceipt, null, 2)}\n`,
      )
    }

    if (artifactFixture.shellVisualManifest) {
      writeFileSync(
        resolve(smokeDir, 'shell-visual-manifest.json'),
        `${JSON.stringify(artifactFixture.shellVisualManifest, null, 2)}\n`,
      )
    }

    for (const [relativePath, fileContent] of Object.entries(artifactFixture.files ?? {})) {
      const absolutePath = resolve(targetDir, relativePath)
      mkdirSync(dirname(absolutePath), { recursive: true })
      writeFileSync(absolutePath, fileContent)
    }

    writeFileSync(
      latestDownloadPath,
      `${JSON.stringify({
        runId: runRecord.databaseId,
        branchName,
        runUrl: runRecord.url,
        downloadedAt: new Date().toISOString(),
        artifactDir: targetDir,
        artifactNames: requiredArtifactNames,
      }, null, 2)}\n`,
    )

    return targetDir
  }

  const args = [
    'run',
    'download',
    String(runRecord.databaseId),
    '--repo',
    repo,
    '--dir',
    targetDir,
  ]

  for (const artifactName of requiredArtifactNames) {
    args.push('--name', artifactName)
  }

  const result = run('gh', args, { stdio: 'inherit', encoding: 'utf8' })
  if (result.status !== 0) {
    throw new Error(`Failed to download artifacts for workflow run ${runRecord.databaseId}.`)
  }

  writeFileSync(
    latestDownloadPath,
    `${JSON.stringify({
      runId: runRecord.databaseId,
      branchName,
      runUrl: runRecord.url,
      downloadedAt: new Date().toISOString(),
      artifactDir: targetDir,
      artifactNames: requiredArtifactNames,
    }, null, 2)}\n`,
  )

  return targetDir
}

function refreshCiStatus(branchName) {
  const result = run(
    nodeCommand,
    [resolve(scriptDir, 'report-phase0-ci-status.mjs'), '--ref', branchName],
    {
      stdio: 'inherit',
      encoding: 'utf8',
      env: fixturePath
        ? { ...process.env, PHASE0_CI_STATUS_FIXTURE: fixturePath }
        : process.env,
    },
  )

  if (result.status !== 0) {
    throw new Error('Failed to refresh the Phase 0 CI status report.')
  }
}

function runCiCompare() {
  const result = run(
    nodeCommand,
    [resolve(scriptDir, 'report-phase0-ci-compare.mjs')],
    { stdio: 'inherit', encoding: 'utf8' },
  )

  if (result.status !== 0) {
    throw new Error('Downloaded CI artifacts do not match the local Phase 0 evidence bundle.')
  }
}

function writeObservedRunReceipt(runRecord, branchName, artifactDir) {
  writeFileSync(
    observedRunPath,
    `${JSON.stringify({
      observedAt: new Date().toISOString(),
      repo,
      workflowPath,
      workflowId: runRecord.workflowId ?? null,
      branchName,
      runId: runRecord.databaseId,
      runUrl: runRecord.url,
      status: runRecord.status,
      conclusion: runRecord.conclusion,
      headSha: runRecord.headSha,
      event: runRecord.event,
      artifactDir,
      artifactNames: requiredArtifactNames,
    }, null, 2)}\n`,
  )
}

try {
  ensureGhAuth()

  const branchName = getArgValue('--ref') ?? getCurrentBranch()
  const explicitRunId = getArgValue('--run-id')
  if (!remoteBranchExists(branchName)) {
    throw new Error(
      `Remote branch origin/${branchName} does not exist yet. Push the branch before dispatching the workflow.`,
    )
  }

  const workflow = getWorkflow()
  if (!workflow) {
    throw new Error(
      `Remote repo does not yet contain ${workflowPath}. Push the current branch before observing the Phase 0 workflow.`,
    )
  }

  let runRecord
  if (explicitRunId) {
    runRecord = getRunById(explicitRunId)

    if (runRecord.workflowId !== workflow.id) {
      throw new Error(
        `Run ${explicitRunId} belongs to workflow ${runRecord.workflowId}, not ${workflowPath}.`,
      )
    }

    if (runRecord.headBranch !== branchName) {
      throw new Error(
        `Run ${explicitRunId} is for branch ${runRecord.headBranch}, not target branch ${branchName}.`,
      )
    }

    console.log(`Reusing workflow run #${runRecord.databaseId}: ${runRecord.url}`)
  } else {
    const previousRun = getLatestRun(workflow.id, branchName)
    console.log(`Dispatching ${workflowPath} on ${branchName} in ${repo}...`)
    dispatchWorkflow(branchName)
    runRecord = waitForNewRun(workflow.id, branchName, previousRun?.databaseId ?? null)
  }

  if (runRecord.status !== 'completed' || runRecord.conclusion !== 'success') {
    console.log(`Watching workflow run #${runRecord.databaseId}: ${runRecord.url}`)
    watchRun(runRecord.databaseId)
    runRecord = getRunById(runRecord.databaseId)
  }

  if (runRecord.status !== 'completed' || runRecord.conclusion !== 'success') {
    throw new Error(`Workflow run ${runRecord.databaseId} finished as ${runRecord.status}/${runRecord.conclusion ?? 'pending'}.`)
  }

  const artifactDir = downloadArtifacts(runRecord, branchName)
  writeObservedRunReceipt(runRecord, branchName, artifactDir)
  runCiCompare()
  refreshCiStatus(branchName)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
