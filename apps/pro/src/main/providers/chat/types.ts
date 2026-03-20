import type { ApprovalDecision, ChatPayload } from '@shared/types'
import type { ToolExecutionPolicy } from '../../tools/index'

export type ApprovalResolution = ApprovalDecision | 'aborted'

export interface ChatRuntime {
  requestId: string
  sessionId: string
  streamedText: string
  requestStepId: string
  toolStepCount: number
  pendingToolSteps: Map<string, string>
  assistantCommitted: boolean
}

export interface RecordToolResultOptions {
  finalizeStep?: boolean
  stepStatus?: 'success' | 'skipped'
  logLevel?: 'info' | 'warn' | 'error' | 'debug'
}

export interface ProviderToolRuntime {
  toolDefs: unknown
  appendText: (text: string) => void
  recordToolCall: (toolId: string, name: string, input: unknown) => string
  recordToolResult: (
    toolId: string,
    name: string,
    result: string,
    options?: RecordToolResultOptions,
  ) => void
  recordToolFailure: (toolId: string, name: string, errorMessage: string) => void
  requestApproval: (
    name: string,
    input: Record<string, unknown>,
    stepId: string,
    policy: ToolExecutionPolicy,
  ) => Promise<ApprovalResolution>
  getExecutionPolicy: (name: string) => ToolExecutionPolicy
  executeTool: (name: string, input: Record<string, unknown>) => Promise<string>
  createApprovalDeniedResult: (name: string, policy: ToolExecutionPolicy) => string
  markSessionRunning: () => void
  isAborted: () => boolean
}

export interface ChatProviderContext {
  payload: ChatPayload
  runtime: ChatRuntime
  abort: AbortController
  tools: ProviderToolRuntime
}

export interface ChatProviderAdapter {
  run: (context: ChatProviderContext) => Promise<void>
}
