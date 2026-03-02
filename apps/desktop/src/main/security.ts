/**
 * Security utilities — centralized path/command validation
 * All file/shell operations MUST go through these checks
 */

import { safeStorage } from 'electron'
import { resolve as resolvePath } from 'path'

// ─── Blocked Paths (read/write/delete all checked) ─────────

const BLOCKED_PATH_PREFIXES = [
  // Windows system
  'c:\\windows',
  'c:\\program files',
  'c:\\program files (x86)',
  'c:\\programdata',
  // Unix system
  '/system',
  '/usr',
  '/bin',
  '/sbin',
  '/etc',
  '/var',
]

const SENSITIVE_PATH_PATTERNS = [
  // SSH keys
  /[/\\]\.ssh[/\\]/i,
  // Environment files
  /[/\\]\.env(\..+)?$/i,
  // Git credentials
  /[/\\]\.git-credentials$/i,
  /[/\\]\.gitconfig$/i,
  // Browser profiles (cookies, passwords)
  /[/\\](chrome|chromium|firefox|edge)[/\\].*(cookies|login|password|key)/i,
  /[/\\]local state$/i,
  // Windows credential files
  /[/\\]ntuser\.dat/i,
  /[/\\]sam$/i,
  // Keychain/wallet
  /[/\\]\.gnupg[/\\]/i,
  /[/\\]\.aws[/\\]credentials/i,
  /[/\\]\.kube[/\\]config/i,
]

export function isPathBlocked(filePath: string): boolean {
  // Strip UNC/device path prefixes to prevent bypass via \\?\, \\.\ or \\server\share
  let normalized = filePath.replace(/\//g, '\\').toLowerCase()
  normalized = normalized.replace(/^\\\\[?.]\\/, '')
  normalized = normalized.replace(/^\\\\[^\\]+\\[^\\]+\\/, '')
  return BLOCKED_PATH_PREFIXES.some((b) => normalized.startsWith(b))
}

export function isSensitivePath(filePath: string): boolean {
  return SENSITIVE_PATH_PATTERNS.some((p) => p.test(filePath))
}

export function validatePath(filePath: string, operation: 'read' | 'write' | 'delete'): string | null {
  if (!filePath || typeof filePath !== 'string') {
    return '경로가 올바르지 않습니다'
  }
  // Block UNC paths (\\server\share)
  if (/^\\\\/.test(filePath)) {
    return '네트워크 경로는 사용할 수 없습니다'
  }
  // Resolve .. sequences to prevent traversal bypass
  const resolved = resolvePath(filePath)
  // Block Alternate Data Streams on resolved path (file.txt:hidden)
  if (/:[^/\\]/.test(resolved.slice(2))) {
    return '이 형식의 파일 경로는 사용할 수 없습니다'
  }
  if (isPathBlocked(resolved)) {
    return '시스템 보호 영역입니다. 접근할 수 없습니다'
  }
  if (isSensitivePath(resolved)) {
    return '보안 파일입니다. 접근할 수 없습니다'
  }
  return null // OK
}

// ─── Command Validation ────────────────────────────────────

const BLOCKED_COMMANDS = [
  // Destructive filesystem commands
  /\brm\s+(-[a-z]*r|-[a-z]*f|--recursive|--force)/i,
  /\brmdir\s+\/s/i,
  /\bdel\s+\/[sfq]/i,
  /\bformat\b/i,
  /\bdiskpart\b/i,
  /\bmkfs\b/i,
  // Registry manipulation
  /\breg\s+(delete|add|import)/i,
  /\bregedit/i,
  // System modification
  /\bsfc\b/i,
  /\bdism\b/i,
  /\bbcdboot\b/i,
  /\bbcdedit\b/i,
  // Privilege escalation
  /\brunas\b/i,
  /\bsudo\s+/i,
  // Network attacks / exfiltration
  /\bcurl\b.*\|\s*(sh|bash|cmd|powershell)/i,
  /\bwget\b.*\|\s*(sh|bash|cmd|powershell)/i,
  /\bpowershell\b.*-enc/i,
  /\bpowershell\b.*downloadstring/i,
  /\bpowershell\b.*invoke-webrequest/i,
  // Shutdown/restart
  /\bshutdown\b/i,
  /\brestart-computer\b/i,
  // Kill critical processes
  /\btaskkill\s+\/im\s+(explorer|csrss|lsass|svchost|winlogon)/i,
  // Shell redirects to system paths
  />\s*[a-z]:\\windows/i,
  />\s*[a-z]:\\program/i,
  />\s*\/etc\//i,
  />\s*\/usr\//i,
  // Inline code execution
  /\bpython3?\s+(-c|--command|-m)\b/i,
  /\bnode\s+.*(-e|--eval|--require|--print|--input-type)\b/i,
  /\bnpm\s+(exec|run|start|test)\b/i,
  /\bnpx\s+/i,
  /\bpip3?\s+install\b/i,
  // Git dangerous subcommands
  /\bgit\s+(config|filter-branch|remote\s+set-url|credential|fsck|gc|prune)\b/i,
  // Node/Python executing files (block any .js/.py arguments)
  /\bnode\s+[^\s|&;]+\.js\b/i,
  /\bpython3?\s+[^\s|&;]+\.py\b/i,
  // start launching arbitrary executables
  /\bstart\s+.*\.(exe|bat|cmd|ps1|vbs|msi|scr|com)\b/i,
  /\bstart\s+\/b\b/i,
  // cmd.exe for loops (can embed arbitrary commands)
  /\bfor\s+\/[fdlr]\b/i,
  // set /p can read from redirected input
  /\bset\s+\/p\b/i,
]

const ALLOWED_COMMAND_PREFIXES = [
  'echo', 'type', 'dir', 'ls', 'cat', 'head', 'tail', 'find', 'where',
  'whoami', 'hostname', 'ipconfig', 'ifconfig', 'ping', 'nslookup',
  'code', 'notepad', 'calc',
  'systeminfo', 'ver', 'date', 'time',
  'cd', 'mkdir', 'md', 'ren',
  'tasklist', 'netstat', 'tree',
  'clip',
]

/** Specific safe command patterns (allowed even when base command is not in ALLOWED_COMMAND_PREFIXES) */
const SAFE_COMMAND_PATTERNS = [
  // Version checks only
  /^node\s+--version$/i,
  /^python3?\s+--version$/i,
  // Read-only git subcommands (no arguments that could inject)
  /^git\s+(status|log|diff|branch|show|tag|remote|stash\s+list)\b/i,
]

export function validateCommand(command: string): string | null {
  if (!command || typeof command !== 'string') {
    return '명령어가 올바르지 않습니다'
  }

  const trimmed = command.trim()

  // Block command substitution (backticks and $())
  if (/`/.test(trimmed) || /\$\(/.test(trimmed)) {
    return '명령어 치환은 사용할 수 없습니다'
  }

  // Block UNC paths in any command argument (\\server\share download vector)
  if (/\\\\[^\\]/.test(trimmed)) {
    return '네트워크 경로(UNC)는 명령어에서 사용할 수 없습니다'
  }

  // Block caret escaping (cmd.exe bypass: r^m → rm)
  if (/\^[a-z]/i.test(trimmed)) {
    return '캐럿 이스케이프 문자는 사용할 수 없습니다'
  }

  // Block shell output redirects (> and >>) — validate ALL targets
  if (/(^|[^>])>(?!>?\s*\/)/.test(trimmed) || />>/.test(trimmed)) {
    for (const m of trimmed.matchAll(/>>?\s*"?([^"&|;\s]+)/g)) {
      const pathError = validatePath(m[1], 'write')
      if (pathError) return `출력 경로 차단: ${pathError}`
    }
  }

  // Check blocked patterns
  for (const pattern of BLOCKED_COMMANDS) {
    if (pattern.test(trimmed)) {
      return '위험한 명령어입니다. 실행할 수 없습니다'
    }
  }

  // Block `set VAR=VALUE` (environment modification) — allow `set` without `=` (display)
  if (/^\s*set\s+\w+=/i.test(trimmed)) {
    return '환경 변수 수정은 허용되지 않습니다'
  }

  // Check if starts with an allowed prefix (extract basename only, no path prefix)
  const firstWord = trimmed.split(/[\s&|;]/)[0].toLowerCase().replace(/\.exe$/, '')
  const basename = firstWord.includes('\\') ? firstWord.split('\\').pop()! : firstWord.includes('/') ? firstWord.split('/').pop()! : firstWord
  const isAllowed = ALLOWED_COMMAND_PREFIXES.some((p) => basename === p)

  if (!isAllowed) {
    // Check safe command patterns before rejecting
    const isSafe = SAFE_COMMAND_PATTERNS.some((p) => p.test(trimmed))
    if (!isSafe) {
      return `허용되지 않은 명령어입니다: ${firstWord}`
    }
  }

  // Reject chained commands with dangerous patterns
  if (/[|&;]/.test(trimmed)) {
    const parts = trimmed.split(/[|&;]+/)
    for (const part of parts) {
      const partTrimmed = part.trim()
      if (!partTrimmed) continue
      // Check each segment against blocked patterns
      for (const pattern of BLOCKED_COMMANDS) {
        if (pattern.test(partTrimmed)) {
          return '연결된 명령어에 위험한 패턴이 포함되어 있습니다'
        }
      }
      const subWord = partTrimmed.split(/[\s]/)[0].toLowerCase().replace(/\.exe$/, '')
      const subBase = subWord.includes('\\') ? subWord.split('\\').pop()! : subWord.includes('/') ? subWord.split('/').pop()! : subWord
      const subAllowed = ALLOWED_COMMAND_PREFIXES.some((p) => subBase === p)
      if (!subAllowed && subBase.length > 0) {
        return `연결된 명령어가 허용 목록에 없습니다: ${subBase}`
      }
    }
  }

  return null // OK
}

// ─── URL Validation ────────────────────────────────────────

export function isUrlSafe(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Only allow http(s) — block file://, javascript:, data:, etc.
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    // Block private/reserved IPs to prevent SSRF
    const h = parsed.hostname.toLowerCase()
    if (
      h === 'localhost' || h === '0.0.0.0' || h === '::1' ||
      h.startsWith('127.') || h.startsWith('10.') ||
      h.startsWith('192.168.') || h.startsWith('169.254.') ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(h) ||
      // IPv6 mapped/compatible addresses
      h.startsWith('[::ffff:') || h.startsWith('::ffff:') ||
      h.startsWith('[::') ||
      // IPv6 link-local (fe80::/10) and unique local (fc00::/7)
      h.startsWith('fe80:') || h.startsWith('[fe80:') ||
      h.startsWith('fc') || h.startsWith('[fc') ||
      h.startsWith('fd') || h.startsWith('[fd') ||
      // .local mDNS / .localhost (RFC 6761) / .internal
      h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localhost') ||
      // Hex/octal IP encoding (e.g., 0x7f000001, 0177.0.0.1)
      /^0x[0-9a-f]+$/i.test(h) ||
      /^0[0-7]+\./.test(h) ||
      // Pure numeric IPs (decimal encoding like 2130706433 = 127.0.0.1)
      /^\d{8,}$/.test(h) ||
      // Block empty/whitespace hostnames
      !h || h.trim() === ''
    ) return false
    return true
  } catch {
    return false
  }
}

// ─── Secure Storage (API keys) ─────────────────────────────

export function encryptString(value: string): Buffer {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('시스템 암호화를 사용할 수 없습니다. API 키를 안전하게 저장할 수 없습니다.')
  }
  return safeStorage.encryptString(value)
}

export function decryptString(encrypted: Buffer): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('시스템 암호화를 사용할 수 없습니다.')
  }
  return safeStorage.decryptString(encrypted)
}
