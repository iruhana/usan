import { describe, expect, it } from 'vitest'
import { classifyProcessSnapshot } from '../../src/main/mcp/app-detector'

describe('app-detector', () => {
  it('routes Qt apps to qt-bridge', () => {
    const result = classifyProcessSnapshot({
      pid: 10,
      processName: 'assistant',
      title: 'Qt Assistant',
      path: 'C:\\Qt\\Tools\\assistant.exe',
      modules: ['Qt6Core.dll', 'Qt6Widgets.dll'],
    })

    expect(result.framework).toBe('qt')
    expect(result.provider).toBe('qt-bridge')
    expect(result.qtVersion).toBe('Qt 6')
  })

  it('routes Chromium browsers to playwright', () => {
    const result = classifyProcessSnapshot({
      pid: 11,
      processName: 'chrome',
      title: 'Usan',
      path: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      modules: ['chrome.dll'],
    })

    expect(result.framework).toBe('browser')
    expect(result.provider).toBe('playwright')
  })

  it('routes CEF apps to chrome-devtools', () => {
    const result = classifyProcessSnapshot({
      pid: 12,
      processName: 'Qwen',
      title: 'Qwen',
      path: 'D:\\AI-Apps\\Qwen\\Qwen.exe',
      modules: ['libcef.dll', 'chrome_100_percent.pak'],
    })

    expect(result.framework).toBe('cef')
    expect(result.provider).toBe('chrome-devtools')
  })

  it('routes WebView2 hosts to chrome-devtools', () => {
    const result = classifyProcessSnapshot({
      pid: 13,
      processName: 'Quark',
      title: 'Quark',
      path: 'D:\\AI-Apps\\Quark\\quark.exe',
      modules: ['WebView2Loader.dll'],
    })

    expect(result.framework).toBe('webview2')
    expect(result.provider).toBe('chrome-devtools')
  })

  it('routes Electron shells to chrome-devtools', () => {
    const result = classifyProcessSnapshot({
      pid: 14,
      processName: 'electron.exe',
      title: 'Internal Tool',
      path: 'C:\\Tools\\Internal\\electron.exe',
      modules: ['chrome.dll'],
    })

    expect(result.framework).toBe('electron')
    expect(result.provider).toBe('chrome-devtools')
  })

  it('routes packaged Electron apps with app.asar evidence to chrome-devtools', () => {
    const result = classifyProcessSnapshot({
      pid: 15,
      processName: 'usan',
      title: 'Usan Desktop',
      path: 'C:\\Users\\admin\\AppData\\Local\\Programs\\Usan\\resources\\app.asar',
      modules: ['chrome_elf.dll'],
    })

    expect(result.framework).toBe('electron')
    expect(result.provider).toBe('chrome-devtools')
    expect(result.evidence).toContain('asar-path')
  })

  it('routes embedded EBWebView paths to chrome-devtools', () => {
    const result = classifyProcessSnapshot({
      pid: 16,
      processName: 'DesktopApp',
      title: 'Embedded Host',
      path: 'C:\\Users\\admin\\AppData\\Local\\DesktopApp\\EBWebView\\Application\\host.exe',
      modules: ['host.exe'],
    })

    expect(result.framework).toBe('webview2')
    expect(result.provider).toBe('chrome-devtools')
  })
})
