/**
 * Tool module aggregator — merges all tool modules into unified definitions + handlers.
 */
import type { ProviderTool } from '../providers/base'
import type { ToolHandler } from './types'

// Core tools (Phase 0)
import * as fsTools from './fs-tools'
import * as computerTools from './computer-tools'
import * as browserTools from './browser-tools'
import * as systemTools from './system-tools'

// Phase 1: Game Changers
import * as workflowTools from './workflow-tools'
import * as visionTools from './vision-tools'
import * as ragTools from './rag-tools'

// Phase 2: System & Input
import * as clipboardTools from './clipboard-tools'
import * as monitorTools from './monitor-tools'
import * as orchestrationTools from './orchestration-tools'

// Phase 3: Communication & Media
import * as imageTools from './image-tools'
import * as emailTools from './email-tools'
import * as calendarTools from './calendar-tools'

// Phase 4: Automation & Extensibility
import * as macroTools from './macro-tools'
import * as fileOrgTools from './file-org-tools'
import * as hotkeyTools from './hotkey-tools'
import * as marketplaceTools from './marketplace-tools'

const modules = [
  fsTools,
  computerTools,
  browserTools,
  systemTools,
  workflowTools,
  visionTools,
  ragTools,
  clipboardTools,
  monitorTools,
  orchestrationTools,
  imageTools,
  emailTools,
  calendarTools,
  macroTools,
  fileOrgTools,
  hotkeyTools,
  marketplaceTools,
]

export function getAllDefinitions(): ProviderTool[] {
  const defs: ProviderTool[] = []
  for (const mod of modules) {
    defs.push(...mod.definitions)
  }
  return defs
}

export function getAllHandlers(): Record<string, ToolHandler> {
  const merged: Record<string, ToolHandler> = {}
  for (const mod of modules) {
    Object.assign(merged, mod.handlers)
  }
  return merged
}
