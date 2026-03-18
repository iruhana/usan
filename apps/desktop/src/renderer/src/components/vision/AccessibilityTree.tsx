import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AccessibilityNode, AccessibilityTreeSummary, Rect } from '@shared/types/infrastructure'
import { ChevronRight, GitBranch, LocateFixed } from 'lucide-react'
import { Card, SectionHeader } from '../ui'
import { t } from '../../i18n'

interface AccessibilityTreeProps {
  tree: AccessibilityNode | null
  summary: AccessibilityTreeSummary
  focusLabel?: string
}

function collectInitialExpandedIds(node: AccessibilityNode, depth = 0, ids = new Set<string>()): Set<string> {
  ids.add(node.id)
  if (depth >= 1) return ids

  for (const child of node.children) {
    collectInitialExpandedIds(child, depth + 1, ids)
  }

  return ids
}

function findNodeById(node: AccessibilityNode, targetId: string): AccessibilityNode | null {
  if (node.id === targetId) return node
  for (const child of node.children) {
    const match = findNodeById(child, targetId)
    if (match) return match
  }
  return null
}

function findNodeByLabel(node: AccessibilityNode, label: string): AccessibilityNode | null {
  if (node.label.trim().toLowerCase() === label.trim().toLowerCase()) return node
  for (const child of node.children) {
    const match = findNodeByLabel(child, label)
    if (match) return match
  }
  return null
}

function formatBounds(bounds: Rect | null): string {
  if (!bounds) return t('vision.boundsUnavailable')
  return `${bounds.x}, ${bounds.y} - ${bounds.width} x ${bounds.height}`
}

function scopeLabel(scope: AccessibilityTreeSummary['scope']): string {
  if (scope === 'active-window') return t('vision.scopeActiveWindow')
  if (scope === 'focused-window') return t('vision.scopeFocusedWindow')
  return t('vision.scopeUnavailable')
}

export default function AccessibilityTree({ tree, summary, focusLabel }: AccessibilityTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    if (!tree) {
      setExpandedIds(new Set())
      setSelectedId(null)
      return
    }

    setExpandedIds(collectInitialExpandedIds(tree))
    const focusNode = focusLabel ? findNodeByLabel(tree, focusLabel) : null
    setSelectedId(focusNode?.id ?? tree.id)
  }, [tree, focusLabel])

  const selectedNode = useMemo(() => {
    if (!tree || !selectedId) return null
    return findNodeById(tree, selectedId) ?? tree
  }, [tree, selectedId])

  const toggleExpanded = (nodeId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })
  }

  const renderNode = (node: AccessibilityNode, depth = 0): ReactNode => {
    const isExpanded = expandedIds.has(node.id)
    const isSelected = selectedId === node.id
    const isFocused = Boolean(focusLabel && node.label.trim().toLowerCase() === focusLabel.trim().toLowerCase())
    const hasChildren = node.children.length > 0

    return (
      <div key={node.id} className="space-y-1">
        <div
          className="flex items-start gap-2"
          style={{ paddingLeft: `${depth * 14}px` }}
        >
          <button
            type="button"
            className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-soft)] hover:text-[var(--color-text)]"
            onClick={() => {
              if (hasChildren) toggleExpanded(node.id)
            }}
            aria-label={hasChildren ? t('vision.toggleTreeNode') : t('vision.treeLeaf')}
            disabled={!hasChildren}
          >
            {hasChildren ? (
              <ChevronRight
                size={14}
                className={isExpanded ? 'rotate-90 transition-transform' : 'transition-transform'}
              />
            ) : (
              <span className="h-2 w-2 rounded-full bg-[var(--color-border)]" />
            )}
          </button>

          <button
            type="button"
            data-testid={`vision-tree-node-${node.id}`}
            className={`flex min-w-0 flex-1 items-start justify-between gap-2 rounded-[var(--radius-md)] px-3 py-2 text-left ring-1 transition-colors ${
              isSelected
                ? 'bg-[var(--color-primary-light)] ring-[var(--color-primary)]/35'
                : 'bg-[var(--color-surface-soft)] ring-[var(--color-border-subtle)] hover:ring-[var(--color-primary)]/20'
            }`}
            onClick={() => setSelectedId(node.id)}
          >
            <div className="min-w-0 space-y-1">
              <div className="truncate text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">
                {node.label}
              </div>
              <div className="truncate text-[length:var(--text-xs)] text-[var(--color-text-muted)]">
                {node.role}
              </div>
            </div>

            {isFocused ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-warning)]/12 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-warning)]">
                <LocateFixed size={12} />
                {t('vision.focused')}
              </span>
            ) : null}
          </button>
        </div>

        {isExpanded ? (
          <div className="space-y-1">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <Card variant="outline" className="space-y-3" data-testid="vision-accessibility-tree">
      <SectionHeader title={t('vision.accessibilityTree')} icon={GitBranch} indicator="var(--color-primary)" />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" data-testid="vision-accessibility-summary">
        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] px-3 py-2">
          <p className="text-[length:var(--text-xs)] uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('vision.accessibilityScope')}
          </p>
          <p className="mt-1 text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{scopeLabel(summary.scope)}</p>
        </div>
        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] px-3 py-2">
          <p className="text-[length:var(--text-xs)] uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('vision.accessibilityNodes')}
          </p>
          <p className="mt-1 text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{summary.nodeCount}</p>
        </div>
        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] px-3 py-2">
          <p className="text-[length:var(--text-xs)] uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('vision.accessibilityDepth')}
          </p>
          <p className="mt-1 text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">{summary.maxDepth}</p>
        </div>
        <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] px-3 py-2">
          <p className="text-[length:var(--text-xs)] uppercase tracking-wide text-[var(--color-text-muted)]">
            {t('vision.accessibilityTruncated')}
          </p>
          <p className="mt-1 text-[length:var(--text-sm)] font-medium text-[var(--color-text)]">
            {summary.truncated ? t('vision.yes') : t('vision.no')}
          </p>
        </div>
      </div>

      {!tree ? (
        <p className="text-[length:var(--text-sm)] text-[var(--color-text-muted)]">
          {t('vision.accessibilityUnavailable')}
        </p>
      ) : (
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)]">
          <div className="max-h-[420px] overflow-auto rounded-[var(--radius-md)] bg-[var(--color-bg)] p-2 ring-1 ring-[var(--color-border-subtle)]">
            {renderNode(tree)}
          </div>

          <div
            className="space-y-3 rounded-[var(--radius-md)] bg-[var(--color-surface-soft)] p-3 ring-1 ring-[var(--color-border-subtle)]"
            data-testid="vision-accessibility-details"
          >
            <div>
              <p className="text-[length:var(--text-xs)] uppercase tracking-wide text-[var(--color-text-muted)]">
                {t('vision.accessibilitySelected')}
              </p>
              <p className="mt-1 text-[length:var(--text-base)] font-semibold text-[var(--color-text)]">
                {selectedNode?.label ?? t('vision.accessibilityUnavailable')}
              </p>
            </div>

            {selectedNode ? (
              <dl className="space-y-2 text-[length:var(--text-sm)] text-[var(--color-text-secondary)]">
                <div>
                  <dt className="font-medium text-[var(--color-text)]">{t('vision.accessibilityRole')}</dt>
                  <dd>{selectedNode.role}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--color-text)]">{t('vision.accessibilityAutomationId')}</dt>
                  <dd>{selectedNode.automationId ?? t('vision.notAvailable')}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--color-text)]">{t('vision.accessibilityValue')}</dt>
                  <dd>{selectedNode.value ?? t('vision.notAvailable')}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--color-text)]">{t('vision.accessibilityHelpText')}</dt>
                  <dd>{selectedNode.helpText ?? t('vision.notAvailable')}</dd>
                </div>
                <div>
                  <dt className="font-medium text-[var(--color-text)]">{t('vision.accessibilityBounds')}</dt>
                  <dd>{formatBounds(selectedNode.bounds)}</dd>
                </div>
              </dl>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  )
}
