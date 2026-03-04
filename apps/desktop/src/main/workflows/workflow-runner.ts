import type { WorkflowDefinition, WorkflowRun } from '@shared/types/infrastructure'
import { workflowEngine } from '../infrastructure/workflow-engine'

export interface WorkflowRunRequest {
  workflowId: string
  variables?: Record<string, unknown>
}

export function createWorkflow(definition: Partial<WorkflowDefinition>): string {
  return workflowEngine.create(definition)
}

export function deleteWorkflow(workflowId: string): boolean {
  return workflowEngine.delete(workflowId)
}

export function listWorkflows(): WorkflowDefinition[] {
  return workflowEngine.list()
}

export async function runWorkflow(request: WorkflowRunRequest): Promise<WorkflowRun> {
  if (!request.workflowId || !request.workflowId.trim()) {
    throw new Error('workflowId is required')
  }

  return workflowEngine.execute(request.workflowId, request.variables)
}

export function pauseWorkflowRun(runId: string): void {
  if (!runId || !runId.trim()) {
    throw new Error('runId is required')
  }
  workflowEngine.pause(runId)
}

export function resumeWorkflowRun(runId: string): void {
  if (!runId || !runId.trim()) {
    throw new Error('runId is required')
  }
  workflowEngine.resume(runId)
}

export function cancelWorkflowRun(runId: string): void {
  if (!runId || !runId.trim()) {
    throw new Error('runId is required')
  }
  workflowEngine.cancel(runId)
}

export function listWorkflowRuns(workflowId?: string): WorkflowRun[] {
  return workflowEngine.listRuns(workflowId)
}
