import { normalizePermissionPath } from '@shared/types/permissions'
import type { ToolSecurityProfile } from './types'

function defineProfile(
  toolName: string,
  ring: ToolSecurityProfile['ring'],
  category: string,
  description: string,
  options: Pick<ToolSecurityProfile, 'pathArgKeys' | 'scansUntrustedOutput'> = {},
): ToolSecurityProfile {
  return {
    toolName,
    ring,
    category,
    description,
    ...options,
  }
}

const PROFILES: Record<string, ToolSecurityProfile> = {
  read_file: defineProfile('read_file', 1, 'filesystem', 'Read text files', {
    pathArgKeys: ['path'],
    scansUntrustedOutput: true,
  }),
  write_file: defineProfile('write_file', 2, 'filesystem', 'Write or overwrite files', {
    pathArgKeys: ['path'],
  }),
  list_directory: defineProfile('list_directory', 0, 'filesystem', 'List directory metadata', {
    pathArgKeys: ['path'],
  }),
  delete_file: defineProfile('delete_file', 3, 'filesystem', 'Delete files', {
    pathArgKeys: ['path'],
  }),
  screenshot: defineProfile('screenshot', 1, 'computer', 'Capture the current screen'),
  mouse_click: defineProfile('mouse_click', 3, 'computer', 'Click the mouse'),
  keyboard_type: defineProfile('keyboard_type', 3, 'computer', 'Type with the keyboard'),
  keyboard_hotkey: defineProfile('keyboard_hotkey', 3, 'computer', 'Trigger keyboard shortcuts'),
  list_windows: defineProfile('list_windows', 0, 'computer', 'Inspect window list'),
  focus_window: defineProfile('focus_window', 2, 'computer', 'Focus another application window'),
  clipboard_read: defineProfile('clipboard_read', 1, 'clipboard', 'Read clipboard contents'),
  clipboard_write: defineProfile('clipboard_write', 2, 'clipboard', 'Write clipboard contents'),
  browser_open: defineProfile('browser_open', 1, 'browser', 'Open a web page'),
  browser_click: defineProfile('browser_click', 3, 'browser', 'Click on a web page'),
  browser_type: defineProfile('browser_type', 3, 'browser', 'Type into a web page'),
  browser_read: defineProfile('browser_read', 1, 'browser', 'Read current page text', {
    scansUntrustedOutput: true,
  }),
  browser_screenshot: defineProfile('browser_screenshot', 1, 'browser', 'Capture browser screenshot'),
  run_command: defineProfile('run_command', 3, 'system', 'Execute shell commands', {
    pathArgKeys: ['cwd'],
  }),
  web_search: defineProfile('web_search', 1, 'web', 'Search the web', {
    scansUntrustedOutput: true,
  }),
  list_skills: defineProfile('list_skills', 0, 'skills', 'List available skills'),
  set_reminder: defineProfile('set_reminder', 2, 'system', 'Create reminders'),
  list_reminders: defineProfile('list_reminders', 0, 'system', 'List reminders'),
  cancel_reminder: defineProfile('cancel_reminder', 2, 'system', 'Cancel reminders'),
  run_skill_script: defineProfile('run_skill_script', 3, 'skills', 'Run local skill scripts'),
  speak_text: defineProfile('speak_text', 1, 'system', 'Read text aloud'),
  secure_delete: defineProfile('secure_delete', 3, 'filesystem', 'Securely shred files', {
    pathArgKeys: ['path'],
  }),
  clean_temp_files: defineProfile('clean_temp_files', 3, 'system', 'Delete temporary files'),
  list_startup_programs: defineProfile('list_startup_programs', 1, 'system', 'Inspect startup programs'),
  toggle_startup_program: defineProfile('toggle_startup_program', 3, 'system', 'Change startup programs'),
  email_list: defineProfile('email_list', 1, 'email', 'List email messages', {
    scansUntrustedOutput: true,
  }),
  email_read: defineProfile('email_read', 1, 'email', 'Read email contents', {
    scansUntrustedOutput: true,
  }),
  email_draft: defineProfile('email_draft', 1, 'email', 'Draft an email'),
  email_send: defineProfile('email_send', 2, 'email', 'Send an email'),
  organize_folder: defineProfile('organize_folder', 2, 'filesystem', 'Organize folders', {
    pathArgKeys: ['path'],
  }),
  find_duplicates: defineProfile('find_duplicates', 1, 'filesystem', 'Find duplicate files', {
    pathArgKeys: ['path'],
  }),
  analyze_folder: defineProfile('analyze_folder', 1, 'filesystem', 'Analyze folder contents', {
    pathArgKeys: ['path'],
  }),
  list_hotkeys: defineProfile('list_hotkeys', 0, 'system', 'List registered hotkeys'),
  set_hotkey: defineProfile('set_hotkey', 2, 'system', 'Register a new hotkey'),
  remove_hotkey: defineProfile('remove_hotkey', 2, 'system', 'Remove a hotkey'),
  image_resize: defineProfile('image_resize', 2, 'image', 'Resize an image', {
    pathArgKeys: ['path', 'outputPath'],
  }),
  image_crop: defineProfile('image_crop', 2, 'image', 'Crop an image', {
    pathArgKeys: ['path', 'outputPath'],
  }),
  image_convert: defineProfile('image_convert', 2, 'image', 'Convert an image', {
    pathArgKeys: ['path', 'outputPath'],
  }),
  image_compress: defineProfile('image_compress', 2, 'image', 'Compress an image', {
    pathArgKeys: ['path', 'outputPath'],
  }),
  image_info: defineProfile('image_info', 1, 'image', 'Inspect image metadata', {
    pathArgKeys: ['path'],
  }),
  create_workflow: defineProfile('create_workflow', 2, 'workflow', 'Create a workflow'),
  run_workflow: defineProfile('run_workflow', 3, 'workflow', 'Run a workflow'),
  list_workflows: defineProfile('list_workflows', 0, 'workflow', 'List workflows'),
  schedule_workflow: defineProfile('schedule_workflow', 3, 'workflow', 'Schedule a workflow'),
  calendar_list_events: defineProfile('calendar_list_events', 1, 'calendar', 'List calendar events'),
  calendar_create_event: defineProfile('calendar_create_event', 2, 'calendar', 'Create calendar events'),
  calendar_find_free_time: defineProfile('calendar_find_free_time', 0, 'calendar', 'Find free time'),
  naver_search: defineProfile('naver_search', 1, 'web', 'Search Naver content', {
    scansUntrustedOutput: true,
  }),
  naver_news_search: defineProfile('naver_news_search', 1, 'web', 'Search Naver news', {
    scansUntrustedOutput: true,
  }),
  naver_oauth_start: defineProfile('naver_oauth_start', 3, 'auth', 'Connect a Naver account'),
  naver_oauth_status: defineProfile('naver_oauth_status', 0, 'auth', 'Inspect Naver account connection'),
  naver_oauth_logout: defineProfile('naver_oauth_logout', 2, 'auth', 'Disconnect a Naver account'),
  kakao_oauth_start: defineProfile('kakao_oauth_start', 3, 'auth', 'Connect a Kakao account'),
  kakao_oauth_status: defineProfile('kakao_oauth_status', 0, 'auth', 'Inspect Kakao account connection'),
  kakao_oauth_logout: defineProfile('kakao_oauth_logout', 2, 'auth', 'Disconnect a Kakao account'),
  kakao_send_to_me: defineProfile('kakao_send_to_me', 2, 'communication', 'Send a KakaoTalk memo to self'),
  app_launch: defineProfile('app_launch', 2, 'orchestration', 'Launch applications'),
  app_close: defineProfile('app_close', 3, 'orchestration', 'Close applications'),
  app_send_keys: defineProfile('app_send_keys', 3, 'orchestration', 'Send keys to applications'),
  app_list_running: defineProfile('app_list_running', 0, 'orchestration', 'List running applications'),
  app_com_invoke: defineProfile('app_com_invoke', 3, 'orchestration', 'Invoke COM automation'),
  macro_record_start: defineProfile('macro_record_start', 3, 'macro', 'Start macro recording'),
  macro_record_stop: defineProfile('macro_record_stop', 3, 'macro', 'Stop macro recording'),
  macro_play: defineProfile('macro_play', 3, 'macro', 'Play a macro'),
  macro_list: defineProfile('macro_list', 0, 'macro', 'List macros'),
  knowledge_search: defineProfile('knowledge_search', 1, 'rag', 'Search indexed knowledge', {
    scansUntrustedOutput: true,
  }),
  knowledge_index_file: defineProfile('knowledge_index_file', 2, 'rag', 'Index a file into knowledge base', {
    pathArgKeys: ['path'],
  }),
  knowledge_index_folder: defineProfile('knowledge_index_folder', 2, 'rag', 'Index a folder into knowledge base', {
    pathArgKeys: ['path'],
  }),
  knowledge_list: defineProfile('knowledge_list', 0, 'rag', 'List indexed documents'),
  knowledge_remove: defineProfile('knowledge_remove', 2, 'rag', 'Remove indexed documents'),
  system_health: defineProfile('system_health', 0, 'monitoring', 'Read system health'),
  system_processes: defineProfile('system_processes', 0, 'monitoring', 'List processes'),
  get_context: defineProfile('get_context', 0, 'monitoring', 'Read current context'),
  list_monitors: defineProfile('list_monitors', 0, 'monitoring', 'List monitors'),
  screenshot_monitor: defineProfile('screenshot_monitor', 1, 'monitoring', 'Capture monitor screenshot'),
  screenshot_region: defineProfile('screenshot_region', 1, 'monitoring', 'Capture screen region'),
  clipboard_history: defineProfile('clipboard_history', 1, 'clipboard', 'Read clipboard history'),
  clipboard_pin: defineProfile('clipboard_pin', 1, 'clipboard', 'Pin clipboard item'),
  clipboard_transform: defineProfile('clipboard_transform', 0, 'clipboard', 'Transform clipboard text'),
  screen_ocr: defineProfile('screen_ocr', 1, 'vision', 'OCR on the screen'),
  screen_analyze_ui: defineProfile('screen_analyze_ui', 1, 'vision', 'Analyze visible UI'),
  screen_region_capture: defineProfile('screen_region_capture', 1, 'vision', 'Capture screen region'),
  marketplace_search: defineProfile('marketplace_search', 0, 'marketplace', 'Search marketplace'),
  plugin_list_installed: defineProfile('plugin_list_installed', 0, 'marketplace', 'List installed plugins'),
  plugin_install: defineProfile('plugin_install', 3, 'marketplace', 'Install plugins'),
  app_list_targets: defineProfile('app_list_targets', 0, 'automation', 'List automation targets'),
  app_detect_target: defineProfile('app_detect_target', 0, 'automation', 'Detect automation route'),
  app_list_providers: defineProfile('app_list_providers', 0, 'automation', 'List automation provider status'),
  app_list_provider_tools: defineProfile('app_list_provider_tools', 0, 'automation', 'List provider tool catalog'),
  app_call_provider_tool: defineProfile('app_call_provider_tool', 3, 'automation', 'Call a routed automation provider tool', {
    scansUntrustedOutput: true,
  }),
  qt_bridge_connect: defineProfile('qt_bridge_connect', 3, 'qt', 'Inject and connect Qt bridge'),
  qt_get_object_tree: defineProfile('qt_get_object_tree', 1, 'qt', 'Read Qt object tree'),
  qt_get_property: defineProfile('qt_get_property', 1, 'qt', 'Read Qt property'),
  qt_find_object: defineProfile('qt_find_object', 1, 'qt', 'Find Qt object'),
  qt_set_property: defineProfile('qt_set_property', 3, 'qt', 'Mutate Qt property'),
  qt_invoke_method: defineProfile('qt_invoke_method', 3, 'qt', 'Invoke Qt method'),
  qt_screenshot: defineProfile('qt_screenshot', 1, 'qt', 'Capture Qt screenshot'),
}

const DEFAULT_PROFILE = defineProfile(
  'unknown',
  3,
  'dynamic',
  'Unknown or dynamically registered tool',
)

const GENERIC_PATH_KEYS = ['path', 'dir', 'cwd', 'outputPath', 'source', 'destination']

export function getToolSecurityProfile(toolName: string): ToolSecurityProfile {
  return PROFILES[toolName] ?? {
    ...DEFAULT_PROFILE,
    toolName,
  }
}

export function extractScopePath(profile: ToolSecurityProfile, args: Record<string, unknown>): string | undefined {
  const keys = profile.pathArgKeys?.length ? profile.pathArgKeys : GENERIC_PATH_KEYS
  for (const key of keys) {
    const value = args[key]
    if (typeof value !== 'string') continue
    const normalized = normalizePermissionPath(value)
    if (!normalized) continue
    return normalized
  }
  return undefined
}

export function isLocalSkillInstructionRead(toolName: string, args: Record<string, unknown>): boolean {
  if (toolName !== 'read_file') return false
  const path = typeof args.path === 'string' ? normalizePermissionPath(args.path) : ''
  return path.endsWith('/skill.md')
}
