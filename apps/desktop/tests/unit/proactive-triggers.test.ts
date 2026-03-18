import { describe, expect, it } from 'vitest'
import type { ClipboardEntry, ContextSnapshot, VoiceStatusEvent, WorkflowProgress } from '../../src/shared/types/infrastructure'
import {
  evaluateClipboardSuggestion,
  evaluateContextSuggestion,
  evaluateVoiceSuggestion,
  evaluateWorkflowSuggestion,
} from '../../src/main/proactive/triggers'

function createContextSnapshot(activeApp: string): ContextSnapshot {
  return {
    activeWindow: null,
    activeApp,
    timeOfDay: 'afternoon',
    idleTimeMs: 0,
    monitors: [],
    timestamp: Date.now(),
  }
}

function createClipboardEntry(text: string): ClipboardEntry {
  return {
    id: 'clip-1',
    text,
    timestamp: Date.now(),
    pinned: false,
  }
}

describe('proactive triggers', () => {
  it('detects JSON clipboard content', () => {
    const suggestion = evaluateClipboardSuggestion(createClipboardEntry('{"hello":"world"}'))

    expect(suggestion?.actions[0]?.action).toBe('clipboard_transform')
    expect(suggestion?.actions[0]?.params?.['format']).toBe('json_pretty')
  })

  it('creates a file suggestion for explorer context', () => {
    const suggestion = evaluateContextSuggestion(createContextSnapshot('explorer'))

    expect(suggestion?.actions[0]).toMatchObject({
      action: 'navigate',
      params: { page: 'files' },
    })
  })

  it('creates a tasks suggestion when a workflow fails', () => {
    const progress: WorkflowProgress = {
      runId: 'run-1',
      workflowId: 'wf-1',
      status: 'failed',
      currentStepIndex: 2,
      totalSteps: 5,
      stepResult: {
        stepId: 'step-2',
        status: 'failed',
        durationMs: 20,
        error: 'Boom',
      },
    }

    const suggestion = evaluateWorkflowSuggestion(progress)

    expect(suggestion?.actions[0]).toMatchObject({
      action: 'navigate',
      params: { page: 'tasks' },
    })
  })

  it('creates a settings suggestion when voice input errors', () => {
    const status: VoiceStatusEvent = {
      status: 'error',
      error: 'Microphone missing',
    }

    const suggestion = evaluateVoiceSuggestion(status)

    expect(suggestion?.actions[0]).toMatchObject({
      action: 'navigate',
      params: { page: 'settings', settingsTab: 'general' },
    })
  })
})
