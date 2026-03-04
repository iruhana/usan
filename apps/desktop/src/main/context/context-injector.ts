/**
 * Context Injector — builds dynamic context string for AI system prompt.
 * Combines active app, time of day, system state, and user preferences.
 */
import { contextManager } from '../infrastructure/context-manager'
import { systemMonitor } from '../infrastructure/system-monitor'

const APP_HINTS: Record<string, string> = {
  chrome: '사용자가 웹 브라우저를 사용 중입니다. 웹 검색이나 웹 페이지 관련 도움을 줄 수 있습니다.',
  edge: '사용자가 웹 브라우저를 사용 중입니다.',
  firefox: '사용자가 웹 브라우저를 사용 중입니다.',
  code: '사용자가 VS Code에서 코딩 중입니다. 코드 관련 도움이 유용할 수 있습니다.',
  'visual-studio': '사용자가 Visual Studio에서 개발 중입니다.',
  excel: '사용자가 엑셀 작업 중입니다. 스프레드시트 관련 도움이 유용합니다.',
  word: '사용자가 워드 문서 작업 중입니다.',
  powerpoint: '사용자가 파워포인트 작업 중입니다.',
  terminal: '사용자가 터미널/명령 프롬프트를 사용 중입니다.',
  slack: '사용자가 Slack 메신저를 사용 중입니다.',
  discord: '사용자가 Discord를 사용 중입니다.',
  teams: '사용자가 Teams를 사용 중입니다.',
  explorer: '사용자가 파일 탐색기를 사용 중입니다. 파일 관리 도움이 유용합니다.',
}

const TIME_HINTS: Record<string, string> = {
  morning: '오전 시간대입니다.',
  afternoon: '오후 시간대입니다.',
  evening: '저녁 시간대입니다.',
  night: '밤 시간대입니다. 사용자가 늦게까지 작업 중입니다.',
}

export function buildContextPrompt(): string {
  try {
  const snapshot = contextManager.getSnapshot()
  const metrics = systemMonitor.getLatest()
  const parts: string[] = []

  // Time context
  parts.push(TIME_HINTS[snapshot.timeOfDay] || '')

  // Active app context
  if (snapshot.activeApp && APP_HINTS[snapshot.activeApp]) {
    parts.push(APP_HINTS[snapshot.activeApp])
  } else if (snapshot.activeWindow?.title) {
    parts.push(`현재 활성 창: "${snapshot.activeWindow.title}"`)
  }

  // Idle detection
  if (snapshot.idleTimeMs > 5 * 60 * 1000) {
    parts.push('사용자가 잠시 자리를 비운 것 같습니다.')
  }

  // System health alerts
  if (metrics) {
    if (metrics.cpu.usage > 90) {
      parts.push(`⚠ CPU 사용률이 높습니다 (${metrics.cpu.usage}%).`)
    }
    if (metrics.memory.percent > 90) {
      parts.push(`⚠ 메모리 사용률이 높습니다 (${metrics.memory.percent}%).`)
    }
    for (const disk of metrics.disk) {
      if (disk.percent > 90) {
        parts.push(`⚠ ${disk.drive} 디스크 공간이 부족합니다 (${disk.percent}% 사용 중).`)
      }
    }
    if (metrics.battery && metrics.battery.percent < 20 && !metrics.battery.charging) {
      parts.push(`⚠ 배터리가 부족합니다 (${metrics.battery.percent}%).`)
    }
  }

  const filtered = parts.filter(Boolean)
  if (filtered.length === 0) return ''
  return '\n[현재 컨텍스트]\n' + filtered.join('\n')
  } catch {
    return '' // Graceful degradation if context services not yet initialized
  }
}

export function getContextSummary(): Record<string, unknown> {
  const snapshot = contextManager.getSnapshot()
  const metrics = systemMonitor.getLatest()
  return {
    activeApp: snapshot.activeApp,
    activeWindow: snapshot.activeWindow?.title || null,
    timeOfDay: snapshot.timeOfDay,
    idleTimeMs: snapshot.idleTimeMs,
    cpu: metrics?.cpu.usage || null,
    memory: metrics?.memory.percent || null,
    monitors: snapshot.monitors.length,
  }
}
