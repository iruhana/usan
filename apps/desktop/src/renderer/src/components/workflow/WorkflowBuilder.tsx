import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, X } from 'lucide-react'
import { Button, Card, Input } from '../ui'
import type { WorkflowDefinition, WorkflowStep } from '@shared/types/infrastructure'
import { t } from '../../i18n'

interface WorkflowBuilderProps {
  open: boolean
  onClose: () => void
  onSubmit: (definition: Partial<WorkflowDefinition>) => Promise<void>
  initial?: WorkflowDefinition | null
}

function createStep(overrides?: Partial<WorkflowStep>): WorkflowStep {
  return {
    id: crypto.randomUUID(),
    type: 'tool_call',
    toolName: 'list_directory',
    toolArgs: {},
    onError: 'stop',
    ...overrides,
  }
}

export default function WorkflowBuilder({ open, onClose, onSubmit, initial }: WorkflowBuilderProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [intervalSec, setIntervalSec] = useState(0)
  const [steps, setSteps] = useState<WorkflowStep[]>([createStep()])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return

    if (initial) {
      setName(initial.name)
      setDescription(initial.description)
      setSteps(initial.steps.length > 0 ? initial.steps : [createStep()])
      const scheduleTrigger = initial.triggers.find((trigger) => trigger.type === 'schedule')
      const configured = Number(scheduleTrigger?.config?.intervalMs ?? 0)
      setIntervalSec(Number.isFinite(configured) && configured > 0 ? Math.floor(configured / 1000) : 0)
    } else {
      setName('')
      setDescription('')
      setSteps([createStep()])
      setIntervalSec(0)
    }

    setError(null)
  }, [open, initial])

  const canSubmit = useMemo(() => {
    return name.trim().length > 0 && steps.length > 0 && steps.every((step) => step.type !== 'tool_call' || !!step.toolName?.trim())
  }, [name, steps])

  if (!open) return null

  const updateStep = (stepId: string, patch: Partial<WorkflowStep>) => {
    setSteps((prev) => prev.map((step) => (step.id === stepId ? { ...step, ...patch } : step)))
  }

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const triggers = intervalSec > 0
        ? [{ type: 'schedule' as const, config: { intervalMs: intervalSec * 1000 } }]
        : [{ type: 'manual' as const, config: {} }]

      await onSubmit({
        id: initial?.id,
        name: name.trim(),
        description: description.trim(),
        triggers,
        steps: steps.map((step) => ({
          ...step,
          toolArgs: step.toolArgs ?? {},
        })),
        variables: initial?.variables ?? {},
      })

      onClose()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-backdrop)]/60 p-4">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-auto rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
          <h2 className="text-[length:var(--text-lg)] font-semibold text-[var(--color-text)]">{t('workflow.create')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[var(--radius-md)] p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]"
            aria-label={t('chat.cancel')}
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <Input
            label={t('workflow.name')}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('workflow.namePlaceholder')}
          />

          <div className="flex flex-col gap-1">
            <label className="text-[length:var(--text-sm)] font-medium text-[var(--color-text-muted)]">{t('workflow.description')}</label>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t('workflow.descriptionPlaceholder')}
              className="min-h-24 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-2 text-[length:var(--text-md)] text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
            />
          </div>

          <div className="grid gap-2 md:grid-cols-[1fr_200px]">
            <Input
              label={t('workflow.trigger')}
              value={intervalSec > 0 ? t('workflow.triggerSchedule') : t('workflow.triggerManual')}
              readOnly
            />
            <Input
              type="number"
              min={0}
              step={1}
              value={intervalSec}
              onChange={(event) => setIntervalSec(Math.max(0, Number(event.target.value) || 0))}
              label={t('workflow.schedule')}
              helperText={t('workflow.intervalHint')}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[length:var(--text-md)] font-semibold text-[var(--color-text)]">{t('workflow.step')}</h3>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Plus size={14} />}
                onClick={() => setSteps((prev) => [...prev, createStep()])}
              >
                {t('workflow.addStep')}
              </Button>
            </div>

            {steps.map((step, index) => (
              <Card key={step.id} variant="outline" className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[length:var(--text-sm)] font-medium text-[var(--color-text-muted)]">{t('workflow.step')} {index + 1}</span>
                  <button
                    type="button"
                    onClick={() => setSteps((prev) => prev.filter((item) => item.id !== step.id))}
                    className="rounded-[var(--radius-md)] p-1.5 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                    aria-label={t('workflow.removeStep')}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <div className="grid gap-2 md:grid-cols-3">
                  <div className="md:col-span-2">
                    <Input
                      label={t('workflow.selectTool')}
                      value={step.toolName ?? ''}
                      onChange={(event) => updateStep(step.id, { toolName: event.target.value })}
                    />
                  </div>
                  <div>
                    <label className="text-[length:var(--text-sm)] font-medium text-[var(--color-text-muted)]">onError</label>
                    <select
                      value={step.onError ?? 'stop'}
                      onChange={(event) => updateStep(step.id, { onError: event.target.value as WorkflowStep['onError'] })}
                      className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 text-[length:var(--text-md)] text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                    >
                      <option value="stop">stop</option>
                      <option value="skip">skip</option>
                      <option value="retry">retry</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[length:var(--text-sm)] font-medium text-[var(--color-text-muted)]">toolArgs (JSON)</label>
                  <textarea
                    value={JSON.stringify(step.toolArgs ?? {}, null, 2)}
                    onChange={(event) => {
                      try {
                        const parsed = JSON.parse(event.target.value || '{}') as Record<string, unknown>
                        updateStep(step.id, { toolArgs: parsed })
                        setError(null)
                      } catch {
                        setError(t('workflow.invalidJson'))
                      }
                    }}
                    className="min-h-24 w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-3 py-2 font-mono text-[length:var(--text-sm)] text-[var(--color-text)] outline-none transition-all focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/20"
                  />
                </div>
              </Card>
            ))}
          </div>

          {error && <p className="text-[length:var(--text-sm)] text-[var(--color-danger)]">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-3">
            <Button variant="ghost" onClick={onClose}>{t('chat.cancel')}</Button>
            <Button onClick={handleSubmit} loading={submitting} disabled={!canSubmit}>{t('workflow.save')}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}
