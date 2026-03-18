/**
 * IPC Channel type contracts — Main ↔ Renderer communication
 * All IPC goes through typed contextBridge, never raw ipcRenderer
 */

import type {
  CapabilityGrantRequest,
  CapabilityGrantResponse,
  PermissionGrant,
  PermissionGrantRequest,
  PermissionRevokeRequest,
} from './permissions'
import type {
  CollaborationDraftUpdate,
  CollaborationJoinRequest,
  CollaborationRemoteConversation,
  CollaborationRemoteDraft,
  CollaborationSessionStatus,
  CollaborationStartRequest,
} from './infrastructure'
import type { ToolResult } from './tools'

export type Locale = 'ko' | 'en' | 'ja'
export type UpdateChannel = 'stable' | 'beta'
export type PermissionProfile = 'full' | 'balanced' | 'strict'

// ─── AI ──────────────────────────────────────────

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: Array<{ id: string; name: string; args: Record<string, unknown> }>
  toolResults?: ToolResult[]
  modelId?: string
  timestamp: number
  isError?: boolean
}

export interface ChatRequest {
  conversationId: string
  message: string
  modelId?: string
}

export interface ChatChunk {
  type: 'text' | 'tool_call' | 'tool_result' | 'done' | 'error'
  content: string
  toolCall?: { id: string; name: string; args: Record<string, unknown> }
  toolResult?: ToolResult
}

export interface ModelInfo {
  id: string
  name: string
  provider: 'openrouter' | 'ollama' | 'node-llama-cpp'
  isLocal: boolean
  size?: number
}

// ─── File System ─────────────────────────────────

export interface FileEntry {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modifiedAt: number
}

export interface FilePickRequest {
  mode: 'file' | 'directory'
  multi?: boolean
  title?: string
}

export interface FilePickResult {
  canceled: boolean
  paths: string[]
}

// ─── Computer Use ────────────────────────────────

export interface ScreenCaptureResult {
  /** Base64 PNG image data */
  image: string
  width: number
  height: number
}

// ─── Conversations (persistence) ─────────────────

export interface StoredConversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
}

// ─── Notes ───────────────────────────────────────

export interface Note {
  id: string
  title: string
  content: string
  updatedAt: number
}

// ─── Settings ────────────────────────────────────

export interface AppSettings {
  schemaVersion: number
  fontScale: number
  highContrast: boolean
  aiLabelEnabled: boolean
  voiceEnabled: boolean
  voiceOverlayEnabled: boolean
  voiceSpeed: number
  locale: Locale
  localeConfigured: boolean
  theme: 'light' | 'dark' | 'system'
  openAtLogin: boolean
  updateChannel: UpdateChannel
  autoDownloadUpdates: boolean
  permissionProfile: PermissionProfile
  beginnerMode: boolean
  browserCredentialAutoImportEnabled: boolean
  browserCredentialAutoImportDone: boolean
  sidebarCollapsed: boolean
  enterToSend: boolean
  cloudApiKey?: string
}

export interface CredentialSummaryItem {
  id: string
  site: string
  usernameMasked: string
  importedAt: number
}

export interface CredentialVaultSummary {
  totalCount: number
  lastImportedAt: number | null
  preview: CredentialSummaryItem[]
}

export interface CredentialImportResult {
  importedCount: number
  skippedCount: number
  totalCount: number
  sourcePath: string
}

export interface UpdaterStatus {
  enabled: boolean
  channel: UpdateChannel
  autoDownload: boolean
  checking: boolean
  updateAvailableVersion: string | null
  downloadedVersion: string | null
  lastCheckAt: number | null
  lastError: string | null
  crashStreak: number
}

export interface ExternalOAuthProfile {
  id: string
  name?: string
  nickname?: string
  email?: string
  avatarUrl?: string
}

export interface ExternalOAuthStatus {
  provider: 'google' | 'naver' | 'kakao'
  configured: boolean
  authenticated: boolean
  expiresAt: number | null
  scopes: string[]
  profile?: ExternalOAuthProfile
}

export type EmailAccountPreset = 'custom' | 'gmail' | 'outlook' | 'naver' | 'daum'

export interface EmailServerConfig {
  host: string
  port: number
  secure: boolean
}

export interface EmailAccountConfigInput {
  preset: EmailAccountPreset
  displayName?: string
  emailAddress: string
  username: string
  password?: string
  imap: EmailServerConfig
  smtp: EmailServerConfig
}

export interface EmailAccountStatus {
  provider: 'none' | 'imap-smtp' | 'google' | 'microsoft'
  configured: boolean
  displayName?: string
  emailAddress?: string
  username?: string
  preset?: EmailAccountPreset
  imap?: EmailServerConfig
  smtp?: EmailServerConfig
  hasStoredPassword: boolean
  lastVerifiedAt: number | null
}

export type CalendarAccountPreset = 'custom' | 'icloud' | 'fastmail' | 'nextcloud'

export interface CalendarAccountConfigInput {
  preset: CalendarAccountPreset
  serverUrl: string
  username: string
  password?: string
  calendarUrl?: string
  calendarName?: string
}

export interface CalendarAccountStatus {
  provider: 'none' | 'caldav' | 'google' | 'microsoft'
  configured: boolean
  preset?: CalendarAccountPreset
  username?: string
  serverUrl?: string
  calendarUrl?: string
  calendarName?: string
  hasStoredPassword: boolean
  lastVerifiedAt: number | null
}

export type FinanceAccountPreset =
  | 'openbanking-testbed'
  | 'openbanking-production'
  | 'mydata-compatible'
  | 'custom'

export interface FinanceTransferDefaults {
  contractAccountType?: string
  contractAccountNum?: string
  withdrawPassPhrase?: string
  withdrawPrintContent?: string
  clientName?: string
  clientBankCode?: string
  clientAccountNum?: string
  clientIdentifier?: string
  nameCheckOption?: 'on' | 'off'
  transferPurpose?: string
}

export interface FinanceAccountConfigInput {
  preset: FinanceAccountPreset
  apiBaseUrl: string
  clientId: string
  clientSecret?: string
  accessToken?: string
  refreshToken?: string
  fintechUseNum: string
  userSeqNo?: string
  scope?: string
  accountAlias?: string
  providerLabel?: string
  transferDefaults?: FinanceTransferDefaults
}

export interface FinanceAccountStatus {
  provider: 'none' | 'open-banking' | 'mydata'
  configured: boolean
  preset?: FinanceAccountPreset
  apiBaseUrl?: string
  clientId?: string
  fintechUseNum?: string
  userSeqNo?: string
  scope?: string
  accountAlias?: string
  providerLabel?: string
  transferDefaults?: FinanceTransferDefaults
  bankName?: string
  accountMask?: string
  lastBalance?: string
  currency?: string
  hasStoredAccessToken: boolean
  hasStoredRefreshToken: boolean
  hasStoredClientSecret: boolean
  lastVerifiedAt: number | null
}

export interface FinanceAccountSummary {
  fintechUseNum: string
  accountAlias?: string
  bankName?: string
  accountMask?: string
  balance: string
  availableAmount?: string
  currency: string
  updatedAt: number
}

export interface FinanceTransactionQuery {
  fromDate?: string
  toDate?: string
  limit?: number
  pageIndex?: number
  sortOrder?: 'A' | 'D'
}

export interface FinanceTransactionEntry {
  id: string
  postedAt: string
  kind?: string
  summary: string
  amount: string
  balanceAfter?: string
  branchName?: string
}

export interface FinanceTransferDraft {
  amount: string
  summary?: string
  toFintechUseNum?: string
  toBankCode?: string
  toAccountNum?: string
  toAccountHolderName?: string
}

export interface FinanceTransferResult {
  success: boolean
  bankTranId?: string
  apiTranId?: string
  message?: string
  raw?: unknown
}

export type PublicDataAccountPreset = 'data-go-kr' | 'odcloud' | 'custom'
export type PublicDataAuthMode = 'query' | 'header' | 'both'
export type PublicDataFormat = 'json' | 'xml'

export interface PublicDataAccountConfigInput {
  preset: PublicDataAccountPreset
  apiBaseUrl: string
  serviceKey?: string
  authMode: PublicDataAuthMode
  providerLabel?: string
  serviceName?: string
  defaultPath?: string
  defaultFormat?: PublicDataFormat
}

export interface PublicDataAccountStatus {
  provider: 'none' | 'data-go-kr' | 'odcloud'
  configured: boolean
  preset?: PublicDataAccountPreset
  apiBaseUrl?: string
  authMode?: PublicDataAuthMode
  providerLabel?: string
  serviceName?: string
  defaultPath?: string
  defaultFormat?: PublicDataFormat
  hasStoredServiceKey: boolean
  lastVerifiedAt: number | null
}

export interface PublicDataQuery {
  path?: string
  method?: 'GET' | 'POST'
  query?: Record<string, string | number | boolean | null | undefined>
  body?: unknown
  responseType?: 'json' | 'text'
}

export interface PublicDataQueryResult {
  ok: boolean
  status: number
  url: string
  contentType?: string
  body: unknown
}

export interface PublicBusinessStatusEntry {
  businessNumber: string
  statusCode?: string
  statusText?: string
  taxType?: string
  closedOn?: string
  openedOn?: string
  raw?: unknown
}

export interface PublicBusinessStatusLookup {
  businessNumbers: string[]
  pathOverride?: string
}

export type TaxServicePreset = 'barobill' | 'custom'
export type TaxServiceAuthMode = 'header' | 'bearer' | 'query'

export interface TaxAccountConfigInput {
  preset: TaxServicePreset
  apiBaseUrl: string
  apiKey?: string
  authMode: TaxServiceAuthMode
  providerLabel?: string
  memberId?: string
  corporationNumber?: string
  userId?: string
  businessStatePath?: string
  hometaxPath?: string
  taxInvoicePath?: string
}

export interface TaxAccountStatus {
  provider: 'none' | 'barobill'
  configured: boolean
  preset?: TaxServicePreset
  apiBaseUrl?: string
  authMode?: TaxServiceAuthMode
  providerLabel?: string
  memberId?: string
  corporationNumber?: string
  userId?: string
  businessStatePath?: string
  hometaxPath?: string
  taxInvoicePath?: string
  hasStoredApiKey: boolean
  lastVerifiedAt: number | null
}

export interface TaxBusinessStatusLookup {
  businessNumbers: string[]
  pathOverride?: string
}

export interface TaxBusinessStatusEntry {
  businessNumber: string
  statusText?: string
  taxType?: string
  closedOn?: string
  raw?: unknown
}

export interface HometaxEvidenceQuery {
  fromDate?: string
  toDate?: string
  businessNumber?: string
  counterpartyNumber?: string
  direction?: 'all' | 'sales' | 'purchase'
  documentType?: 'all' | 'tax-invoice' | 'cash-receipt'
  page?: number
  pageSize?: number
  pathOverride?: string
}

export interface HometaxEvidenceEntry {
  id: string
  issuedAt?: string
  direction?: string
  documentType?: string
  counterpartyName?: string
  counterpartyNumber?: string
  supplyAmount?: string
  taxAmount?: string
  totalAmount?: string
  status?: string
  summary?: string
  raw?: unknown
}

// ─── Permissions ─────────────────────────────────

// Permissions are granted explicitly and may be time-bound.

// ─── IPC Channel Map ─────────────────────────────

export interface IPCChannels {
  // AI
  'ai:chat': { request: ChatRequest; response: void }
  'ai:chat-stream': { event: ChatChunk }
  'ai:models': { request: void; response: ModelInfo[] }
  'ai:stop': { request: string; response: void }

  // Computer Use
  'computer:screenshot': { request: void; response: ScreenCaptureResult }

  // File System
  'fs:read': { request: { path: string }; response: string }
  'fs:write': { request: { path: string; content: string }; response: void }
  'fs:delete': { request: { path: string }; response: void }
  'fs:list': { request: { dir: string }; response: FileEntry[] }

  // Shell
  'shell:exec': { request: { command: string; cwd?: string }; response: { stdout: string; stderr: string; exitCode: number } }

  // Settings
  'settings:get': { request: void; response: AppSettings }
  'settings:set': { request: Partial<AppSettings>; response: void }

  // Updater
  'updater:status': { request: void; response: UpdaterStatus }
  'updater:check-now': { request: void; response: UpdaterStatus }
  'updater:download': { request: void; response: UpdaterStatus }
  'updater:install': { request: void; response: { queued: boolean } }

  // Permissions
  'permissions:get': { request: void; response: PermissionGrant }
  'permissions:grant': { request: PermissionGrantRequest | void; response: PermissionGrant }
  'permissions:revoke': { request: PermissionRevokeRequest | void; response: PermissionGrant }
  'permissions:issue-capability': { request: CapabilityGrantRequest; response: CapabilityGrantResponse }

  // Conversations
  'conversations:load': { request: void; response: StoredConversation[] }
  'conversations:save': { request: StoredConversation[]; response: void }

  // Notes
  'notes:load': { request: void; response: Note[] }
  'notes:save': { request: Note[]; response: void }

  // AI validation
  'ai:validate-key': { request: string; response: { valid: boolean; error?: string } }

  // File system extras
  'fs:pick': { request: FilePickRequest; response: FilePickResult }
  'fs:open-path': { request: string; response: void }

  // Browser credentials (CSV import)
  'credentials:get-summary': { request: void; response: CredentialVaultSummary }
  'credentials:import-browser-csv': { request: void; response: CredentialImportResult }
  'credentials:clear': { request: void; response: { success: boolean } }

  // System
  'system:desktop-path': { request: void; response: string }
  'locale:detect': { request: void; response: Locale }

  // Memory
  'memory:load': { request: void; response: unknown }
  'memory:save': { request: unknown; response: void }

  // Collaboration
  'collaboration:status': { request: void; response: CollaborationSessionStatus }
  'collaboration:start': { request: CollaborationStartRequest; response: CollaborationSessionStatus }
  'collaboration:join': { request: CollaborationJoinRequest; response: CollaborationSessionStatus }
  'collaboration:leave': { request: void; response: CollaborationSessionStatus }
  'collaboration:sync-conversation': { request: StoredConversation; response: void }
  'collaboration:sync-draft': { request: CollaborationDraftUpdate; response: void }
  'collaboration:status-changed': { event: CollaborationSessionStatus }
  'collaboration:remote-conversation': { event: CollaborationRemoteConversation }
  'collaboration:remote-draft': { event: CollaborationRemoteDraft }

  // Notification (renderer event, not handle)
  'notification': { event: { title: string; body: string; level: string } }

  // OAuth integrations
  'google:oauth-start': { request: string | void; response: { success: boolean; error?: string } }
  'google:oauth-status': { request: void; response: { authenticated: boolean } }
  'google:oauth-logout': { request: void; response: { success: boolean } }
  'naver:oauth-start': { request: void; response: { success: boolean; error?: string } }
  'naver:oauth-status': { request: void; response: ExternalOAuthStatus }
  'naver:oauth-logout': { request: void; response: { success: boolean } }
  'kakao:oauth-start': { request: void; response: { success: boolean; error?: string } }
  'kakao:oauth-status': { request: void; response: ExternalOAuthStatus }
  'kakao:oauth-logout': { request: void; response: { success: boolean } }
  'email:status': { request: void; response: EmailAccountStatus }
  'email:save-config': { request: EmailAccountConfigInput; response: EmailAccountStatus }
  'email:clear-config': { request: void; response: EmailAccountStatus }
  'calendar:status': { request: void; response: CalendarAccountStatus }
  'calendar:save-config': { request: CalendarAccountConfigInput; response: CalendarAccountStatus }
  'calendar:clear-config': { request: void; response: CalendarAccountStatus }
  'finance:status': { request: void; response: FinanceAccountStatus }
  'finance:save-config': { request: FinanceAccountConfigInput; response: FinanceAccountStatus }
  'finance:clear-config': { request: void; response: FinanceAccountStatus }
  'finance:account-summary': { request: void; response: FinanceAccountSummary }
  'finance:transactions': { request: FinanceTransactionQuery; response: FinanceTransactionEntry[] }
  'finance:transfer': { request: FinanceTransferDraft; response: FinanceTransferResult }
  'public-data:status': { request: void; response: PublicDataAccountStatus }
  'public-data:save-config': { request: PublicDataAccountConfigInput; response: PublicDataAccountStatus }
  'public-data:clear-config': { request: void; response: PublicDataAccountStatus }
  'public-data:query': { request: PublicDataQuery; response: PublicDataQueryResult }
  'public-data:business-status': { request: PublicBusinessStatusLookup; response: PublicBusinessStatusEntry[] }
  'tax:status': { request: void; response: TaxAccountStatus }
  'tax:save-config': { request: TaxAccountConfigInput; response: TaxAccountStatus }
  'tax:clear-config': { request: void; response: TaxAccountStatus }
  'tax:business-status': { request: TaxBusinessStatusLookup; response: TaxBusinessStatusEntry[] }
  'tax:hometax-evidence': { request: HometaxEvidenceQuery; response: HometaxEvidenceEntry[] }
}
