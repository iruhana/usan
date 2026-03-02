import type { ProviderTool } from './providers/base'
import type { ToolResult } from '@shared/types/tools'
import { desktopCapturer, clipboard } from 'electron'
import { readFile, writeFile, readdir, stat, unlink, rename, realpath } from 'fs/promises'
import { join, dirname } from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)
import { validatePath, validateCommand } from '../security'
import { mouseClick, mouseDoubleClick, keyboardType, keyboardHotkey, listWindows, focusWindow } from '../computer/control'
import { browserOpen, browserClick, browserType, browserRead, browserScreenshot } from '../browser/browser-manager'
import { loadAllSkillsMultiSource, getEligibleSkills, getBuiltInSkillsDir, getUserSkillsDir } from '../skills/skill-loader'
import { reminderManager } from '../reminders/reminder-manager'
import { speakText } from '../tts/edge-tts'
import { secureDelete } from '../fs/secure-delete'
import { scanTempFiles, cleanTempFiles } from '../system/temp-cleaner'
import { listStartupPrograms, toggleStartupProgram } from '../system/startup-manager'
import type { StartupSource } from '../system/startup-manager'
import { loadPermissions } from '../store'
import { isPermissionGranted, isTimedGrantActive } from '@shared/types/permissions'
import { logObsWarn } from '../observability'

const ERROR_MESSAGES_KO: Record<string, string> = {
  ENOENT: '파일을 찾을 수 없습니다',
  EACCES: '접근 권한이 없습니다',
  EPERM: '이 작업을 수행할 권한이 없습니다',
  EISDIR: '파일이 아닌 폴더입니다',
  ENOTDIR: '폴더가 아닌 파일입니다',
  ENOTEMPTY: '폴더가 비어있지 않습니다',
  ENOSPC: '디스크 공간이 부족합니다',
  EMFILE: '열린 파일이 너무 많습니다. 잠시 후 다시 시도해주세요',
  ETIMEDOUT: '시간이 너무 오래 걸렸습니다. 다시 시도해주세요',
  ECONNREFUSED: '연결이 거부되었습니다',
  ECONNRESET: '연결이 끊어졌습니다',
  EAI_AGAIN: '네트워크 연결을 확인해주세요',
}

function toKoreanError(err: unknown): string {
  if (!(err instanceof Error)) return String(err)
  const code = (err as NodeJS.ErrnoException).code
  if (code && ERROR_MESSAGES_KO[code]) {
    return ERROR_MESSAGES_KO[code]
  }
  // Common Node.js error patterns
  if (err.message.includes('ENOENT')) return ERROR_MESSAGES_KO.ENOENT
  if (err.message.includes('EACCES')) return ERROR_MESSAGES_KO.EACCES
  if (err.message.includes('EPERM')) return ERROR_MESSAGES_KO.EPERM
  return err.message
}

const MAX_FILE_SIZE = 1 * 1024 * 1024 // 1MB

const PRIVILEGED_TOOLS = new Set([
  'screenshot',
  'read_file',
  'write_file',
  'list_directory',
  'delete_file',
  'run_command',
  'mouse_click',
  'keyboard_type',
  'keyboard_hotkey',
  'list_windows',
  'focus_window',
  'browser_open',
  'browser_click',
  'browser_type',
  'browser_read',
  'browser_screenshot',
  'run_skill_script',
  'secure_delete',
  'clean_temp_files',
  'list_startup_programs',
  'toggle_startup_program',
])

function getPrivilegeError(name: string, args?: Record<string, unknown>): string | null {
  if (!PRIVILEGED_TOOLS.has(name)) return null
  const grant = loadPermissions()
  const skillId = typeof args?.skill_id === 'string' ? args.skill_id : undefined
  if (isPermissionGranted(grant, { toolName: name, skillId })) return null
  const toolGrant = grant.toolGrants?.[name]
  const skillGrant = skillId ? grant.skillGrants?.[skillId] : undefined
  const reason =
    (toolGrant && !isTimedGrantActive(toolGrant)) || (skillGrant && !isTimedGrantActive(skillGrant))
      ? 'expired_grant'
      : 'missing_grant'
  logObsWarn('permission_denied', {
    scope: 'tools',
    item: name,
    skillId: skillId ?? null,
    reason,
    toolExpiresAt: toolGrant?.expiresAt ?? null,
    skillExpiresAt: skillGrant?.expiresAt ?? null,
  })
  return `권한 동의가 필요한 기능입니다: ${name}`
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn()
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      const isTransient = code === 'ETIMEDOUT' || code === 'ECONNRESET' || code === 'EAI_AGAIN'
      if (!isTransient || i === retries) throw err
    }
  }
  throw new Error('재시도 횟수를 초과했습니다')
}

export interface ToolHandler {
  definition: ProviderTool
  execute: (args: Record<string, unknown>) => Promise<unknown>
}

const TOOL_DEFINITIONS: ProviderTool[] = [
  {
    name: 'screenshot',
    description: '현재 화면을 캡처하여 스크린샷을 찍습니다. 화면에 무엇이 있는지 확인할 때 사용합니다.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'read_file',
    description: '파일의 내용을 읽습니다.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '파일 경로' },
      },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: '파일에 내용을 씁니다.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '파일 경로' },
        content: { type: 'string', description: '파일 내용' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_directory',
    description: '디렉토리의 파일과 폴더 목록을 봅니다.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '디렉토리 경로' },
      },
      required: ['path'],
    },
  },
  {
    name: 'delete_file',
    description: '파일을 삭제합니다.',
    parameters: {
      type: 'object',
      properties: {
        path: { type: 'string', description: '삭제할 파일 경로' },
      },
      required: ['path'],
    },
  },
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
    name: 'clipboard_read',
    description: '클립보드의 내용을 읽습니다.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'clipboard_write',
    description: '클립보드에 텍스트를 복사합니다.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '복사할 텍스트' },
      },
      required: ['text'],
    },
  },
  {
    name: 'web_search',
    description: '웹에서 정보를 검색합니다.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '검색어' },
      },
      required: ['query'],
    },
  },
  {
    name: 'mouse_click',
    description: '화면의 지정된 좌표를 마우스로 클릭합니다. 스크린샷으로 좌표를 확인한 후 사용하세요.',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'X 좌표 (픽셀)' },
        y: { type: 'number', description: 'Y 좌표 (픽셀)' },
        button: { type: 'string', enum: ['left', 'right'], description: '마우스 버튼 (기본: left)' },
        double: { type: 'boolean', description: '더블 클릭 여부 (기본: false)' },
      },
      required: ['x', 'y'],
    },
  },
  {
    name: 'keyboard_type',
    description: '키보드로 텍스트를 입력합니다. 현재 활성화된 입력 필드에 타이핑합니다.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '입력할 텍스트' },
      },
      required: ['text'],
    },
  },
  {
    name: 'keyboard_hotkey',
    description: '키보드 단축키를 누릅니다. 예: Ctrl+C, Alt+Tab, Ctrl+S',
    parameters: {
      type: 'object',
      properties: {
        keys: {
          type: 'array',
          items: { type: 'string' },
          description: '키 조합 배열. 예: ["ctrl", "c"], ["alt", "tab"]',
        },
      },
      required: ['keys'],
    },
  },
  {
    name: 'list_windows',
    description: '현재 열려 있는 모든 창의 목록을 보여줍니다.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'focus_window',
    description: '특정 창을 앞으로 가져옵니다. 창 제목이나 프로세스 이름으로 찾습니다.',
    parameters: {
      type: 'object',
      properties: {
        target: { type: 'string', description: '찾을 창 제목 또는 프로세스 이름 (부분 일치)' },
      },
      required: ['target'],
    },
  },
  {
    name: 'browser_open',
    description: '브라우저에서 웹 페이지를 엽니다. URL을 입력하면 해당 페이지로 이동합니다.',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string', description: '열 웹 주소 (예: https://naver.com)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'browser_click',
    description: '브라우저 페이지에서 요소를 클릭합니다. CSS 선택자로 요소를 지정합니다.',
    parameters: {
      type: 'object',
      properties: {
        selector: { type: 'string', description: 'CSS 선택자 (예: button.submit, #search-input)' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'browser_type',
    description: '브라우저 페이지의 입력 필드에 텍스트를 입력합니다.',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '입력할 텍스트' },
        selector: { type: 'string', description: 'CSS 선택자 (선택, 없으면 현재 포커스된 요소)' },
      },
      required: ['text'],
    },
  },
  {
    name: 'browser_read',
    description: '현재 브라우저 페이지의 텍스트 내용을 읽습니다.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'browser_screenshot',
    description: '현재 브라우저 페이지의 스크린샷을 찍습니다.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_skills',
    description: '사용 가능한 스킬(능력) 목록을 보여줍니다.',
    parameters: {
      type: 'object',
      properties: {},
    },
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
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'cancel_reminder',
    description: '설정된 알림을 취소합니다.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '취소할 알림 ID' },
      },
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
        text: { type: 'string', description: '읽을 텍스트' },
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
      properties: {
        path: { type: 'string', description: '안전 삭제할 파일 경로' },
      },
      required: ['path'],
    },
  },
  {
    name: 'clean_temp_files',
    description: '7일 이상 된 임시 파일(.tmp/.log/.bak 등)을 삭제하여 디스크 공간을 확보합니다. scan_only=true로 미리보기 가능.',
    parameters: {
      type: 'object',
      properties: {
        scan_only: { type: 'boolean', description: '스캔만 할지 여부 (true면 삭제하지 않음, 기본: false)' },
      },
    },
  },
  {
    name: 'list_startup_programs',
    description: '윈도우 시작 시 자동으로 실행되는 프로그램 목록을 보여줍니다.',
    parameters: {
      type: 'object',
      properties: {},
    },
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

const handlers: Record<string, (args: Record<string, unknown>) => Promise<unknown>> = {
  async screenshot() {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1920, height: 1080 },
    })
    const primary = sources[0]
    if (!primary) return { error: 'No screen source found' }
    const image = primary.thumbnail.toPNG().toString('base64')
    const size = primary.thumbnail.getSize()
    return { image, width: size.width, height: size.height }
  },

  async read_file(args) {
    const path = args.path as string
    const blocked = validatePath(path, 'read')
    if (blocked) return { error: blocked }
    const info = await stat(path)
    if (info.size > MAX_FILE_SIZE) {
      return { error: `파일이 너무 큽니다 (${Math.round(info.size / 1024 / 1024)}MB). 1MB 이하 파일만 읽을 수 있습니다.` }
    }
    // Detect binary files by checking for null bytes in first 8KB
    const BINARY_EXTS = new Set(['exe', 'dll', 'bin', 'png', 'jpg', 'jpeg', 'gif', 'bmp', 'ico', 'mp3', 'mp4', 'wav', 'zip', 'rar', '7z', 'gz', 'tar', 'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'so', 'dylib', 'o', 'obj', 'class', 'woff', 'woff2', 'ttf', 'eot'])
    const ext = path.split('.').pop()?.toLowerCase() || ''
    if (BINARY_EXTS.has(ext)) {
      return { error: `바이너리 파일입니다 (.${ext}). 텍스트 파일만 읽을 수 있습니다.` }
    }
    const content = await readFile(path, 'utf-8')
    if (content.slice(0, 8192).includes('\0')) {
      return { error: '바이너리 파일입니다. 텍스트 파일만 읽을 수 있습니다.' }
    }
    const truncated = content.length > 50000
    return { content: content.slice(0, 50000), ...(truncated && { truncated: true, totalLength: content.length }) }
  },

  async write_file(args) {
    const filePath = args.path as string
    const content = args.content as string
    if (typeof content !== 'string') return { error: '파일 내용이 비어있습니다' }
    if (content.length > MAX_FILE_SIZE) {
      return { error: `내용이 너무 큽니다 (${Math.round(content.length / 1024)}KB). 1MB 이하만 쓸 수 있습니다.` }
    }
    const blocked = validatePath(filePath, 'write')
    if (blocked) return { error: blocked }
    // Atomic write: temp file then rename to prevent corruption on crash
    const tmp = filePath + '.tmp'
    try {
      await writeFile(tmp, content, 'utf-8')
      await rename(tmp, filePath)
    } catch (err) {
      await unlink(tmp).catch(() => {})
      throw err
    }
    return { success: true }
  },

  async list_directory(args) {
    const dirPath = args.path as string
    const blocked = validatePath(dirPath, 'read')
    if (blocked) return { error: blocked }
    const entries = await readdir(dirPath, { withFileTypes: true })
    const results = await Promise.all(
      entries.slice(0, 100).map(async (entry) => {
        try {
          const fullPath = join(dirPath, entry.name)
          const info = await stat(fullPath)
          return {
            name: entry.name,
            isDirectory: entry.isDirectory(),
            size: info.size,
            modified: info.mtime.toISOString(),
          }
        } catch {
          return null
        }
      })
    )
    return { entries: results.filter(Boolean) }
  },

  async delete_file(args) {
    const path = args.path as string
    const blocked = validatePath(path, 'delete')
    if (blocked) return { error: blocked }
    await unlink(path)
    return { success: true }
  },

  async run_command(args) {
    const command = args.command as string
    if (typeof command !== 'string' || !command.trim()) return { error: '명령어를 입력해주세요' }
    const blocked = validateCommand(command)
    if (blocked) return { error: blocked }
    const rawCwd = args.cwd as string | undefined
    if (rawCwd) {
      const cwdBlocked = validatePath(rawCwd, 'read')
      if (cwdBlocked) return { error: `cwd blocked: ${cwdBlocked}` }
    }
    const cwd = rawCwd || process.env.HOME || process.env.USERPROFILE
    try {
      // Use execFile with cmd.exe to avoid shell meta-character issues
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh'
      const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command]
      const { stdout, stderr } = await execFileAsync(shell, shellArgs, {
        cwd: cwd || undefined,
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      })
      return { stdout, stderr, exitCode: 0 }
    } catch (err: unknown) {
      const e = err as { stdout?: string; stderr?: string; code?: number }
      return { stdout: e.stdout || '', stderr: e.stderr || '', exitCode: e.code || 1 }
    }
  },

  async clipboard_read() {
    return { text: clipboard.readText() }
  },

  async clipboard_write(args) {
    clipboard.writeText(args.text as string)
    return { success: true }
  },

  async mouse_click(args) {
    const x = Math.round(args.x as number)
    const y = Math.round(args.y as number)
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > 7680 || y > 4320) {
      return { error: '좌표가 화면 범위를 벗어났습니다' }
    }
    const rawButton = String(args.button || 'left').toLowerCase()
    if (rawButton !== 'left' && rawButton !== 'right') {
      return { error: '마우스 버튼은 left 또는 right만 가능합니다' }
    }
    const button: 'left' | 'right' = rawButton
    if (args.double) {
      await mouseDoubleClick(x, y)
    } else {
      await mouseClick(x, y, button)
    }
    return { success: true, x, y, button }
  },

  async keyboard_type(args) {
    const text = args.text as string
    if (!text) return { error: '입력할 텍스트를 지정해주세요' }
    await keyboardType(text)
    return { success: true, typed: text.length }
  },

  async keyboard_hotkey(args) {
    const keys = args.keys as string[]
    if (!keys?.length) return { error: '키 조합을 지정해주세요' }
    await keyboardHotkey(keys)
    return { success: true, keys }
  },

  async list_windows() {
    const windows = await listWindows()
    return { windows, count: windows.length }
  },

  async focus_window(args) {
    const target = args.target as string
    if (!target) return { error: '창 제목 또는 프로세스 이름을 지정해주세요' }
    const found = await focusWindow(target)
    if (found) {
      return { success: true, target }
    }
    return { error: `'${target}' 창을 찾을 수 없습니다. list_windows로 열린 창 목록을 확인해보세요.` }
  },

  async web_search(args) {
    const query = encodeURIComponent(args.query as string)
    const MAX_BODY = 512 * 1024 // 512KB
    return withRetry(async () => {
      const res = await fetch(`https://html.duckduckgo.com/html/?q=${query}`, {
        headers: { 'User-Agent': 'Usan/0.1' },
        signal: AbortSignal.timeout(10000),
      })
      // Read body with size limit to prevent OOM
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

  async browser_open(args) {
    const url = args.url as string
    if (!url) return { error: '웹 주소를 입력해주세요' }
    return browserOpen(url)
  },

  async browser_click(args) {
    const selector = args.selector as string
    if (!selector) return { error: 'CSS 선택자를 지정해주세요' }
    return browserClick(selector)
  },

  async browser_type(args) {
    const text = args.text as string
    if (!text) return { error: '입력할 텍스트를 지정해주세요' }
    return browserType(text, args.selector as string | undefined)
  },

  async browser_read() {
    return browserRead()
  },

  async browser_screenshot() {
    return browserScreenshot()
  },

  async list_skills() {
    const all = await loadAllSkillsMultiSource()
    const eligible = getEligibleSkills(all)
    return {
      skills: eligible.map((s) => ({
        id: s.meta.id,
        name: s.meta.name,
        description: s.meta.description,
        triggers: s.meta.triggers,
        emoji: s.meta.metadata.emoji,
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

    // Security: block path traversal
    if (scriptName.includes('..') || scriptName.includes('/') || scriptName.includes('\\')) {
      return { error: '스크립트 이름에 경로 문자를 사용할 수 없습니다' }
    }

    // Security: only allow safe extensions
    const ext = scriptName.split('.').pop()?.toLowerCase()
    if (!ext || !['py', 'ps1', 'js'].includes(ext)) {
      return { error: '.py, .ps1, .js 파일만 실행할 수 있습니다' }
    }

    // Security: sanitize script arguments — block shell metacharacters
    if (scriptArgs.length > 2000) {
      return { error: '스크립트 인자가 너무 깁니다 (최대 2000자)' }
    }
    if (/[;|&`$><{}()\[\]!%\n\r]/.test(scriptArgs)) {
      return { error: '스크립트 인자에 특수문자를 사용할 수 없습니다' }
    }

    // Find skill directory (use cached skills if available)
    const all = await loadAllSkillsMultiSource()
    const skill = all.find((s) => s.meta.id === skillId)
    if (!skill) return { error: `스킬 '${skillId}'을 찾을 수 없습니다` }

    const skillDir = dirname(skill.filePath)
    const scriptPath = join(skillDir, 'scripts', scriptName)

    // Verify script exists and is inside the skill directory (resolve symlinks)
    let resolvedScript: string
    try {
      resolvedScript = await realpath(scriptPath)
    } catch {
      return { error: `스크립트 '${scriptName}'을 찾을 수 없습니다` }
    }
    let resolvedScriptsDir: string
    try {
      resolvedScriptsDir = await realpath(join(skillDir, 'scripts'))
    } catch {
      return { error: '스킬 scripts 디렉토리를 찾을 수 없습니다' }
    }
    if (!resolvedScript.startsWith(resolvedScriptsDir)) {
      return { error: '스크립트가 스킬 디렉토리 밖에 있습니다' }
    }

    // Execute based on extension
    const splitArgs = scriptArgs.split(/\s+/).filter(Boolean)
    const runners: Record<string, [string, string[]]> = {
      py: ['python', [scriptPath, ...splitArgs]],
      ps1: ['powershell', ['-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...splitArgs]],
      js: ['node', [scriptPath, ...splitArgs]],
    }

    const [cmd, cmdArgs] = runners[ext]
    try {
      const { stdout, stderr } = await execFileAsync(cmd, cmdArgs, {
        cwd: skillDir,
        timeout: 30000,
        maxBuffer: 1 * 1024 * 1024,
        windowsHide: true,
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
    if (scanOnly) {
      return scanTempFiles()
    }
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
    if (typeof enabled !== 'boolean') return { error: 'enabled 값을 지정해주세요' }
    return toggleStartupProgram(name, source, enabled)
  },
}

export class ToolCatalog {
  getTools(): ProviderTool[] {
    return TOOL_DEFINITIONS
  }

  async execute(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    const start = Date.now()
    const handler = handlers[name]

    if (!handler) {
      return {
        id: crypto.randomUUID(),
        name,
        result: null,
        error: `알 수 없는 도구입니다: ${name}`,
        duration: Date.now() - start,
      }
    }

    const privilegeError = getPrivilegeError(name, args)
    if (privilegeError) {
      return {
        id: crypto.randomUUID(),
        name,
        result: null,
        error: privilegeError,
        duration: Date.now() - start,
      }
    }

    try {
      const result = await handler(args)
      return {
        id: crypto.randomUUID(),
        name,
        result,
        duration: Date.now() - start,
      }
    } catch (err: unknown) {
      return {
        id: crypto.randomUUID(),
        name,
        result: null,
        error: toKoreanError(err),
        duration: Date.now() - start,
      }
    }
  }

  getToolNames(): string[] {
    return TOOL_DEFINITIONS.map((t) => t.name)
  }
}

export const toolCatalog = new ToolCatalog()
