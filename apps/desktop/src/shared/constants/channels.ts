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

  // Permissions
  PERMISSIONS_GET: 'permissions:get',
  PERMISSIONS_GRANT: 'permissions:grant',
  PERMISSIONS_REVOKE: 'permissions:revoke',

  // Conversations
  CONVERSATIONS_LOAD: 'conversations:load',
  CONVERSATIONS_SAVE: 'conversations:save',

  // Notes
  NOTES_LOAD: 'notes:load',
  NOTES_SAVE: 'notes:save',

  // AI validation
  AI_VALIDATE_KEY: 'ai:validate-key',

  // File system extras
  FS_OPEN_PATH: 'fs:open-path',

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

  // System optimization
  SYSTEM_CLEAN_TEMP: 'system:clean-temp',
  SYSTEM_STARTUP_LIST: 'system:startup-list',
  SYSTEM_STARTUP_TOGGLE: 'system:startup-toggle',

  // System
  SYSTEM_DESKTOP_PATH: 'system:desktop-path',
  LOCALE_DETECT: 'locale:detect',
} as const
