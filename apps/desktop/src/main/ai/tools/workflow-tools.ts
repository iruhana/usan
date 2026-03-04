/**
 * Workflow tools: create_workflow, run_workflow, list_workflows, schedule_workflow
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'
import type { WorkflowStepType } from '@shared/types/infrastructure'
import { workflowEngine } from '../../infrastructure/workflow-engine'

export const definitions: ProviderTool[] = [
  {
    name: 'create_workflow',
    description: '새 자동화 워크플로우를 생성합니다. 여러 도구를 순차적으로 실행하는 워크플로우를 만들 수 있습니다.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '워크플로우 이름' },
        description: { type: 'string', description: '워크플로우 설명' },
        steps: {
          type: 'array',
          description: '실행할 단계 목록',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: ['tool_call', 'condition', 'loop', 'delay'] },
              toolName: { type: 'string', description: '호출할 도구 이름 (type=tool_call)' },
              toolArgs: { type: 'object', description: '도구 인자' },
              delayMs: { type: 'number', description: '대기 시간(ms) (type=delay)' },
              onError: { type: 'string', enum: ['stop', 'skip', 'retry'] },
            },
          },
        },
      },
      required: ['name', 'steps'],
    },
  },
  {
    name: 'run_workflow',
    description: '저장된 워크플로우를 실행합니다.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '워크플로우 ID' },
        variables: { type: 'object', description: '실행 변수 (선택)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_workflows',
    description: '저장된 모든 워크플로우 목록을 조회합니다.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'schedule_workflow',
    description: '워크플로우를 주기적으로 실행되도록 스케줄링합니다.',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '워크플로우 ID' },
        intervalMinutes: { type: 'number', description: '실행 간격 (분)' },
      },
      required: ['id', 'intervalMinutes'],
    },
  },
]

export const handlers: Record<string, ToolHandler> = {
  async create_workflow(args) {
    const steps = (args.steps as Array<Record<string, unknown>> || []).map((s, i) => ({
      id: `step_${i}`,
      type: ((s.type as string) || 'tool_call') as WorkflowStepType,
      toolName: s.toolName as string | undefined,
      toolArgs: s.toolArgs as Record<string, unknown> | undefined,
      delayMs: s.delayMs as number | undefined,
      onError: (s.onError as 'stop' | 'skip' | 'retry') || 'stop',
    }))

    const id = workflowEngine.create({
      name: args.name as string,
      description: (args.description as string) || '',
      steps,
    })
    return { success: true, workflowId: id }
  },

  async run_workflow(args) {
    const run = await workflowEngine.execute(
      args.id as string,
      args.variables as Record<string, unknown> | undefined,
    )
    return {
      runId: run.id,
      status: run.status,
      stepsCompleted: run.stepResults.length,
      error: run.error,
    }
  },

  async list_workflows() {
    const workflows = workflowEngine.list()
    return {
      workflows: workflows.map((w) => ({
        id: w.id,
        name: w.name,
        description: w.description,
        stepsCount: w.steps.length,
        createdAt: w.createdAt,
      })),
    }
  },

  async schedule_workflow(args) {
    const intervalMs = (args.intervalMinutes as number) * 60 * 1000
    const scheduleId = workflowEngine.schedule(args.id as string, intervalMs)
    return { success: true, scheduleId }
  },
}
