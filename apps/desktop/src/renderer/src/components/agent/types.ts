export type TimelineStepStatus = 'completed' | 'running' | 'awaiting' | 'failed' | 'pending'

export type TimelineStepKind = 'tool' | 'response' | 'thinking' | 'approval' | 'error'

export type TimelineStreamingPhase = 'idle' | 'waiting' | 'tool' | 'generating'

export interface TimelineApprovalRequest {
  id: string
  title: string
  description?: string
  confirmLabel?: string
  rejectLabel?: string
  tone?: 'default' | 'danger'
}

export interface TimelineStep {
  id: string
  kind: TimelineStepKind
  status: TimelineStepStatus
  title: string
  description?: string
  argsPreview?: string
  resultPreview?: string
  error?: string
  durationMs?: number
  timestamp?: number
  approval?: TimelineApprovalRequest
}

export interface TimelineStreamState {
  isStreaming?: boolean
  streamingPhase?: TimelineStreamingPhase
  streamingText?: string
  activeToolName?: string | null
  pendingApproval?: TimelineApprovalRequest | null
}
