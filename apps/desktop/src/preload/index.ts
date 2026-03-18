import { contextBridge, ipcRenderer } from 'electron'
import type {
  CalendarAccountConfigInput,
  CalendarAccountStatus,
  ChatRequest,
  AppSettings,
  ScreenCaptureResult,
  FileEntry,
  FilePickRequest,
  FilePickResult,
  ChatChunk,
  StoredConversation,
  Note,
  UpdaterStatus,
  CredentialVaultSummary,
  CredentialImportResult,
  EmailAccountConfigInput,
  EmailAccountStatus,
  ExternalOAuthStatus,
  FinanceAccountConfigInput,
  FinanceAccountStatus,
  FinanceAccountSummary,
  FinanceTransactionEntry,
  FinanceTransactionQuery,
  FinanceTransferDraft,
  FinanceTransferResult,
  HometaxEvidenceEntry,
  HometaxEvidenceQuery,
  PublicBusinessStatusEntry,
  PublicBusinessStatusLookup,
  PublicDataAccountConfigInput,
  PublicDataAccountStatus,
  PublicDataQuery,
  PublicDataQueryResult,
  TaxAccountConfigInput,
  TaxAccountStatus,
  TaxBusinessStatusEntry,
  TaxBusinessStatusLookup,
} from '@shared/types/ipc'
import type {
  CapabilityGrantRequest,
  CapabilityGrantResponse,
  PermissionGrant,
  PermissionGrantRequest,
  PermissionRevokeRequest,
} from '@shared/types/permissions'
import type {
  CollaborationDraftUpdate,
  CollaborationJoinRequest,
  CollaborationRemoteConversation,
  CollaborationRemoteDraft,
  CollaborationSessionStatus,
  CollaborationStartRequest,
  SystemMetrics, ProcessInfo, ContextSnapshot, HotkeyBinding,
  WorkflowDefinition, WorkflowRun, WorkflowProgress,
  InstalledPlugin, ClipboardEntry, ClipboardTransformFormat,
  RagDocument, RagSearchResult, RagIndexProgress,
  RagIndexFileResult, RagIndexFolderResult,
  Suggestion, VoiceStatusEvent,
  OcrResult, UiAnalysisResult, UiElement,
  MacroEntry,
  FileOrgPreview, DuplicateGroup,
  ImageInfo,
  EmailEntry, EmailFull,
  CalendarEvent,
  DisplayInfo,
  MarketplaceEntry,
  McpServerConfig,
  McpServerStatus,
  McpToolInfo,
} from '@shared/types/infrastructure'
import { IPC } from '@shared/constants/channels'

const api = {
  // ??? Window Controls ???????????????????????????
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
  },

  // ??? AI ????????????????????????????????????????
  ai: {
    chat: (req: ChatRequest) => ipcRenderer.invoke(IPC.AI_CHAT, req),
    onChatStream: (callback: (chunk: ChatChunk) => void) => {
      const handler = (_: unknown, chunk: ChatChunk) => callback(chunk)
      ipcRenderer.on(IPC.AI_CHAT_STREAM, handler)
      return () => ipcRenderer.removeListener(IPC.AI_CHAT_STREAM, handler)
    },
    models: () => ipcRenderer.invoke(IPC.AI_MODELS) as Promise<Array<{ id: string; name: string; provider: string; isLocal: boolean }>>,
    stop: (conversationId: string) => ipcRenderer.invoke(IPC.AI_STOP, conversationId),
  },

  // ??? Computer Use ?????????????????????????????
  computer: {
    screenshot: () => ipcRenderer.invoke(IPC.COMPUTER_SCREENSHOT) as Promise<ScreenCaptureResult>,
  },

  // ??? File System ??????????????????????????????
  fs: {
    read: (path: string) => ipcRenderer.invoke(IPC.FS_READ, { path }) as Promise<string>,
    write: (path: string, content: string) => ipcRenderer.invoke(IPC.FS_WRITE, { path, content }),
    delete: (path: string) => ipcRenderer.invoke(IPC.FS_DELETE, { path }),
    list: (dir: string) => ipcRenderer.invoke(IPC.FS_LIST, { dir }) as Promise<FileEntry[]>,
    pick: (request: FilePickRequest) => ipcRenderer.invoke(IPC.FS_PICK, request) as Promise<FilePickResult>,
    secureDelete: (path: string) => ipcRenderer.invoke(IPC.FS_SECURE_DELETE, path) as Promise<{ success: boolean; path: string; size: number; error?: string }>,
  },

  // ??? Shell ????????????????????????????????????
  shell: {
    exec: (command: string, cwd?: string) =>
      ipcRenderer.invoke(IPC.SHELL_EXEC, { command, cwd }) as Promise<{
        stdout: string
        stderr: string
        exitCode: number
      }>,
  },

  // ??? Settings ?????????????????????????????????
  settings: {
    get: () => ipcRenderer.invoke(IPC.SETTINGS_GET) as Promise<AppSettings>,
    set: (partial: Partial<AppSettings>) => ipcRenderer.invoke(IPC.SETTINGS_SET, partial),
  },

  updates: {
    status: () => ipcRenderer.invoke(IPC.UPDATER_STATUS) as Promise<UpdaterStatus>,
    checkNow: () => ipcRenderer.invoke(IPC.UPDATER_CHECK_NOW) as Promise<UpdaterStatus>,
    download: () => ipcRenderer.invoke(IPC.UPDATER_DOWNLOAD) as Promise<UpdaterStatus>,
    install: () => ipcRenderer.invoke(IPC.UPDATER_INSTALL) as Promise<{ queued: boolean }>,
  },

  // ??? Permissions ??????????????????????????????
  permissions: {
    get: () => ipcRenderer.invoke(IPC.PERMISSIONS_GET) as Promise<PermissionGrant>,
    grant: (request?: PermissionGrantRequest) =>
      ipcRenderer.invoke(IPC.PERMISSIONS_GRANT, request) as Promise<PermissionGrant>,
    revoke: (request?: PermissionRevokeRequest) =>
      ipcRenderer.invoke(IPC.PERMISSIONS_REVOKE, request) as Promise<PermissionGrant>,
    issueCapability: (request: CapabilityGrantRequest) =>
      ipcRenderer.invoke(IPC.PERMISSIONS_ISSUE_CAPABILITY, request) as Promise<CapabilityGrantResponse>,
  },

  // ??? Conversations ??????????????????????????????
  conversations: {
    load: () => ipcRenderer.invoke(IPC.CONVERSATIONS_LOAD) as Promise<StoredConversation[]>,
    save: (conversations: StoredConversation[]) => ipcRenderer.invoke(IPC.CONVERSATIONS_SAVE, conversations),
    softDelete: (id: string) => ipcRenderer.invoke(IPC.CONVERSATIONS_SOFT_DELETE, id) as Promise<boolean>,
    restore: (id: string) => ipcRenderer.invoke(IPC.CONVERSATIONS_RESTORE, id) as Promise<StoredConversation | null>,
    trashList: () => ipcRenderer.invoke(IPC.CONVERSATIONS_TRASH_LIST) as Promise<Array<{ id: string; title: string; deletedAt: number; messageCount: number }>>,
    trashPermanentDelete: (id: string) => ipcRenderer.invoke(IPC.CONVERSATIONS_TRASH_PERMANENT_DELETE, id) as Promise<boolean>,
  },

  // ??? Notes ??????????????????????????????????????
  notes: {
    load: () => ipcRenderer.invoke(IPC.NOTES_LOAD) as Promise<Note[]>,
    save: (notes: Note[]) => ipcRenderer.invoke(IPC.NOTES_SAVE, notes),
  },

  // ??? AI Extras ??????????????????????????????????
  aiExtras: {
    validateKey: (apiKey: string) => ipcRenderer.invoke(IPC.AI_VALIDATE_KEY, apiKey) as Promise<{ valid: boolean; error?: string }>,
  },

  // ??? File Extras ????????????????????????????????
  fsExtras: {
    openPath: (filePath: string) => ipcRenderer.invoke(IPC.FS_OPEN_PATH, filePath),
  },

  credentials: {
    getSummary: () => ipcRenderer.invoke(IPC.CREDENTIALS_GET_SUMMARY) as Promise<CredentialVaultSummary>,
    importBrowserCsv: () => ipcRenderer.invoke(IPC.CREDENTIALS_IMPORT_BROWSER_CSV) as Promise<CredentialImportResult>,
    clear: () => ipcRenderer.invoke(IPC.CREDENTIALS_CLEAR) as Promise<{ success: boolean }>,
  },

  // ??? Notifications ?????????????????????????????
  notifications: {
    onNotification: (callback: (data: { title: string; body: string; level: string }) => void) => {
      const handler = (_: unknown, data: { title: string; body: string; level: string }) => callback(data)
      ipcRenderer.on(IPC.NOTIFICATION, handler)
      return () => ipcRenderer.removeListener(IPC.NOTIFICATION, handler)
    },
  },

  // ??? System ??????????????????????????????????????
  system: {
    desktopPath: () => ipcRenderer.invoke(IPC.SYSTEM_DESKTOP_PATH) as Promise<string>,
    detectLocale: () => ipcRenderer.invoke(IPC.LOCALE_DETECT) as Promise<'ko' | 'en' | 'ja'>,
    cleanTemp: () => ipcRenderer.invoke(IPC.SYSTEM_CLEAN_TEMP) as Promise<{ deletedCount: number; freedBytes: number; errors: string[] }>,
    startupList: () => ipcRenderer.invoke(IPC.SYSTEM_STARTUP_LIST) as Promise<Array<{ name: string; command: string; source: string; enabled: boolean; protected: boolean }>>,
    startupToggle: (name: string, source: string, enabled: boolean) => ipcRenderer.invoke(IPC.SYSTEM_STARTUP_TOGGLE, { name, source, enabled }) as Promise<{ success: boolean; error?: string }>,
  },

  // ??? Auth ????????????????????????????????????????
  auth: {
    login: (email: string, password: string) => ipcRenderer.invoke(IPC.AUTH_LOGIN, { email, password }) as Promise<{ success: boolean; user?: { id: string; email?: string; displayName?: string }; error?: string }>,
    signup: (email: string, password: string, displayName?: string) => ipcRenderer.invoke(IPC.AUTH_SIGNUP, { email, password, displayName }) as Promise<{ success: boolean; user?: { id: string; email?: string; displayName?: string }; error?: string }>,
    logout: () => ipcRenderer.invoke(IPC.AUTH_LOGOUT) as Promise<{ success: boolean; error?: string }>,
    session: () => ipcRenderer.invoke(IPC.AUTH_SESSION) as Promise<{ success: boolean; user?: { id: string; email?: string; displayName?: string }; error?: string }>,
    loginOtp: (phone: string) => ipcRenderer.invoke(IPC.AUTH_LOGIN_OTP, { phone }) as Promise<{ success: boolean; error?: string }>,
    verifyOtp: (phone: string, token: string) => ipcRenderer.invoke(IPC.AUTH_VERIFY_OTP, { phone, token }) as Promise<{ success: boolean; user?: { id: string; email?: string; displayName?: string }; error?: string }>,
  },

  // ??? Sync ???????????????????????????????????????
  sync: {
    push: (userId: string, dataType: string, data: string) => ipcRenderer.invoke(IPC.SYNC_PUSH, { userId, dataType, data }) as Promise<{ success: boolean; error?: string }>,
    pull: (userId: string, dataType: string) => ipcRenderer.invoke(IPC.SYNC_PULL, { userId, dataType }) as Promise<{ success: boolean; data?: string; error?: string }>,
    status: () => ipcRenderer.invoke(IPC.SYNC_STATUS) as Promise<{ lastSynced: number; pending: number; status: string; error?: string }>,
  },

  collaboration: {
    status: () => ipcRenderer.invoke(IPC.COLLABORATION_STATUS) as Promise<CollaborationSessionStatus>,
    start: (request: CollaborationStartRequest) => ipcRenderer.invoke(IPC.COLLABORATION_START, request) as Promise<CollaborationSessionStatus>,
    join: (request: CollaborationJoinRequest) => ipcRenderer.invoke(IPC.COLLABORATION_JOIN, request) as Promise<CollaborationSessionStatus>,
    leave: () => ipcRenderer.invoke(IPC.COLLABORATION_LEAVE) as Promise<CollaborationSessionStatus>,
    syncConversation: (conversation: StoredConversation) => ipcRenderer.invoke(IPC.COLLABORATION_SYNC_CONVERSATION, conversation),
    syncDraft: (draft: CollaborationDraftUpdate) => ipcRenderer.invoke(IPC.COLLABORATION_SYNC_DRAFT, draft),
    onStatusChanged: (callback: (status: CollaborationSessionStatus) => void) => {
      const handler = (_: unknown, status: CollaborationSessionStatus) => callback(status)
      ipcRenderer.on(IPC.COLLABORATION_STATUS_CHANGED, handler)
      return () => ipcRenderer.removeListener(IPC.COLLABORATION_STATUS_CHANGED, handler)
    },
    onRemoteConversation: (callback: (event: CollaborationRemoteConversation) => void) => {
      const handler = (_: unknown, event: CollaborationRemoteConversation) => callback(event)
      ipcRenderer.on(IPC.COLLABORATION_REMOTE_CONVERSATION, handler)
      return () => ipcRenderer.removeListener(IPC.COLLABORATION_REMOTE_CONVERSATION, handler)
    },
    onRemoteDraft: (callback: (event: CollaborationRemoteDraft) => void) => {
      const handler = (_: unknown, event: CollaborationRemoteDraft) => callback(event)
      ipcRenderer.on(IPC.COLLABORATION_REMOTE_DRAFT, handler)
      return () => ipcRenderer.removeListener(IPC.COLLABORATION_REMOTE_DRAFT, handler)
    },
  },

  // ??? Memory (long-term preferences) ????????????
  memory: {
    load: () => ipcRenderer.invoke(IPC.MEMORY_LOAD) as Promise<{ facts: Array<{ key: string; value: string; learnedAt: number; source: string }>; preferences: Array<{ key: string; value: string; learnedAt: number; source: string }> }>,
    save: (memory: { facts: Array<{ key: string; value: string; learnedAt: number; source: string }>; preferences: Array<{ key: string; value: string; learnedAt: number; source: string }> }) => ipcRenderer.invoke(IPC.MEMORY_SAVE, memory),
  },

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??  // ??? Infrastructure (Phase 0) ?????????????????
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // ??? System Monitor ????????????????????????????
  systemMonitor: {
    start: () => ipcRenderer.invoke(IPC.MONITOR_START),
    stop: () => ipcRenderer.invoke(IPC.MONITOR_STOP),
    getLatest: () => ipcRenderer.invoke(IPC.MONITOR_GET_LATEST) as Promise<SystemMetrics | null>,
    getProcesses: () => ipcRenderer.invoke(IPC.MONITOR_PROCESSES) as Promise<ProcessInfo[]>,
    onMetrics: (callback: (metrics: SystemMetrics) => void) => {
      const handler = (_: unknown, metrics: SystemMetrics) => callback(metrics)
      ipcRenderer.on(IPC.MONITOR_METRICS, handler)
      return () => ipcRenderer.removeListener(IPC.MONITOR_METRICS, handler)
    },
  },

  // ??? Context Manager ??????????????????????????
  context: {
    getSnapshot: () => ipcRenderer.invoke(IPC.CONTEXT_GET_SNAPSHOT) as Promise<ContextSnapshot>,
    onChanged: (callback: (snapshot: ContextSnapshot) => void) => {
      const handler = (_: unknown, snapshot: ContextSnapshot) => callback(snapshot)
      ipcRenderer.on(IPC.CONTEXT_CHANGED, handler)
      return () => ipcRenderer.removeListener(IPC.CONTEXT_CHANGED, handler)
    },
  },

  // ??? Hotkey Manager ???????????????????????????
  hotkey: {
    list: () => ipcRenderer.invoke(IPC.HOTKEY_LIST) as Promise<HotkeyBinding[]>,
    set: (binding: HotkeyBinding) => ipcRenderer.invoke(IPC.HOTKEY_SET, binding) as Promise<boolean>,
    remove: (id: string) => ipcRenderer.invoke(IPC.HOTKEY_REMOVE, id),
    onTriggered: (callback: (data: { id: string; action: string }) => void) => {
      const handler = (_: unknown, data: { id: string; action: string }) => callback(data)
      ipcRenderer.on(IPC.HOTKEY_TRIGGERED, handler)
      return () => ipcRenderer.removeListener(IPC.HOTKEY_TRIGGERED, handler)
    },
  },

  // ??? Workflow Engine ??????????????????????????
  workflow: {
    list: () => ipcRenderer.invoke(IPC.WORKFLOW_LIST) as Promise<WorkflowDefinition[]>,
    create: (def: Partial<WorkflowDefinition>) => ipcRenderer.invoke(IPC.WORKFLOW_CREATE, def) as Promise<string>,
    delete: (id: string) => ipcRenderer.invoke(IPC.WORKFLOW_DELETE, id) as Promise<boolean>,
    execute: (id: string) => ipcRenderer.invoke(IPC.WORKFLOW_EXECUTE, id) as Promise<WorkflowRun>,
    pause: (runId: string) => ipcRenderer.invoke(IPC.WORKFLOW_PAUSE, runId),
    resume: (runId: string) => ipcRenderer.invoke(IPC.WORKFLOW_RESUME, runId),
    cancel: (runId: string) => ipcRenderer.invoke(IPC.WORKFLOW_CANCEL, runId),
    listRuns: (workflowId?: string) => ipcRenderer.invoke(IPC.WORKFLOW_LIST_RUNS, workflowId) as Promise<WorkflowRun[]>,
    schedule: (id: string, intervalMs: number) => ipcRenderer.invoke(IPC.WORKFLOW_SCHEDULE, { id, intervalMs }) as Promise<string>,
    unschedule: (scheduleId: string) => ipcRenderer.invoke(IPC.WORKFLOW_UNSCHEDULE, scheduleId),
    onProgress: (callback: (progress: WorkflowProgress) => void) => {
      const handler = (_: unknown, progress: WorkflowProgress) => callback(progress)
      ipcRenderer.on(IPC.WORKFLOW_PROGRESS, handler)
      return () => ipcRenderer.removeListener(IPC.WORKFLOW_PROGRESS, handler)
    },
  },

  // ??? Plugin Manager ???????????????????????????
  plugin: {
    list: () => ipcRenderer.invoke(IPC.PLUGIN_LIST) as Promise<InstalledPlugin[]>,
    install: (source: string) => ipcRenderer.invoke(IPC.PLUGIN_INSTALL, source) as Promise<InstalledPlugin>,
    uninstall: (id: string) => ipcRenderer.invoke(IPC.PLUGIN_UNINSTALL, id),
    enable: (id: string) => ipcRenderer.invoke(IPC.PLUGIN_ENABLE, id),
    disable: (id: string) => ipcRenderer.invoke(IPC.PLUGIN_DISABLE, id),
  },

  // ??? Clipboard Manager ????????????????????????
  clipboardManager: {
    history: () => ipcRenderer.invoke(IPC.CLIPBOARD_HISTORY) as Promise<ClipboardEntry[]>,
    pin: (id: string) => ipcRenderer.invoke(IPC.CLIPBOARD_PIN, id),
    unpin: (id: string) => ipcRenderer.invoke(IPC.CLIPBOARD_UNPIN, id),
    transform: (id: string, format: ClipboardTransformFormat) => ipcRenderer.invoke(IPC.CLIPBOARD_TRANSFORM, { id, format }) as Promise<string>,
    clear: () => ipcRenderer.invoke(IPC.CLIPBOARD_CLEAR),
  },

  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??  // ??? Phase 1?? Features ???????????????????????
  // ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧??
  // ??? RAG Knowledge Base (F3) ??????????????????
  rag: {
    list: () => ipcRenderer.invoke(IPC.RAG_LIST) as Promise<{ documents: RagDocument[]; totalEntries: number }>,
    indexFile: (path: string) => ipcRenderer.invoke(IPC.RAG_INDEX_FILE, path) as Promise<RagIndexFileResult>,
    indexFolder: (path: string) => ipcRenderer.invoke(IPC.RAG_INDEX_FOLDER, path) as Promise<RagIndexFolderResult>,
    remove: (id: string) => ipcRenderer.invoke(IPC.RAG_REMOVE, id),
    search: (query: string, topK?: number) => ipcRenderer.invoke(IPC.RAG_SEARCH, { query, topK }) as Promise<{ results: RagSearchResult[]; totalDocuments: number }>,
    onProgress: (callback: (progress: RagIndexProgress) => void) => {
      const handler = (_: unknown, progress: RagIndexProgress) => callback(progress)
      ipcRenderer.on(IPC.RAG_PROGRESS, handler)
      return () => ipcRenderer.removeListener(IPC.RAG_PROGRESS, handler)
    },
  },

  // ??? Proactive Intelligence (F4) ??????????????
  proactive: {
    list: () => ipcRenderer.invoke(IPC.PROACTIVE_LIST) as Promise<Suggestion[]>,
    dismiss: (id: string) => ipcRenderer.invoke(IPC.PROACTIVE_DISMISS, id),
    configure: (config: Record<string, unknown>) => ipcRenderer.invoke(IPC.PROACTIVE_CONFIGURE, config),
    onSuggestion: (callback: (suggestion: Suggestion) => void) => {
      const handler = (_: unknown, suggestion: Suggestion) => callback(suggestion)
      ipcRenderer.on(IPC.PROACTIVE_SUGGESTION, handler)
      return () => ipcRenderer.removeListener(IPC.PROACTIVE_SUGGESTION, handler)
    },
  },

  // ??? Vision (F2) ??????????????????????????????
  vision: {
    ocr: (region?: { x: number; y: number; width: number; height: number }) => ipcRenderer.invoke(IPC.VISION_OCR, region) as Promise<OcrResult>,
    analyzeUI: () => ipcRenderer.invoke(IPC.VISION_ANALYZE_UI) as Promise<UiAnalysisResult>,
    findElement: (query: string) => ipcRenderer.invoke(IPC.VISION_FIND_ELEMENT, query) as Promise<UiElement | null>,
  },

  // ??? Voice (F7) ???????????????????????????????
  voice: {
    listenStart: () => ipcRenderer.invoke(IPC.VOICE_LISTEN_START),
    listenStop: () => ipcRenderer.invoke(IPC.VOICE_LISTEN_STOP),
    onStatus: (callback: (status: VoiceStatusEvent) => void) => {
      const handler = (_: unknown, status: VoiceStatusEvent) => callback(status)
      ipcRenderer.on(IPC.VOICE_STATUS, handler)
      return () => ipcRenderer.removeListener(IPC.VOICE_STATUS, handler)
    },
  },

  // ??? Orchestration / App Control (F5) ?????????
  appControl: {
    launch: (name: string, args?: string | string[]) =>
      ipcRenderer.invoke(IPC.APP_LAUNCH, { name, args }) as Promise<{ pid: number }>,
    close: (name: string) =>
      ipcRenderer.invoke(IPC.APP_CLOSE, name) as Promise<{ closed: number }>,
    sendKeys: (keys: string) =>
      ipcRenderer.invoke(IPC.APP_SEND_KEYS, keys) as Promise<void>,
    listRunning: () =>
      ipcRenderer.invoke(IPC.APP_LIST_RUNNING) as Promise<Array<{ name: string; pid: number; title: string }>>,
  },

  // ??? Image Processing (F10) ???????????????????
  image: {
    resize: (path: string, width: number, height: number, outputPath?: string) => ipcRenderer.invoke(IPC.IMAGE_RESIZE, { path, width, height, outputPath }) as Promise<{ outputPath: string }>,
    crop: (path: string, left: number, top: number, width: number, height: number, outputPath?: string) => ipcRenderer.invoke(IPC.IMAGE_CROP, { path, left, top, width, height, outputPath }) as Promise<{ outputPath: string }>,
    convert: (path: string, format: 'png' | 'jpeg' | 'webp', quality?: number, outputPath?: string) => ipcRenderer.invoke(IPC.IMAGE_CONVERT, { path, format, quality, outputPath }) as Promise<{ outputPath: string }>,
    compress: (path: string, quality?: number, outputPath?: string) => ipcRenderer.invoke(IPC.IMAGE_COMPRESS, { path, quality, outputPath }) as Promise<{ outputPath: string }>,
    info: (path: string) => ipcRenderer.invoke(IPC.IMAGE_INFO, path) as Promise<ImageInfo>,
    generate: (prompt: string, outputPath?: string) =>
      ipcRenderer.invoke(IPC.IMAGE_GENERATE, { prompt, outputPath }) as Promise<{ outputPath?: string; base64: string; revisedPrompt?: string }>,
  },


  // ─── Google OAuth ───────────────────────────────
  googleOAuth: {
    start: (clientId?: string) => ipcRenderer.invoke(IPC.GOOGLE_OAUTH_START, clientId) as Promise<{ success: boolean; error?: string }>,
    status: () => ipcRenderer.invoke(IPC.GOOGLE_OAUTH_STATUS) as Promise<{ authenticated: boolean }>,
    logout: () => ipcRenderer.invoke(IPC.GOOGLE_OAUTH_LOGOUT) as Promise<{ success: boolean }>,
  },
  naverOAuth: {
    start: () => ipcRenderer.invoke(IPC.NAVER_OAUTH_START) as Promise<{ success: boolean; error?: string }>,
    status: () => ipcRenderer.invoke(IPC.NAVER_OAUTH_STATUS) as Promise<ExternalOAuthStatus>,
    logout: () => ipcRenderer.invoke(IPC.NAVER_OAUTH_LOGOUT) as Promise<{ success: boolean }>,
  },
  kakaoOAuth: {
    start: () => ipcRenderer.invoke(IPC.KAKAO_OAUTH_START) as Promise<{ success: boolean; error?: string }>,
    status: () => ipcRenderer.invoke(IPC.KAKAO_OAUTH_STATUS) as Promise<ExternalOAuthStatus>,
    logout: () => ipcRenderer.invoke(IPC.KAKAO_OAUTH_LOGOUT) as Promise<{ success: boolean }>,
  },

  // ??? Email (F11) ??????????????????????????????
  email: {
    list: (limit?: number) => ipcRenderer.invoke(IPC.EMAIL_LIST, limit) as Promise<EmailEntry[]>,
    read: (id: string) => ipcRenderer.invoke(IPC.EMAIL_READ, id) as Promise<EmailFull | null>,
    send: (to: string[], subject: string, body: string) => ipcRenderer.invoke(IPC.EMAIL_SEND, { to, subject, body }) as Promise<{ success: boolean; error?: string }>,
    isConfigured: () => ipcRenderer.invoke(IPC.EMAIL_CONFIGURED) as Promise<boolean>,
    status: () => ipcRenderer.invoke(IPC.EMAIL_STATUS) as Promise<EmailAccountStatus>,
    saveConfig: (config: EmailAccountConfigInput) => ipcRenderer.invoke(IPC.EMAIL_SAVE_CONFIG, config) as Promise<EmailAccountStatus>,
    clearConfig: () => ipcRenderer.invoke(IPC.EMAIL_CLEAR_CONFIG) as Promise<EmailAccountStatus>,
  },

  // ??? Calendar (F12) ???????????????????????????
  calendar: {
    listEvents: (startDate: string, endDate: string) => ipcRenderer.invoke(IPC.CALENDAR_LIST_EVENTS, { startDate, endDate }) as Promise<CalendarEvent[]>,
    createEvent: (event: Partial<CalendarEvent>) =>
      ipcRenderer.invoke(IPC.CALENDAR_CREATE_EVENT, event) as Promise<{ success: boolean; eventId?: string; error?: string }>,
    deleteEvent: (id: string) =>
      ipcRenderer.invoke(IPC.CALENDAR_DELETE_EVENT, id) as Promise<{ success: boolean; error?: string }>,
    findFreeTime: (date: string, durationMinutes: number) =>
      ipcRenderer.invoke(IPC.CALENDAR_FIND_FREE_TIME, { date, durationMinutes }) as Promise<Array<{ start: number; end: number }>>,
    status: () => ipcRenderer.invoke(IPC.CALENDAR_STATUS) as Promise<CalendarAccountStatus>,
    saveConfig: (config: CalendarAccountConfigInput) =>
      ipcRenderer.invoke(IPC.CALENDAR_SAVE_CONFIG, config) as Promise<CalendarAccountStatus>,
    clearConfig: () => ipcRenderer.invoke(IPC.CALENDAR_CLEAR_CONFIG) as Promise<CalendarAccountStatus>,
  },

  finance: {
    status: () => ipcRenderer.invoke(IPC.FINANCE_STATUS) as Promise<FinanceAccountStatus>,
    saveConfig: (config: FinanceAccountConfigInput) =>
      ipcRenderer.invoke(IPC.FINANCE_SAVE_CONFIG, config) as Promise<FinanceAccountStatus>,
    clearConfig: () => ipcRenderer.invoke(IPC.FINANCE_CLEAR_CONFIG) as Promise<FinanceAccountStatus>,
    accountSummary: () =>
      ipcRenderer.invoke(IPC.FINANCE_ACCOUNT_SUMMARY) as Promise<FinanceAccountSummary>,
    transactions: (query: FinanceTransactionQuery) =>
      ipcRenderer.invoke(IPC.FINANCE_TRANSACTIONS, query) as Promise<FinanceTransactionEntry[]>,
    transfer: (draft: FinanceTransferDraft) =>
      ipcRenderer.invoke(IPC.FINANCE_TRANSFER, draft) as Promise<FinanceTransferResult>,
  },

  publicData: {
    status: () => ipcRenderer.invoke(IPC.PUBLIC_DATA_STATUS) as Promise<PublicDataAccountStatus>,
    saveConfig: (config: PublicDataAccountConfigInput) =>
      ipcRenderer.invoke(IPC.PUBLIC_DATA_SAVE_CONFIG, config) as Promise<PublicDataAccountStatus>,
    clearConfig: () =>
      ipcRenderer.invoke(IPC.PUBLIC_DATA_CLEAR_CONFIG) as Promise<PublicDataAccountStatus>,
    query: (request: PublicDataQuery) =>
      ipcRenderer.invoke(IPC.PUBLIC_DATA_QUERY, request) as Promise<PublicDataQueryResult>,
    businessStatus: (request: PublicBusinessStatusLookup) =>
      ipcRenderer.invoke(IPC.PUBLIC_DATA_BUSINESS_STATUS, request) as Promise<PublicBusinessStatusEntry[]>,
  },

  tax: {
    status: () => ipcRenderer.invoke(IPC.TAX_STATUS) as Promise<TaxAccountStatus>,
    saveConfig: (config: TaxAccountConfigInput) =>
      ipcRenderer.invoke(IPC.TAX_SAVE_CONFIG, config) as Promise<TaxAccountStatus>,
    clearConfig: () => ipcRenderer.invoke(IPC.TAX_CLEAR_CONFIG) as Promise<TaxAccountStatus>,
    businessStatus: (request: TaxBusinessStatusLookup) =>
      ipcRenderer.invoke(IPC.TAX_BUSINESS_STATUS, request) as Promise<TaxBusinessStatusEntry[]>,
    hometaxEvidence: (query: HometaxEvidenceQuery) =>
      ipcRenderer.invoke(IPC.TAX_HOMETAX_EVIDENCE, query) as Promise<HometaxEvidenceEntry[]>,
  },

  // ??? Macro (F13) ??????????????????????????????
  macro: {
    list: () => ipcRenderer.invoke(IPC.MACRO_LIST) as Promise<MacroEntry[]>,
    recordStart: () => ipcRenderer.invoke(IPC.MACRO_RECORD_START),
    recordStop: (name: string) => ipcRenderer.invoke(IPC.MACRO_RECORD_STOP, name) as Promise<MacroEntry>,
    play: (id: string) => ipcRenderer.invoke(IPC.MACRO_PLAY, id),
    delete: (id: string) => ipcRenderer.invoke(IPC.MACRO_DELETE, id),
    onStatus: (callback: (data: { recording: boolean; playing: boolean }) => void) => {
      const handler = (_: unknown, data: { recording: boolean; playing: boolean }) => callback(data)
      ipcRenderer.on(IPC.MACRO_STATUS, handler)
      return () => ipcRenderer.removeListener(IPC.MACRO_STATUS, handler)
    },
  },

  // ??? File Organization (F14) ??????????????????
  fileOrg: {
    preview: (path: string) => ipcRenderer.invoke(IPC.FILE_ORG_PREVIEW, path) as Promise<FileOrgPreview>,
    organize: (path: string) => ipcRenderer.invoke(IPC.FILE_ORG_ORGANIZE, path) as Promise<{ moved: number; errors: string[] }>,
    findDuplicates: (path: string) => ipcRenderer.invoke(IPC.FILE_ORG_FIND_DUPLICATES, path) as Promise<DuplicateGroup[]>,
  },

  // ??? Multi-Monitor (F16) ??????????????????????
  monitors: {
    list: () => ipcRenderer.invoke(IPC.MONITORS_LIST) as Promise<DisplayInfo[]>,
    screenshot: (displayId: number) => ipcRenderer.invoke(IPC.MONITORS_SCREENSHOT, displayId) as Promise<string>,
  },

  // ??? Marketplace (F18) ????????????????????????
  // MCP (F15)
  mcp: {
    listServers: () => ipcRenderer.invoke(IPC.MCP_LIST_SERVERS) as Promise<McpServerStatus[]>,
    addServer: (config: McpServerConfig) => ipcRenderer.invoke(IPC.MCP_ADD_SERVER, config),
    removeServer: (id: string) => ipcRenderer.invoke(IPC.MCP_REMOVE_SERVER, id),
    connectServer: (id: string) => ipcRenderer.invoke(IPC.MCP_CONNECT_SERVER, id),
    disconnectServer: (id: string) => ipcRenderer.invoke(IPC.MCP_DISCONNECT_SERVER, id),
    listTools: (serverId?: string) => ipcRenderer.invoke(IPC.MCP_LIST_TOOLS, serverId) as Promise<McpToolInfo[]>,
    callTool: (serverId: string, toolName: string, args: Record<string, unknown>) =>
      ipcRenderer.invoke(IPC.MCP_CALL_TOOL, { serverId, toolName, args }) as Promise<unknown>,
  },
  marketplace: {
    search: (query: string) => ipcRenderer.invoke(IPC.MARKETPLACE_SEARCH, query) as Promise<MarketplaceEntry[]>,
    install: (id: string) => ipcRenderer.invoke(IPC.MARKETPLACE_INSTALL, id) as Promise<InstalledPlugin>,
    update: (id: string) => ipcRenderer.invoke(IPC.MARKETPLACE_UPDATE, id) as Promise<InstalledPlugin>,
  },
}

contextBridge.exposeInMainWorld('usan', api)

export type UsanAPI = typeof api

