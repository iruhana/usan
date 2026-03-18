import type {
  ClipboardEntry,
  ClipboardTransformFormat,
  ContextSnapshot,
  SuggestionAction,
  SuggestionType,
  SystemMetrics,
  VoiceStatusEvent,
  WorkflowProgress,
} from '@shared/types/infrastructure'
import type { ProactiveRule } from './rules'

export interface TriggeredSuggestion {
  type: SuggestionType
  title: string
  description: string
  priority: number
  actions: SuggestionAction[]
}

function withAction(action?: SuggestionAction): SuggestionAction[] {
  return action ? [action] : []
}

function asAppLabel(app: string): string {
  switch (app) {
    case 'vscode':
      return 'VS Code'
    case 'visual-studio':
      return 'Visual Studio'
    case 'edge':
      return 'Microsoft Edge'
    case 'firefox':
      return 'Firefox'
    case 'brave':
      return 'Brave'
    case 'chrome':
      return 'Chrome'
    case 'excel':
      return 'Excel'
    case 'word':
      return 'Word'
    case 'powerpoint':
      return 'PowerPoint'
    case 'onenote':
      return 'OneNote'
    case 'outlook':
      return 'Outlook'
    case 'explorer':
      return 'File Explorer'
    case 'terminal':
      return 'Terminal'
    default:
      return app
  }
}

function clipboardTransformAction(label: string, format: ClipboardTransformFormat): SuggestionAction {
  return {
    label,
    action: 'clipboard_transform',
    params: { format },
  }
}

function navigateAction(label: string, page: 'home' | 'tasks' | 'files' | 'tools' | 'settings', settingsTab?: string): SuggestionAction {
  return {
    label,
    action: 'navigate',
    params: settingsTab ? { page, settingsTab } : { page },
  }
}

function promptAction(label: string, prompt: string): SuggestionAction {
  return {
    label,
    action: 'send_prompt',
    params: { prompt },
  }
}

export function evaluateProactiveTriggers(
  metrics: SystemMetrics | null,
  context: ContextSnapshot,
  rules: ProactiveRule[],
): TriggeredSuggestion[] {
  const triggered: TriggeredSuggestion[] = []

  for (const rule of rules) {
    if (!rule.enabled) continue

    if (rule.kind === 'cpu' && metrics && metrics.cpu.usage >= rule.threshold) {
      triggered.push({
        type: rule.type,
        title: rule.title,
        description: `CPU usage is ${metrics.cpu.usage.toFixed(1)}%. Close heavy processes if performance feels slow.`,
        priority: rule.priority,
        actions: withAction(rule.action),
      })
    }

    if (rule.kind === 'memory' && metrics && metrics.memory.percent >= rule.threshold) {
      triggered.push({
        type: rule.type,
        title: rule.title,
        description: `Memory usage is ${metrics.memory.percent.toFixed(1)}%. Consider closing unused apps.`,
        priority: rule.priority,
        actions: withAction(rule.action),
      })
    }

    if (rule.kind === 'disk' && metrics) {
      for (const disk of metrics.disk) {
        if (disk.percent < rule.threshold) continue
        triggered.push({
          type: rule.type,
          title: `${rule.title} on ${disk.drive}`,
          description: `${disk.drive} is ${disk.percent.toFixed(1)}% used. Free space: ${disk.free.toFixed(1)} GB.`,
          priority: rule.priority,
          actions: withAction(rule.action),
        })
      }
    }

    if (rule.kind === 'battery' && metrics?.battery && !metrics.battery.charging && metrics.battery.percent <= rule.threshold) {
      triggered.push({
        type: rule.type,
        title: rule.title,
        description: `Battery is at ${metrics.battery.percent.toFixed(0)}%. Connect a charger to avoid interruption.`,
        priority: rule.priority,
        actions: withAction(rule.action),
      })
    }

    if (rule.kind === 'idle') {
      const thresholdMs = rule.threshold * 60 * 1000
      if (context.idleTimeMs >= thresholdMs) {
        triggered.push({
          type: rule.type,
          title: rule.title,
          description: `No activity detected for ${rule.threshold}+ minutes.`,
          priority: rule.priority,
          actions: withAction(rule.action),
        })
      }
    }
  }

  return triggered
}

export function evaluateClipboardSuggestion(entry: ClipboardEntry | null): TriggeredSuggestion | null {
  const text = entry?.text?.trim()
  if (!text || text.length < 4) return null

  if ((text.startsWith('{') || text.startsWith('[')) && text.length <= 4000) {
    try {
      JSON.parse(text)
      return {
        type: 'action',
        title: 'Clipboard looks like JSON',
        description: 'Prettify the latest clipboard content before pasting it somewhere else.',
        priority: 5,
        actions: [clipboardTransformAction('Prettify clipboard', 'json_pretty')],
      }
    } catch {
      // Ignore invalid JSON-like text.
    }
  }

  if (/%[0-9A-Fa-f]{2}/.test(text)) {
    try {
      const decoded = decodeURIComponent(text)
      if (decoded !== text) {
        return {
          type: 'action',
          title: 'Clipboard looks URL-encoded',
          description: 'Decode the latest clipboard text into a human-readable form.',
          priority: 4,
          actions: [clipboardTransformAction('Decode clipboard', 'url_decode')],
        }
      }
    } catch {
      // Ignore invalid encoded strings.
    }
  }

  if (
    /^#{1,6}\s/m.test(text)
    || /\*\*.+?\*\*/.test(text)
    || /\[[^\]]+\]\([^)]+\)/.test(text)
    || /^[-*+]\s/m.test(text)
  ) {
    return {
      type: 'action',
      title: 'Clipboard looks like Markdown',
      description: 'Strip Markdown formatting from the latest clipboard text for plain-text reuse.',
      priority: 4,
      actions: [clipboardTransformAction('Copy plain text', 'md_to_text')],
    }
  }

  return null
}

export function evaluateContextSuggestion(context: ContextSnapshot): TriggeredSuggestion | null {
  const activeApp = context.activeApp.trim().toLowerCase()
  if (!activeApp) return null

  if (activeApp === 'explorer') {
    return {
      type: 'info',
      title: 'File browsing context detected',
      description: 'File Explorer is active. Open the Files workspace to organize, inspect, or act on what you are browsing.',
      priority: 3,
      actions: [navigateAction('Open Files', 'files')],
    }
  }

  if (['chrome', 'edge', 'firefox', 'brave'].includes(activeApp)) {
    return {
      type: 'info',
      title: 'Browser context detected',
      description: `${asAppLabel(activeApp)} is active. Ask Usan to interpret the current screen or summarize what you are looking at.`,
      priority: 3,
      actions: [
        promptAction(
          'Ask about this screen',
          'Help me understand what is on my current screen and suggest the next best action.',
        ),
      ],
    }
  }

  if (['vscode', 'visual-studio', 'terminal'].includes(activeApp)) {
    return {
      type: 'info',
      title: 'Coding workspace detected',
      description: `${asAppLabel(activeApp)} is active. Start a focused coding task to debug, review, or implement the next step.`,
      priority: 3,
      actions: [
        promptAction(
          'Start coding task',
          'Help me with the coding task I am currently working on. Start by asking what I want to debug, build, or review.',
        ),
      ],
    }
  }

  if (['outlook', 'word', 'excel', 'powerpoint', 'onenote'].includes(activeApp)) {
    return {
      type: 'info',
      title: 'Office workflow detected',
      description: `${asAppLabel(activeApp)} is active. Usan can help draft, summarize, or refine the work you are doing in this app.`,
      priority: 3,
      actions: [
        promptAction(
          'Draft with Usan',
          'Help me draft, summarize, or refine what I am working on in the current office application.',
        ),
      ],
    }
  }

  return null
}

export function evaluateWorkflowSuggestion(progress: WorkflowProgress): TriggeredSuggestion | null {
  if (progress.status === 'failed') {
    const stepLabel = progress.stepResult?.stepId ? ` at step ${progress.stepResult.stepId}` : ''
    return {
      type: 'error',
      title: `Workflow ${progress.workflowId} failed`,
      description: `Run ${progress.runId} stopped${stepLabel}. Open Tasks to inspect the timeline and retry if needed.`,
      priority: 9,
      actions: [navigateAction('Open Tasks', 'tasks')],
    }
  }

  if (progress.status === 'completed') {
    return {
      type: 'action',
      title: `Workflow ${progress.workflowId} completed`,
      description: `Run ${progress.runId} finished successfully. Review the latest workflow output from the Tasks page.`,
      priority: 4,
      actions: [navigateAction('Review Tasks', 'tasks')],
    }
  }

  return null
}

export function evaluateVoiceSuggestion(status: VoiceStatusEvent): TriggeredSuggestion | null {
  if (status.status !== 'error') return null

  return {
    type: 'warning',
    title: 'Voice input needs attention',
    description: status.error?.trim() || 'Voice input reported an error. Review voice settings or microphone availability.',
    priority: 6,
    actions: [navigateAction('Check voice settings', 'settings', 'general')],
  }
}
