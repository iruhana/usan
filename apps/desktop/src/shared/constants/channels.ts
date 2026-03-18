/** IPC channel name constants */
export const IPC = {
  // AI
  AI_CHAT: 'ai:chat',
  AI_CHAT_STREAM: 'ai:chat-stream',
  AI_MODELS: 'ai:models',
  AI_STOP: 'ai:stop',

  // Computer Use
  COMPUTER_SCREENSHOT: 'computer:screenshot',

  // File System
  FS_READ: 'fs:read',
  FS_WRITE: 'fs:write',
  FS_DELETE: 'fs:delete',
  FS_LIST: 'fs:list',

  // Shell
  SHELL_EXEC: 'shell:exec',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // Updater
  UPDATER_STATUS: 'updater:status',
  UPDATER_CHECK_NOW: 'updater:check-now',
  UPDATER_DOWNLOAD: 'updater:download',
  UPDATER_INSTALL: 'updater:install',

  // Permissions
  PERMISSIONS_GET: 'permissions:get',
  PERMISSIONS_GRANT: 'permissions:grant',
  PERMISSIONS_REVOKE: 'permissions:revoke',
  PERMISSIONS_ISSUE_CAPABILITY: 'permissions:issue-capability',

  // Conversations
  CONVERSATIONS_LOAD: 'conversations:load',
  CONVERSATIONS_SAVE: 'conversations:save',
  CONVERSATIONS_SOFT_DELETE: 'conversations:soft-delete',
  CONVERSATIONS_RESTORE: 'conversations:restore',
  CONVERSATIONS_TRASH_LIST: 'conversations:trash-list',
  CONVERSATIONS_TRASH_PERMANENT_DELETE: 'conversations:trash-permanent-delete',

  // Notes
  NOTES_LOAD: 'notes:load',
  NOTES_SAVE: 'notes:save',

  // AI validation
  AI_VALIDATE_KEY: 'ai:validate-key',

  // File system extras
  FS_PICK: 'fs:pick',
  FS_OPEN_PATH: 'fs:open-path',

  // Browser credentials (CSV import)
  CREDENTIALS_GET_SUMMARY: 'credentials:get-summary',
  CREDENTIALS_IMPORT_BROWSER_CSV: 'credentials:import-browser-csv',
  CREDENTIALS_CLEAR: 'credentials:clear',

  // Notifications
  NOTIFICATION: 'notification',

  // Memory
  MEMORY_LOAD: 'memory:load',
  MEMORY_SAVE: 'memory:save',

  // File system: secure delete
  FS_SECURE_DELETE: 'fs:secure-delete',

  // Auth
  AUTH_LOGIN: 'auth:login',
  AUTH_SIGNUP: 'auth:signup',
  AUTH_LOGOUT: 'auth:logout',
  AUTH_SESSION: 'auth:session',
  AUTH_LOGIN_OTP: 'auth:login-otp',
  AUTH_VERIFY_OTP: 'auth:verify-otp',

  // Sync
  SYNC_PUSH: 'sync:push',
  SYNC_PULL: 'sync:pull',
  SYNC_STATUS: 'sync:status',

  // Collaboration
  COLLABORATION_STATUS: 'collaboration:status',
  COLLABORATION_START: 'collaboration:start',
  COLLABORATION_JOIN: 'collaboration:join',
  COLLABORATION_LEAVE: 'collaboration:leave',
  COLLABORATION_SYNC_CONVERSATION: 'collaboration:sync-conversation',
  COLLABORATION_SYNC_DRAFT: 'collaboration:sync-draft',
  COLLABORATION_STATUS_CHANGED: 'collaboration:status-changed',
  COLLABORATION_REMOTE_CONVERSATION: 'collaboration:remote-conversation',
  COLLABORATION_REMOTE_DRAFT: 'collaboration:remote-draft',

  // System optimization
  SYSTEM_CLEAN_TEMP: 'system:clean-temp',
  SYSTEM_STARTUP_LIST: 'system:startup-list',
  SYSTEM_STARTUP_TOGGLE: 'system:startup-toggle',

  // System
  SYSTEM_DESKTOP_PATH: 'system:desktop-path',
  LOCALE_DETECT: 'locale:detect',

  // ─── Infrastructure (Phase 0) ──────────────────

  // System Monitor
  MONITOR_START: 'monitor:start',
  MONITOR_STOP: 'monitor:stop',
  MONITOR_GET_LATEST: 'monitor:get-latest',
  MONITOR_METRICS: 'monitor:metrics',
  MONITOR_PROCESSES: 'monitor:processes',

  // Context Manager
  CONTEXT_GET_SNAPSHOT: 'context:get-snapshot',
  CONTEXT_CHANGED: 'context:changed',

  // Hotkey Manager
  HOTKEY_LIST: 'hotkey:list',
  HOTKEY_SET: 'hotkey:set',
  HOTKEY_REMOVE: 'hotkey:remove',
  HOTKEY_TRIGGERED: 'hotkey:triggered',

  // Workflow Engine
  WORKFLOW_LIST: 'workflow:list',
  WORKFLOW_CREATE: 'workflow:create',
  WORKFLOW_DELETE: 'workflow:delete',
  WORKFLOW_EXECUTE: 'workflow:execute',
  WORKFLOW_PAUSE: 'workflow:pause',
  WORKFLOW_RESUME: 'workflow:resume',
  WORKFLOW_CANCEL: 'workflow:cancel',
  WORKFLOW_LIST_RUNS: 'workflow:list-runs',
  WORKFLOW_PROGRESS: 'workflow:progress',
  WORKFLOW_SCHEDULE: 'workflow:schedule',
  WORKFLOW_UNSCHEDULE: 'workflow:unschedule',

  // Plugin Manager
  PLUGIN_LIST: 'plugin:list',
  PLUGIN_INSTALL: 'plugin:install',
  PLUGIN_UNINSTALL: 'plugin:uninstall',
  PLUGIN_ENABLE: 'plugin:enable',
  PLUGIN_DISABLE: 'plugin:disable',

  // Clipboard Manager
  CLIPBOARD_HISTORY: 'clipboard:history',
  CLIPBOARD_PIN: 'clipboard:pin',
  CLIPBOARD_UNPIN: 'clipboard:unpin',
  CLIPBOARD_TRANSFORM: 'clipboard:transform',
  CLIPBOARD_CLEAR: 'clipboard:clear',

  // RAG Knowledge Base
  RAG_LIST: 'rag:list',
  RAG_INDEX_FILE: 'rag:index-file',
  RAG_INDEX_FOLDER: 'rag:index-folder',
  RAG_REMOVE: 'rag:remove',
  RAG_SEARCH: 'rag:search',
  RAG_PROGRESS: 'rag:progress',

  // Proactive Intelligence
  PROACTIVE_LIST: 'proactive:list',
  PROACTIVE_DISMISS: 'proactive:dismiss',
  PROACTIVE_CONFIGURE: 'proactive:configure',
  PROACTIVE_SUGGESTION: 'proactive:suggestion',

  // Voice
  VOICE_STATUS: 'voice:status',
  VOICE_LISTEN_START: 'voice:listen-start',
  VOICE_LISTEN_STOP: 'voice:listen-stop',

  // ─── Phase 1–4 Features ─────────────────────────

  // Vision (F2)
  VISION_OCR: 'vision:ocr',
  VISION_ANALYZE_UI: 'vision:analyze-ui',
  VISION_FIND_ELEMENT: 'vision:find-element',

  // Orchestration / App Control (F5)
  APP_LAUNCH: 'app:launch',
  APP_CLOSE: 'app:close',
  APP_SEND_KEYS: 'app:send-keys',
  APP_LIST_RUNNING: 'app:list-running',

  // Image Processing (F10)
  IMAGE_RESIZE: 'image:resize',
  IMAGE_CROP: 'image:crop',
  IMAGE_CONVERT: 'image:convert',
  IMAGE_COMPRESS: 'image:compress',
  IMAGE_INFO: 'image:info',
  IMAGE_GENERATE: 'image:generate',

  // Google OAuth
  GOOGLE_OAUTH_START: 'google:oauth-start',
  GOOGLE_OAUTH_STATUS: 'google:oauth-status',
  GOOGLE_OAUTH_LOGOUT: 'google:oauth-logout',
  NAVER_OAUTH_START: 'naver:oauth-start',
  NAVER_OAUTH_STATUS: 'naver:oauth-status',
  NAVER_OAUTH_LOGOUT: 'naver:oauth-logout',
  KAKAO_OAUTH_START: 'kakao:oauth-start',
  KAKAO_OAUTH_STATUS: 'kakao:oauth-status',
  KAKAO_OAUTH_LOGOUT: 'kakao:oauth-logout',

  // Email (F11)
  EMAIL_LIST: 'email:list',
  EMAIL_READ: 'email:read',
  EMAIL_SEND: 'email:send',
  EMAIL_CONFIGURED: 'email:configured',
  EMAIL_STATUS: 'email:status',
  EMAIL_SAVE_CONFIG: 'email:save-config',
  EMAIL_CLEAR_CONFIG: 'email:clear-config',

  // Calendar (F12)
  CALENDAR_LIST_EVENTS: 'calendar:list-events',
  CALENDAR_CREATE_EVENT: 'calendar:create-event',
  CALENDAR_DELETE_EVENT: 'calendar:delete-event',
  CALENDAR_FIND_FREE_TIME: 'calendar:find-free-time',
  CALENDAR_STATUS: 'calendar:status',
  CALENDAR_SAVE_CONFIG: 'calendar:save-config',
  CALENDAR_CLEAR_CONFIG: 'calendar:clear-config',

  // Finance (F12.5)
  FINANCE_STATUS: 'finance:status',
  FINANCE_SAVE_CONFIG: 'finance:save-config',
  FINANCE_CLEAR_CONFIG: 'finance:clear-config',
  FINANCE_ACCOUNT_SUMMARY: 'finance:account-summary',
  FINANCE_TRANSACTIONS: 'finance:transactions',
  FINANCE_TRANSFER: 'finance:transfer',
  PUBLIC_DATA_STATUS: 'public-data:status',
  PUBLIC_DATA_SAVE_CONFIG: 'public-data:save-config',
  PUBLIC_DATA_CLEAR_CONFIG: 'public-data:clear-config',
  PUBLIC_DATA_QUERY: 'public-data:query',
  PUBLIC_DATA_BUSINESS_STATUS: 'public-data:business-status',
  TAX_STATUS: 'tax:status',
  TAX_SAVE_CONFIG: 'tax:save-config',
  TAX_CLEAR_CONFIG: 'tax:clear-config',
  TAX_BUSINESS_STATUS: 'tax:business-status',
  TAX_HOMETAX_EVIDENCE: 'tax:hometax-evidence',

  // Macro (F13)
  MACRO_LIST: 'macro:list',
  MACRO_RECORD_START: 'macro:record-start',
  MACRO_RECORD_STOP: 'macro:record-stop',
  MACRO_PLAY: 'macro:play',
  MACRO_DELETE: 'macro:delete',
  MACRO_STATUS: 'macro:status',

  // File Organization (F14)
  FILE_ORG_ORGANIZE: 'file-org:organize',
  FILE_ORG_PREVIEW: 'file-org:preview',
  FILE_ORG_FIND_DUPLICATES: 'file-org:find-duplicates',

  // Multi-Monitor (F16)
  MONITORS_LIST: 'monitors:list',
  MONITORS_SCREENSHOT: 'monitors:screenshot',

  // MCP (F15)
  MCP_LIST_SERVERS: 'mcp:list-servers',
  MCP_ADD_SERVER: 'mcp:add-server',
  MCP_REMOVE_SERVER: 'mcp:remove-server',
  MCP_CONNECT_SERVER: 'mcp:connect-server',
  MCP_DISCONNECT_SERVER: 'mcp:disconnect-server',
  MCP_LIST_TOOLS: 'mcp:list-tools',
  MCP_CALL_TOOL: 'mcp:call-tool',

  // Marketplace (F18)
  MARKETPLACE_SEARCH: 'marketplace:search',
  MARKETPLACE_INSTALL: 'marketplace:install',
  MARKETPLACE_UPDATE: 'marketplace:update',
} as const
