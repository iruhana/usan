import { t } from '../i18n'

const NETWORK_PATTERNS = ['network', 'fetch', 'timeout', 'timed out', 'offline', 'econn', 'socket']
const PERMISSION_PATTERNS = ['access is denied', 'permission', 'eacces', 'eperm', 'unauthorized', 'forbidden']
const NOT_FOUND_PATTERNS = ['not found', 'cannot find', 'no such file', 'enoent', 'missing']
const CONFIGURATION_PATTERNS = ['not configured', 'not set up', 'missing credential', 'missing credentials', 'no account configured']
const INVALID_JSON_PATTERNS = ['invalid json', 'unexpected token', 'json parse', 'json']
const INVALID_EMAIL_PATTERNS = ['invalid email', 'email address', 'recipient']
const PATH_PATTERNS = ['full path', 'absolute path', 'relative path', 'custom path', 'assistant']
const MICROPHONE_PATTERNS = ['microphone', 'audio', 'record', 'recorder', 'node-record-lpcm16', 'sox', 'device']
const TRANSCRIBE_PATTERNS = ['stt', 'whisper', 'speech', 'transcribe', 'recognize']
const API_KEY_PATTERNS = ['api key', 'api키', 'openrouter', 'bearer', '401', '403']
const RATE_LIMIT_PATTERNS = ['rate limit', 'too many requests', '429', 'quota']

function normalizeMessage(input: unknown): string {
  if (typeof input === 'string') {
    return input.trim()
  }

  if (input instanceof Error) {
    return input.message.trim()
  }

  if (input == null) {
    return ''
  }

  return String(input).trim()
}

function includesAny(message: string, patterns: string[]): boolean {
  const normalized = message.toLowerCase()
  return patterns.some((pattern) => normalized.includes(pattern))
}

export function toAuthErrorMessage(input: unknown, action: 'login' | 'signup'): string {
  const message = normalizeMessage(input)

  if (!message) {
    return t(action === 'login' ? 'account.loginFailed' : 'account.signupFailed')
  }

  if (includesAny(message, ['invalid login credentials', 'invalid credentials', 'bad credentials', 'login failed'])) {
    return t('account.invalidCredentials')
  }

  if (includesAny(message, NETWORK_PATTERNS)) {
    return t('account.networkError')
  }

  if (action === 'signup' && includesAny(message, ['already registered', 'already exists', 'user already registered', 'email already'])) {
    return t('account.emailTaken')
  }

  return t(action === 'login' ? 'account.loginFailed' : 'account.signupFailed')
}

export function toAppControlErrorMessage(
  input: unknown,
  action: 'load' | 'launch' | 'close' | 'sendKeys',
): string {
  const message = normalizeMessage(input)

  if (!message) {
    return t(`appLauncher.${action}Failed`)
  }

  if (includesAny(message, PATH_PATTERNS)) {
    return t('appLauncher.pathRequired')
  }

  if (includesAny(message, PERMISSION_PATTERNS)) {
    return t('appLauncher.permissionDenied')
  }

  if (includesAny(message, NOT_FOUND_PATTERNS)) {
    return t(action === 'launch' ? 'appLauncher.appNotFound' : `appLauncher.${action}Failed`)
  }

  return t(`appLauncher.${action}Failed`)
}

export function toUpdaterErrorMessage(input: unknown): string | null {
  const message = normalizeMessage(input)
  if (!message) return null

  if (includesAny(message, ['previous_run_unclean_exit'])) {
    return t('settings.updateFriendlyRecovered')
  }

  if (includesAny(message, ['rollback_guard_applied'])) {
    return t('settings.updateFriendlyRollback')
  }

  if (includesAny(message, NETWORK_PATTERNS)) {
    return t('settings.updateFriendlyNetwork')
  }

  return t('settings.updateFriendlyGeneric')
}

export function toKnowledgeErrorMessage(input: unknown, action: 'load' | 'index' | 'remove' | 'search'): string {
  const message = normalizeMessage(input)

  if (includesAny(message, PERMISSION_PATTERNS)) {
    return t('knowledge.errorPermission')
  }

  if (includesAny(message, NOT_FOUND_PATTERNS)) {
    return t('knowledge.errorNotFound')
  }

  return t(
    action === 'load'
      ? 'knowledge.errorLoad'
      : action === 'index'
        ? 'knowledge.errorIndex'
        : action === 'remove'
          ? 'knowledge.errorRemove'
          : 'knowledge.errorSearch',
  )
}

export function toMarketplaceErrorMessage(
  input: unknown,
  action: 'load' | 'search' | 'install' | 'update' | 'uninstall' | 'enable' | 'disable',
): string {
  const message = normalizeMessage(input)

  if (includesAny(message, NETWORK_PATTERNS)) {
    return t('marketplace.errorNetwork')
  }

  return t(
    action === 'load'
      ? 'marketplace.errorLoad'
      : action === 'search'
        ? 'marketplace.errorSearch'
        : action === 'install'
          ? 'marketplace.errorInstall'
          : action === 'update'
            ? 'marketplace.errorUpdate'
            : action === 'uninstall'
              ? 'marketplace.errorUninstall'
              : action === 'enable'
                ? 'marketplace.errorEnable'
                : 'marketplace.errorDisable',
  )
}

export function toWorkflowErrorMessage(
  input: unknown,
  action: 'load' | 'create' | 'delete' | 'run' | 'pause' | 'resume' | 'cancel' | 'schedule',
): string {
  const message = normalizeMessage(input)

  if (includesAny(message, INVALID_JSON_PATTERNS)) {
    return t('workflow.invalidJson')
  }

  return t(
    action === 'load'
      ? 'workflow.errorLoad'
      : action === 'create'
        ? 'workflow.errorCreate'
        : action === 'delete'
          ? 'workflow.errorDelete'
          : action === 'run'
            ? 'workflow.errorRun'
            : action === 'pause'
              ? 'workflow.errorPause'
              : action === 'resume'
                ? 'workflow.errorResume'
                : action === 'cancel'
                  ? 'workflow.errorCancel'
                  : 'workflow.errorSchedule',
  )
}

export function toDashboardErrorMessage(
  input: unknown,
  action: 'monitor' | 'processes' | 'suggestions' | 'settings',
): string {
  const message = normalizeMessage(input)

  if (includesAny(message, PERMISSION_PATTERNS)) {
    return t('dashboard.errorSettings')
  }

  return t(
    action === 'monitor'
      ? 'dashboard.errorMonitor'
      : action === 'processes'
        ? 'dashboard.errorProcesses'
        : action === 'suggestions'
          ? 'dashboard.errorSuggestions'
          : 'dashboard.errorSettings',
  )
}

export function toFilesErrorMessage(input: unknown): string {
  const message = normalizeMessage(input)

  if (includesAny(message, PERMISSION_PATTERNS)) {
    return t('files.errorPermission')
  }

  if (includesAny(message, NOT_FOUND_PATTERNS)) {
    return t('files.errorNotFound')
  }

  return t('files.error')
}

export function toClipboardErrorMessage(
  input: unknown,
  action: 'load' | 'clear' | 'pin' | 'transform',
): string {
  const message = normalizeMessage(input)

  if (includesAny(message, PERMISSION_PATTERNS)) {
    return t('clipboard.errorTransform')
  }

  return t(
    action === 'load'
      ? 'clipboard.errorLoad'
      : action === 'clear'
        ? 'clipboard.errorClear'
        : action === 'pin'
          ? 'clipboard.errorPin'
          : 'clipboard.errorTransform',
  )
}

export function toMacroErrorMessage(
  input: unknown,
  action: 'load' | 'recordStart' | 'recordStop' | 'play' | 'delete',
): string {
  void input
  return t(
    action === 'load'
      ? 'macro.errorLoad'
      : action === 'recordStart'
        ? 'macro.errorRecordStart'
        : action === 'recordStop'
          ? 'macro.errorRecordStop'
          : action === 'play'
            ? 'macro.errorPlay'
            : 'macro.errorDelete',
  )
}

export function toHotkeyErrorMessage(input: unknown, action: 'load' | 'save' | 'remove'): string {
  void input
  return t(action === 'load' ? 'hotkey.errorLoad' : action === 'save' ? 'hotkey.errorSave' : 'hotkey.errorRemove')
}

export function toCalendarErrorMessage(
  input: unknown,
  action: 'load' | 'create' | 'delete' | 'freeTime',
): string {
  const message = normalizeMessage(input)

  if (includesAny(message, CONFIGURATION_PATTERNS)) {
    return t('calendar.errorLoad')
  }

  return t(
    action === 'load'
      ? 'calendar.errorLoad'
      : action === 'create'
        ? 'calendar.errorCreate'
        : action === 'delete'
          ? 'calendar.errorDelete'
          : 'calendar.errorFreeTime',
  )
}

export function toVisionErrorMessage(input: unknown, action: 'analyze' | 'ocr' | 'find'): string {
  const message = normalizeMessage(input)

  if (includesAny(message, PERMISSION_PATTERNS)) {
    return t('vision.errorAnalyze')
  }

  return t(action === 'analyze' ? 'vision.errorAnalyze' : action === 'ocr' ? 'vision.errorOcr' : 'vision.errorFind')
}

export function toMonitorErrorMessage(input: unknown, action: 'load' | 'capture'): string {
  const message = normalizeMessage(input)

  if (includesAny(message, PERMISSION_PATTERNS)) {
    return t('monitor.errorCapture')
  }

  return t(action === 'load' ? 'monitor.errorLoad' : 'monitor.errorCapture')
}

export function toImageErrorMessage(input: unknown): string {
  const message = normalizeMessage(input)

  if (includesAny(message, PERMISSION_PATTERNS)) {
    return t('files.errorPermission')
  }

  if (includesAny(message, NOT_FOUND_PATTERNS)) {
    return t('files.errorNotFound')
  }

  if (includesAny(message, NETWORK_PATTERNS)) {
    return t('image.error')
  }

  return t('image.error')
}

export function toEmailErrorMessage(input: unknown, action: 'load' | 'read' | 'send'): string {
  const message = normalizeMessage(input)

  if (includesAny(message, CONFIGURATION_PATTERNS)) {
    return t('email.errorNotConfigured')
  }

  if (action === 'send' && includesAny(message, INVALID_EMAIL_PATTERNS)) {
    return t('email.errorInvalidRecipient')
  }

  return t(action === 'load' ? 'email.errorLoad' : action === 'read' ? 'email.errorRead' : 'email.errorSend')
}

export function toMcpErrorMessage(
  input: unknown,
  action: 'loadServers' | 'loadTools' | 'addServer' | 'connect' | 'disconnect' | 'removeServer' | 'callTool',
): string {
  const message = normalizeMessage(input)

  if (action === 'callTool' && includesAny(message, INVALID_JSON_PATTERNS)) {
    return t('mcp.invalidJson')
  }

  if (includesAny(message, PATH_PATTERNS)) {
    return t('mcp.errorPathRequired')
  }

  return t(
    action === 'loadServers'
      ? 'mcp.errorLoadServers'
      : action === 'loadTools'
        ? 'mcp.errorLoadTools'
        : action === 'addServer'
          ? 'mcp.errorAddServer'
          : action === 'connect'
            ? 'mcp.errorConnect'
            : action === 'disconnect'
              ? 'mcp.errorDisconnect'
              : action === 'removeServer'
                ? 'mcp.errorRemoveServer'
                : 'mcp.errorCallTool',
  )
}

export function toVoiceErrorMessage(input: unknown): string {
  const message = normalizeMessage(input)

  if (includesAny(message, MICROPHONE_PATTERNS)) {
    return t('voice.errorUnavailable')
  }

  if (includesAny(message, API_KEY_PATTERNS) || includesAny(message, CONFIGURATION_PATTERNS)) {
    return t('voice.errorSetup')
  }

  if (includesAny(message, NETWORK_PATTERNS)) {
    return t('voice.errorNetwork')
  }

  if (includesAny(message, TRANSCRIBE_PATTERNS)) {
    return t('voice.errorRecognition')
  }

  return t('voice.errorGeneric')
}

export function toChatErrorMessage(input: unknown): string {
  const message = normalizeMessage(input)

  if (!message) {
    return t('chat.errorGeneric')
  }

  if (includesAny(message, NETWORK_PATTERNS)) {
    return t('chat.errorNetwork')
  }

  if (includesAny(message, RATE_LIMIT_PATTERNS)) {
    return t('chat.errorRateLimit')
  }

  if (includesAny(message, API_KEY_PATTERNS) || includesAny(message, CONFIGURATION_PATTERNS)) {
    return t('chat.errorSetup')
  }

  return t('chat.errorGeneric')
}

export function toSkillErrorMessage(input: unknown): string {
  const message = normalizeMessage(input)

  if (includesAny(message, PATH_PATTERNS) || includesAny(message, NOT_FOUND_PATTERNS)) {
    return t('appLauncher.pathRequired')
  }

  if (includesAny(message, PERMISSION_PATTERNS)) {
    return t('appLauncher.permissionDenied')
  }

  if (includesAny(message, NETWORK_PATTERNS)) {
    return t('skill.errorNetwork')
  }

  return t('skill.error')
}

export function toToolExecutionErrorMessage(toolName: string, input: unknown): string {
  switch (toolName) {
    case 'calendar_list_events':
      return toCalendarErrorMessage(input, 'load')
    case 'calendar_create_event':
      return toCalendarErrorMessage(input, 'create')
    case 'calendar_find_free_time':
      return toCalendarErrorMessage(input, 'freeTime')
    case 'clipboard_history':
      return toClipboardErrorMessage(input, 'load')
    case 'clipboard_pin':
      return toClipboardErrorMessage(input, 'pin')
    case 'clipboard_transform':
      return toClipboardErrorMessage(input, 'transform')
    case 'email_list':
      return toEmailErrorMessage(input, 'load')
    case 'email_read':
      return toEmailErrorMessage(input, 'read')
    case 'email_draft':
    case 'email_send':
      return toEmailErrorMessage(input, 'send')
    case 'list_hotkeys':
      return toHotkeyErrorMessage(input, 'load')
    case 'set_hotkey':
      return toHotkeyErrorMessage(input, 'save')
    case 'remove_hotkey':
      return toHotkeyErrorMessage(input, 'remove')
    case 'plugin_install':
      return toMarketplaceErrorMessage(input, 'install')
    case 'marketplace_search':
      return toMarketplaceErrorMessage(input, 'search')
    case 'knowledge_search':
      return toKnowledgeErrorMessage(input, 'search')
    case 'knowledge_index_file':
    case 'knowledge_index_folder':
      return toKnowledgeErrorMessage(input, 'index')
    case 'knowledge_remove':
      return toKnowledgeErrorMessage(input, 'remove')
    case 'knowledge_list':
      return toKnowledgeErrorMessage(input, 'load')
    case 'macro_record_start':
      return toMacroErrorMessage(input, 'recordStart')
    case 'macro_record_stop':
      return toMacroErrorMessage(input, 'recordStop')
    case 'macro_play':
      return toMacroErrorMessage(input, 'play')
    case 'macro_list':
      return toMacroErrorMessage(input, 'load')
    case 'app_launch':
      return toAppControlErrorMessage(input, 'launch')
    case 'app_close':
      return toAppControlErrorMessage(input, 'close')
    case 'app_send_keys':
      return toAppControlErrorMessage(input, 'sendKeys')
    case 'app_list_running':
      return toAppControlErrorMessage(input, 'load')
    case 'system_health':
      return toDashboardErrorMessage(input, 'monitor')
    case 'system_processes':
      return toDashboardErrorMessage(input, 'processes')
    case 'get_context':
      return toDashboardErrorMessage(input, 'suggestions')
    case 'list_monitors':
      return toMonitorErrorMessage(input, 'load')
    case 'screenshot_monitor':
    case 'screenshot_region':
      return toMonitorErrorMessage(input, 'capture')
    case 'read_file':
    case 'write_file':
    case 'list_directory':
    case 'delete_file':
    case 'organize_folder':
    case 'find_duplicates':
    case 'analyze_folder':
    case 'secure_delete':
    case 'clean_temp_files':
      return toFilesErrorMessage(input)
    case 'image_resize':
    case 'image_crop':
    case 'image_convert':
    case 'image_compress':
    case 'image_info':
      return toImageErrorMessage(input)
    case 'screen_ocr':
      return toVisionErrorMessage(input, 'ocr')
    case 'screen_analyze_ui':
      return toVisionErrorMessage(input, 'analyze')
    case 'screen_region_capture':
      return toVisionErrorMessage(input, 'find')
    case 'create_workflow':
      return toWorkflowErrorMessage(input, 'create')
    case 'run_workflow':
      return toWorkflowErrorMessage(input, 'run')
    case 'list_workflows':
      return toWorkflowErrorMessage(input, 'load')
    case 'schedule_workflow':
      return toWorkflowErrorMessage(input, 'schedule')
    default:
      return t('tool.failed')
  }
}

export function toTechnicalErrorDetails(input: unknown): string {
  return normalizeMessage(input)
}
