import type { WorkflowDefinition, WorkflowRun } from '@shared/types/infrastructure'
import { workflowEngine } from '../infrastructure/workflow-engine'

export interface WorkflowSnapshot {
  workflows: WorkflowDefinition[]
  runs: WorkflowRun[]
}

export async function loadWorkflowSnapshot(): Promise<WorkflowSnapshot> {
  await workflowEngine.loadFromDisk()
  return {
    workflows: workflowEngine.list(),
    runs: workflowEngine.listRuns(),
  }
}

export function listWorkflowDefinitions(): WorkflowDefinition[] {
  return workflowEngine.list()
}

export function listWorkflowRuns(workflowId?: string): WorkflowRun[] {
  return workflowEngine.listRuns(workflowId)
}

export function upsertWorkflow(definition: Partial<WorkflowDefinition>): string {
  const id = definition.id?.trim()
  if (id && workflowEngine.get(id)) {
    workflowEngine.update(id, definition)
    return id
  }
  return workflowEngine.create(definition)
}

export function removeWorkflow(id: string): boolean {
  if (!id.trim()) return false
  return workflowEngine.delete(id.trim())
}
