import { describe, it, expect } from 'vitest'

// Test the core logic by replicating parseable parts of startup-manager.
// The actual module depends on Windows registry/filesystem, so we test the logic.

const PROTECTED_PROGRAMS = new Set([
  'SecurityHealth',
  'Windows Defender',
  'WindowsDefender',
  'WinDefend',
  'MpCmdRun',
  'OneDrive',
])

function isProtected(name: string): boolean {
  return PROTECTED_PROGRAMS.has(name)
}

/** Parse registry query output like the real queryRegistry does */
function parseRegistryOutput(stdout: string): Array<{ name: string; value: string }> {
  const results: Array<{ name: string; value: string }> = []
  for (const line of stdout.split('\n')) {
    const match = line.trim().match(/^(\S+)\s+REG_(?:SZ|EXPAND_SZ)\s+(.+)$/)
    if (match) {
      results.push({ name: match[1], value: match[2].trim() })
    }
  }
  return results
}

/** Parse startup folder entries like the real listStartupFolderItems does */
function parseStartupFolder(entries: string[]): Array<{
  name: string
  enabled: boolean
  isLink: boolean
}> {
  return entries
    .filter((e) => e.endsWith('.lnk') || e.endsWith('.lnk.disabled'))
    .map((e) => {
      const isDisabled = e.endsWith('.disabled')
      const name = isDisabled ? e.replace('.lnk.disabled', '') : e.replace('.lnk', '')
      return {
        name,
        enabled: !isDisabled,
        isLink: true,
      }
    })
}

describe('PROTECTED_PROGRAMS (보호 목록)', () => {
  it('SecurityHealth → 보호됨', () => {
    expect(isProtected('SecurityHealth')).toBe(true)
  })

  it('Windows Defender → 보호됨', () => {
    expect(isProtected('Windows Defender')).toBe(true)
  })

  it('WindowsDefender → 보호됨', () => {
    expect(isProtected('WindowsDefender')).toBe(true)
  })

  it('WinDefend → 보호됨', () => {
    expect(isProtected('WinDefend')).toBe(true)
  })

  it('MpCmdRun → 보호됨', () => {
    expect(isProtected('MpCmdRun')).toBe(true)
  })

  it('OneDrive → 보호됨', () => {
    expect(isProtected('OneDrive')).toBe(true)
  })

  it('일반 프로그램 → 보호되지 않음', () => {
    expect(isProtected('Discord')).toBe(false)
    expect(isProtected('Spotify')).toBe(false)
    expect(isProtected('Steam')).toBe(false)
  })
})

describe('parseRegistryOutput (레지스트리 파싱)', () => {
  it('REG_SZ 항목 파싱', () => {
    const stdout = `
HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run
    Discord    REG_SZ    "C:\\Users\\admin\\AppData\\Local\\Discord\\Update.exe" --processStart Discord.exe
    Spotify    REG_SZ    "C:\\Users\\admin\\AppData\\Roaming\\Spotify\\Spotify.exe" /minimized
`
    const result = parseRegistryOutput(stdout)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Discord')
    expect(result[0].value).toContain('Discord')
    expect(result[1].name).toBe('Spotify')
  })

  it('REG_EXPAND_SZ 항목 파싱', () => {
    const stdout = `
HKEY_LOCAL_MACHINE\\Software\\Microsoft\\Windows\\CurrentVersion\\Run
    SecurityHealth    REG_EXPAND_SZ    %windir%\\system32\\SecurityHealthSystray.exe
`
    const result = parseRegistryOutput(stdout)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('SecurityHealth')
    expect(result[0].value).toContain('SecurityHealthSystray')
  })

  it('빈 출력 → 빈 배열', () => {
    expect(parseRegistryOutput('')).toEqual([])
  })

  it('헤더만 있는 출력 → 빈 배열', () => {
    const stdout = `HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\n`
    expect(parseRegistryOutput(stdout)).toEqual([])
  })

  it('REG_DWORD 무시', () => {
    const stdout = `    SomeValue    REG_DWORD    0x00000001\n`
    expect(parseRegistryOutput(stdout)).toEqual([])
  })
})

describe('parseStartupFolder (시작 폴더 파싱)', () => {
  it('.lnk 파일 → 활성 상태', () => {
    const entries = ['Discord.lnk', 'Spotify.lnk']
    const result = parseStartupFolder(entries)
    expect(result).toHaveLength(2)
    expect(result[0]).toEqual({ name: 'Discord', enabled: true, isLink: true })
    expect(result[1]).toEqual({ name: 'Spotify', enabled: true, isLink: true })
  })

  it('.lnk.disabled → 비활성 상태', () => {
    const entries = ['OldApp.lnk.disabled']
    const result = parseStartupFolder(entries)
    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ name: 'OldApp', enabled: false, isLink: true })
  })

  it('혼합 상태', () => {
    const entries = ['Active.lnk', 'Disabled.lnk.disabled', 'readme.txt', 'Other.exe']
    const result = parseStartupFolder(entries)
    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Active')
    expect(result[0].enabled).toBe(true)
    expect(result[1].name).toBe('Disabled')
    expect(result[1].enabled).toBe(false)
  })

  it('.lnk 아닌 파일 무시', () => {
    const entries = ['readme.txt', 'script.bat', 'config.ini']
    const result = parseStartupFolder(entries)
    expect(result).toHaveLength(0)
  })

  it('빈 폴더 → 빈 배열', () => {
    expect(parseStartupFolder([])).toEqual([])
  })
})

describe('toggleStartupProgram 로직 (보호 체크)', () => {
  function checkToggle(name: string, source: string): { blocked: boolean; reason?: string } {
    if (PROTECTED_PROGRAMS.has(name)) {
      return { blocked: true, reason: '시스템 보호 프로그램' }
    }
    if (source === 'hklm') {
      return { blocked: true, reason: '시스템 레벨' }
    }
    return { blocked: false }
  }

  it('보호 프로그램 변경 차단', () => {
    const result = checkToggle('SecurityHealth', 'hkcu')
    expect(result.blocked).toBe(true)
  })

  it('HKLM 항목 변경 차단', () => {
    const result = checkToggle('SomeApp', 'hklm')
    expect(result.blocked).toBe(true)
  })

  it('일반 HKCU 항목 변경 허용', () => {
    const result = checkToggle('Discord', 'hkcu')
    expect(result.blocked).toBe(false)
  })

  it('일반 시작폴더 항목 변경 허용', () => {
    const result = checkToggle('Spotify', 'startup-folder')
    expect(result.blocked).toBe(false)
  })
})
