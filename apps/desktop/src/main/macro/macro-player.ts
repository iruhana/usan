import { macroRecorder } from './macro-recorder'
import type { WorkflowStep } from '@shared/types/infrastructure'

export async function playMacroById(id: string): Promise<void> {
  if (!id.trim()) throw new Error('macro id is required')
  await macroRecorder.play(id.trim())
}

export function listMacroWorkflowSteps(id: string): WorkflowStep[] {
  if (!id.trim()) return []
  return macroRecorder.toWorkflowSteps(id.trim())
}
