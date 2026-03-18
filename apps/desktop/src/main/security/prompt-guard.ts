import type { GuardFinding, GuardScanKind, GuardScanResult, GuardSeverity } from './types'

interface GuardPattern {
  category: string
  label: string
  score: number
  regex: RegExp
  kinds?: GuardScanKind[]
}

const CONTROL_CHAR_PATTERN = /[\u200B-\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g
const BASE64_FRAGMENT_PATTERN = /\b(?:[A-Za-z0-9+/]{16,}={0,2})\b/g

const PATTERNS: GuardPattern[] = [
  {
    category: 'instruction_override',
    label: 'instruction override',
    score: 28,
    regex: /\b(ignore|disregard|forget|override)\b[\s\S]{0,40}\b(instructions?|prompt|rule|policy|system)\b|이전\s*(지시|규칙|프롬프트)[\s\S]{0,20}(무시|잊어)|前の?\s*(指示|プロンプト|ルール)[\s\S]{0,20}(無視|忘れて)/i,
  },
  {
    category: 'prompt_extraction',
    label: 'prompt extraction',
    score: 34,
    regex: /\b(system prompt|developer message|hidden (?:instructions?|prompt)|reveal (?:the )?(?:prompt|instructions?)|show .*instructions?|print .*?(?:configuration|prompt))\b|시스템\s*프롬프트|개발자\s*메시지|숨겨진\s*(지시|프롬프트)|プロンプト|開発者\s*メッセージ|隠された?\s*(指示|プロンプト)/i,
  },
  {
    category: 'role_hijack',
    label: 'role hijack',
    score: 26,
    regex: /\b(you are now|act as|pretend to be|developer mode|unrestricted mode|DAN)\b|지금부터.*역할|제한 없이|開発者モード|制限なし/i,
  },
  {
    category: 'credential_exfiltration',
    label: 'credential exfiltration',
    score: 36,
    regex: /\b(api key|access token|bearer token|password|private key|ssh key|secret|credentials?)\b|API\s*키|비밀번호|토큰|秘密鍵|認証情報/i,
  },
  {
    category: 'dangerous_command',
    label: 'dangerous command',
    score: 40,
    regex: /\b(rm\s+-rf|del\s+\/f|format\s+[a-z]:|shutdown\b|powershell\s+-enc|invoke-webrequest|curl\b[\s\S]{0,40}\|\s*(sh|bash)|wget\b[\s\S]{0,40}\|\s*(sh|bash)|runas\b|regedit\b)\b/i,
    kinds: ['user_input', 'tool_args', 'tool_output'],
  },
  {
    category: 'system_json_injection',
    label: 'system json injection',
    score: 24,
    regex: /"role"\s*:\s*"system"|<system>|BEGIN[_ -](SYSTEM|PROMPT)|END[_ -](SYSTEM|PROMPT)/i,
  },
  {
    category: 'authority_impersonation',
    label: 'authority impersonation',
    score: 20,
    regex: /\b(i am your developer|i am the system|as admin|as root|must comply immediately)\b|나는\s*관리자야|개발자니까|私は開発者|管理者として/i,
  },
  {
    category: 'emotional_manipulation',
    label: 'emotional manipulation',
    score: 8,
    regex: /\b(urgent|immediately|emergency|lives depend|panic)\b|긴급|당장|지금 바로|至急|緊急/i,
  },
]

function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function excerptForMatch(text: string, regex: RegExp): string | undefined {
  const match = regex.exec(text)
  regex.lastIndex = 0
  if (match == null || match.index == null) return undefined
  const start = Math.max(0, match.index - 30)
  const end = Math.min(text.length, match.index + match[0].length + 30)
  return text.slice(start, end)
}

function severityFromScore(score: number): GuardSeverity {
  if (score >= 81) return 'critical'
  if (score >= 51) return 'high'
  if (score >= 26) return 'medium'
  if (score >= 1) return 'low'
  return 'safe'
}

function shouldBlock(kind: GuardScanKind, severity: GuardSeverity, findings: GuardFinding[]): boolean {
  if (kind === 'tool_output' || kind === 'rag_context') {
    return severity === 'medium' || severity === 'high' || severity === 'critical'
  }

  if (severity === 'critical' || severity === 'high') return true
  if (severity !== 'medium') return false

  return findings.some((finding) => (
    finding.category === 'instruction_override'
    || finding.category === 'prompt_extraction'
    || finding.category === 'role_hijack'
    || finding.category === 'dangerous_command'
    || finding.category === 'credential_exfiltration'
    || finding.category === 'system_json_injection'
  ))
}

function isLikelyBase64Fragment(fragment: string): boolean {
  if (fragment.length < 16) return false
  return /[=+/]/.test(fragment) || (/[A-Z]/.test(fragment) && /[a-z]/.test(fragment) && /\d/.test(fragment))
}

function scanEncodedPayload(text: string): GuardFinding[] {
  const matches = (text.match(BASE64_FRAGMENT_PATTERN) ?? []).filter(isLikelyBase64Fragment)
  if (matches.length === 0) return []

  const totalChars = matches.reduce((sum, match) => sum + match.length, 0)
  if (matches.length < 3 && totalChars < 120) return []

  return [{
    category: 'encoded_payload',
    label: 'encoded payload',
    score: matches.length >= 5 || totalChars >= 160 ? 34 : 28,
    excerpt: `fragments=${matches.length} chars=${totalChars} sample=${matches[0]?.slice(0, 48)}`,
  }]
}

function scanControlCharacters(text: string): GuardFinding[] {
  const matches = text.match(CONTROL_CHAR_PATTERN) ?? []
  if (matches.length === 0) return []
  return [{
    category: 'token_smuggling',
    label: 'invisible characters',
    score: 16,
    excerpt: `count=${matches.length}`,
  }]
}

function summarize(findings: GuardFinding[]): string {
  if (findings.length === 0) return 'No prompt-injection indicators detected.'
  const labels = [...new Set(findings.map((finding) => finding.label))]
  return `Detected ${labels.join(', ')}.`
}

export function scanPromptInput(text: string, kind: GuardScanKind): GuardScanResult {
  const normalized = normalizeText(text)
  if (!normalized) {
    return {
      severity: 'safe',
      score: 0,
      blocked: false,
      findings: [],
      summary: 'No content to scan.',
    }
  }

  const findings: GuardFinding[] = []
  for (const pattern of PATTERNS) {
    if (pattern.kinds && !pattern.kinds.includes(kind)) continue
    if (!pattern.regex.test(normalized)) continue
    findings.push({
      category: pattern.category,
      label: pattern.label,
      score: pattern.score,
      excerpt: excerptForMatch(normalized, pattern.regex),
    })
    pattern.regex.lastIndex = 0
  }

  findings.push(...scanEncodedPayload(normalized))
  findings.push(...scanControlCharacters(text))

  const score = Math.min(100, findings.reduce((sum, finding) => sum + finding.score, 0))
  const severity = severityFromScore(score)
  return {
    severity,
    score,
    blocked: shouldBlock(kind, severity, findings),
    findings,
    summary: summarize(findings),
  }
}
