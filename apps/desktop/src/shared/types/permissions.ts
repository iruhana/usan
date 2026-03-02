/**
 * Permission system — 설치 시 한번에 전체 동의, 이후 팝업 ZERO
 */

export const ALL_PERMISSIONS = [
  // Screen
  'screen:capture',
  'screen:analyze',
  // Mouse
  'mouse:move',
  'mouse:click',
  'mouse:drag',
  // Keyboard
  'keyboard:type',
  'keyboard:shortcut',
  // Clipboard
  'clipboard:read',
  'clipboard:write',
  // File System
  'fs:read',
  'fs:write',
  'fs:delete',
  'fs:list',
  // Shell
  'shell:exec',
  'shell:admin',
  // Apps
  'app:launch',
  'app:close',
  'app:list',
  // Windows
  'window:focus',
  'window:resize',
  'window:list',
  // Browser
  'browser:navigate',
  'browser:interact',
  'browser:download',
  // Web
  'web:search',
  'web:fetch',
  // Packages
  'package:install',
  // Process
  'process:list',
  'process:kill',
  // Memory
  'memory:read',
  'memory:write',
  // Network
  'network:config',
] as const

export type Permission = (typeof ALL_PERMISSIONS)[number]

export interface PermissionGrant {
  grantedAll: boolean
  grantedAt: number
  version: string
}
