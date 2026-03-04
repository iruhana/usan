/**
 * System tools: web_search, run_command, skills, reminders, TTS, secure_delete, temp, startup
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { dirname, join, resolve as resolvePath } from 'path'
import { realpath } from 'fs/promises'
import { validatePath, validateCommand } from '../../security'
import { loadAllSkillsMultiSource, getEligibleSkills } from '../../skills/skill-loader'
import { reminderManager } from '../../reminders/reminder-manager'
import { speakText } from '../../tts/edge-tts'
import { secureDelete } from '../../fs/secure-delete'
import { scanTempFiles, cleanTempFiles } from '../../system/temp-cleaner'
import { listStartupPrograms, toggleStartupProgram } from '../../system/startup-manager'
import type { StartupSource } from '../../system/startup-manager'

const execFileAsync = promisify(execFile)
const MAX_BODY = 512 * 1024

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try { return await fn() } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      const isTransient = code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'EAI_AGAIN'
      if (!isTransient || i === retries) throw err
    }
  }
  throw new Error('재시도 횟수를 초과했습니다')
}

export const definitions: ProviderTool[] = [
  {
    name: 'run_command',
    description: '터미널 명령어를 실행합니다. 프로그램 실행, 시스템 정보 확인 등에 사용합니다.',
    parameters: {
      type: 'object',
      properties: {
        command: { type: 'string', description: '실행할 명령어' },
        cwd: { type: 'string', description: '작업 디렉토리 (선택)' },
      },
      required: ['command'],
    },
  },
  {
    name: 'web_search',
    description: '웹에서 정보를 검색합니다.',
    parameters: {
      type: 'object',
      properties: { query: { type: 'string', description: '검색어' } },
      required: ['query'],
    },
  },
  {
    name: 'list_skills',
    description: '사용 가능한 스킬(능력) 목록을 보여줍니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'set_reminder',
    description: '지정한 시간 후에 알림을 보냅니다. 최대 48시간.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '알림 메시지' },
        delay_minutes: { type: 'number', description: '몇 분 후에 알릴지 (예: 30)' },
      },
      required: ['text', 'delay_minutes'],
    },
  },
  {
    name: 'list_reminders',
    description: '설정된 알림 목록을 보여줍니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'cancel_reminder',
    description: '설정된 알림을 취소합니다.',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string', description: '취소할 알림 ID' } },
      required: ['id'],
    },
  },
  {
    name: 'run_skill_script',
    description: '스킬 디렉토리 내의 스크립트를 실행합니다.',
    parameters: {
      type: 'object',
      properties: {
        skill_id: { type: 'string', description: '스킬 ID' },
        script_name: { type: 'string', description: '스크립트 파일명 (예: read_window.ps1)' },
        args: { type: 'string', description: '스크립트에 전달할 인자 (선택)' },
      },
      required: ['skill_id', 'script_name'],
    },
  },
  {
    name: 'speak_text',
    description: '텍스트를 자연스러운 음성으로 읽어줍니다. 한국어, 영어, 일본어 지원.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to read aloud' },
        voice: { type: 'string', description: '음성 이름 (선택, 기본: 자동 감지)' },
        rate: { type: 'string', description: '속도 (선택, 기본: -20%, 예: +0%, -30%)' },
      },
      required: ['text'],
    },
  },
  {
    name: 'secure_delete',
    description: '파일을 복구할 수 없도록 3-pass 덮어쓰기 후 삭제합니다. 반드시 사용자 확인 후 실행하세요.',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string', description: '안전 삭제할 파일 경로' } },
      required: ['path'],
    },
  },
  {
    name: 'clean_temp_files',
    description: '7일 이상 된 임시 파일(.tmp/.log/.bak 등)을 삭제하여 디스크 공간을 확보합니다. scan_only=true로 미리보기 가능.',
    parameters: {
      type: 'object',
      properties: { scan_only: { type: 'boolean', description: '스캔만 할지 여부 (true면 삭제하지 않음, 기본: false)' } },
    },
  },
  {
    name: 'list_startup_programs',
    description: '윈도우 시작 시 자동으로 실행되는 프로그램 목록을 보여줍니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'toggle_startup_program',
    description: '시작 프로그램을 활성화 또는 비활성화합니다. 시스템 보호 프로그램은 변경할 수 없습니다.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '프로그램 이름' },
        source: { type: 'string', enum: ['hkcu', 'startup-folder'], description: '소스 (hkcu 또는 startup-folder)' },
        enabled: { type: 'boolean', description: '활성화 여부' },
      },
      required: ['name', 'source', 'enabled'],
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async run_command(args) {
    const command = args.command as string
    if (typeof command !== 'string' || !command.trim()) return { error: '명령어를 입력해주세요' }
    const blocked = validateCommand(command)
    if (blocked) return { error: blocked }
    const rawCwd = args.cwd as string | undefined
    const home = process.env.HOME || process.env.USERPROFILE || ''
    const tempDir = process.env.TEMP || process.env.TMP || ''
    if (rawCwd) {
      const cwdBlocked = validatePath(rawCwd, 'read')
      if (cwdBlocked) return { error: `cwd blocked: ${cwdBlocked}` }
      const resolved = resolvePath(rawCwd).toLowerCase()
      const inHome = home && resolved.startsWith(resolvePath(home).toLowerCase())
      const inTemp = tempDir && resolved.startsWith(resolvePath(tempDir).toLowerCase())
      if (!inHome && !inTemp) {
        return { error: '작업 디렉토리는 사용자 홈 또는 임시 폴더 내에서만 지정할 수 있습니다' }
      }
    }
    const cwd = rawCwd || home
    try {
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
      const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command]
      const { stdout, stderr } = await execFileAsync(shell, shellArgs, {
        cwd: cwd || undefined, timeout: 30000, maxBuffer: 10 * 1024 * 1024, windowsHide: true,
      })
      return { stdout, stderr, exitCode: 0 }
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; code?: number }
      return { stdout: e.stdout || '', stderr: e.stderr || '', exitCode: e.code || 1 }
    }
  },

  async web_search(args) {
    const query = encodeURIComponent(args.query as string)
    return withRetry(async () => {
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
        headers: { 'User-Agent': 'Usan/0.1' },
        signal: AbortSignal.timeout(10000),
      })
      const reader = res.body?.getReader()
      if (!reader) return { query: args.query, results: [] }
      let html = ''
      const decoder = new TextDecoder()
      while (html.length < MAX_BODY) {
        const { done, value } = await reader.read()
        if (done) break
        html += decoder.decode(value, { stream: true })
      }
      await reader.cancel().catch(() => {})
      const matches = html.match(/<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/g) ?? []
      const results: Array<{ title: string; url: string }> = []
      for (const m of matches) {
        if (results.length >= 5) break
        const hrefMatch = m.match(/href="([^"]*)"/)
        const textMatch = m.match(/>([^<]+)<\/a>/)
        const href = hrefMatch?.[1] || ''
        const title = textMatch?.[1]?.trim() || ''
        const urlMatch = href.match(/uddg=([^&]+)/)
        const realUrl = urlMatch ? decodeURIComponent(urlMatch[1]) : href
        try {
          const parsed = new URL(realUrl)
          if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') continue
        } catch { continue }
        results.push({ title, url: realUrl })
      }
      return { query: args.query, results }
    })
  },

  async list_skills() {
    const all = await loadAllSkillsMultiSource()
    const eligible = getEligibleSkills(all)
    return {
      skills: eligible.map((s) => ({
        id: s.meta.id, name: s.meta.name, description: s.meta.description,
        triggers: s.meta.triggers, emoji: s.meta.metadata.emoji,
      })),
      count: eligible.length,
    }
  },

  async set_reminder(args) {
    const text = args.text as string
    const delayMinutes = args.delay_minutes as number
    if (!text) return { error: '알림 메시지를 입력해주세요' }
    if (typeof delayMinutes !== 'number') return { error: '시간(분)을 숫자로 입력해주세요' }
    return reminderManager.set(text, delayMinutes)
  },

  async list_reminders() {
    return reminderManager.list()
  },

  async cancel_reminder(args) {
    const id = args.id as string
    if (!id) return { error: '알림 ID를 입력해주세요' }
    return reminderManager.cancel(id)
  },

  async run_skill_script(args) {
    const skillId = args.skill_id as string
    const scriptName = args.script_name as string
    const scriptArgs = (args.args as string) || ''
    if (!skillId || !scriptName) return { error: '스킬 ID와 스크립트 이름을 입력해주세요' }
    if (scriptName.includes('..') || scriptName.includes('/') || scriptName.includes('\\')) {
      return { error: '스크립트 이름에 경로 문자를 사용할 수 없습니다' }
    }
    const ext = scriptName.split('.').pop()?.toLowerCase()
    if (!ext || !['py', 'ps1', 'js'].includes(ext)) {
      return { error: '.py, .ps1, .js 파일만 실행할 수 있습니다' }
    }
    if (scriptArgs.length > 2000) return { error: '스크립트 인자가 너무 깁니다 (최대 2000자)' }
    if (/[;|&`$><{}()\[\]!%\n\r]/.test(scriptArgs)) {
      return { error: '스크립트 인자에 특수문자를 사용할 수 없습니다' }
    }
    const all = await loadAllSkillsMultiSource()
    const skill = all.find((s) => s.meta.id === skillId)
    if (!skill) return { error: `스킬 '${skillId}'을 찾을 수 없습니다` }
    const skillDir = dirname(skill.filePath)
    const scriptPath = join(skillDir, 'scripts', scriptName)
    let resolvedScript: string
    try { resolvedScript = await realpath(scriptPath) } catch { return { error: `스크립트 '${scriptName}'을 찾을 수 없습니다` } }
    let resolvedScriptsDir: string
    try { resolvedScriptsDir = await realpath(join(skillDir, 'scripts')) } catch { return { error: '스킬 scripts 디렉토리를 찾을 수 없습니다' } }
    if (!resolvedScript.startsWith(resolvedScriptsDir)) return { error: '스크립트가 스킬 디렉토리 밖에 있습니다' }
    const splitArgs = scriptArgs.split(/\s+/).filter(Boolean)
    const runners: Record<string, [string, string[]]> = {
      py: ['python', [scriptPath, ...splitArgs]],
      ps1: ['powershell', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...splitArgs]],
      js: ['node', [scriptPath, ...splitArgs]],
    }
    const [cmd, cmdArgs] = runners[ext]
    try {
      const { stdout, stderr } = await execFileAsync(cmd, cmdArgs, {
        cwd: skillDir, timeout: 30000, maxBuffer: 1 * 1024 * 1024, windowsHide: true,
      })
      return { stdout, stderr, exitCode: 0 }
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; code?: number }
      return { stdout: e.stdout || '', stderr: e.stderr || '', exitCode: e.code || 1 }
    }
  },

  async speak_text(args) {
    const text = args.text as string
    if (!text) return { error: '읽을 텍스트를 입력해주세요' }
    return speakText(text, args.voice as string | undefined, args.rate as string | undefined)
  },

  async secure_delete(args) {
    const path = args.path as string
    if (!path) return { error: '삭제할 파일 경로를 입력해주세요' }
    return secureDelete(path)
  },

  async clean_temp_files(args) {
    const scanOnly = args.scan_only === true
    if (scanOnly) return scanTempFiles()
    return cleanTempFiles()
  },

  async list_startup_programs() {
    const programs = await listStartupPrograms()
    return { programs, count: programs.length }
  },

  async toggle_startup_program(args) {
    const name = args.name as string
    const source = args.source as StartupSource
    const enabled = args.enabled as boolean
    if (!name) return { error: '프로그램 이름을 입력해주세요' }
    if (!source || !['hkcu', 'startup-folder'].includes(source)) {
      return { error: '소스는 hkcu 또는 startup-folder만 가능합니다' }
    }
    if (typeof enabled !== 'boolean') return { error: 'enabled must be a boolean' }
    return toggleStartupProgram(name, source, enabled)
  },
}
