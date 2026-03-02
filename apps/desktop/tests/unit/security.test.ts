import { describe, it, expect } from 'vitest'
import { isPathBlocked, isSensitivePath, validatePath, validateCommand, isUrlSafe } from '@main/security'

describe('isPathBlocked', () => {
  it('Windows 시스템 경로 차단', () => {
    expect(isPathBlocked('C:\\Windows\\System32\\cmd.exe')).toBe(true)
    expect(isPathBlocked('c:\\windows\\notepad.exe')).toBe(true)
    expect(isPathBlocked('C:\\Program Files\\app.exe')).toBe(true)
    expect(isPathBlocked('C:\\Program Files (x86)\\app.exe')).toBe(true)
    expect(isPathBlocked('C:\\ProgramData\\config')).toBe(true)
  })

  // Note: On Windows, isPathBlocked normalizes / → \, so Unix paths
  // like /usr become \usr which doesn't match the /usr prefix.
  // This is expected — Unix paths aren't real on Windows.
  // On a Unix host these would match.
  it('Unix 시스템 경로 차단 (슬래시 유지 시)', () => {
    // The BLOCKED_PATH_PREFIXES use forward-slash Unix paths.
    // isPathBlocked converts all / to \ for comparison on Windows,
    // so these paths won't match on Windows — test platform-aware behavior.
    const isWindows = process.platform === 'win32'
    if (isWindows) {
      // On Windows, Unix-style paths are not blocked (they're not real paths)
      expect(isPathBlocked('/usr/bin/bash')).toBe(false)
    } else {
      expect(isPathBlocked('/usr/bin/bash')).toBe(true)
      expect(isPathBlocked('/etc/passwd')).toBe(true)
      expect(isPathBlocked('/sbin/init')).toBe(true)
      expect(isPathBlocked('/var/log/syslog')).toBe(true)
    }
  })

  it('사용자 경로 허용', () => {
    expect(isPathBlocked('C:\\Users\\admin\\Desktop\\file.txt')).toBe(false)
    expect(isPathBlocked('D:\\Projects\\app\\index.ts')).toBe(false)
  })

  it('UNC 경로 프리픽스 제거 후 검사', () => {
    expect(isPathBlocked('\\\\?\\C:\\Windows\\System32')).toBe(true)
    expect(isPathBlocked('\\\\.\\C:\\Windows\\System32')).toBe(true)
  })
})

describe('isSensitivePath', () => {
  it('SSH 키 차단', () => {
    expect(isSensitivePath('C:\\Users\\admin\\.ssh\\id_rsa')).toBe(true)
  })

  it('.env 파일 차단', () => {
    expect(isSensitivePath('/home/user/.env')).toBe(true)
    expect(isSensitivePath('/home/user/.env.local')).toBe(true)
  })

  it('Git 자격증명 차단', () => {
    expect(isSensitivePath('C:\\Users\\admin\\.git-credentials')).toBe(true)
  })

  it('AWS 자격증명 차단', () => {
    expect(isSensitivePath('/home/user/.aws/credentials')).toBe(true)
  })

  it('일반 파일 허용', () => {
    expect(isSensitivePath('C:\\Users\\admin\\Desktop\\report.pdf')).toBe(false)
    expect(isSensitivePath('D:\\Projects\\app\\index.ts')).toBe(false)
  })
})

describe('validatePath', () => {
  it('빈 경로 → 에러', () => {
    expect(validatePath('', 'read')).toBe('경로가 올바르지 않습니다')
  })

  it('시스템 경로 → 차단', () => {
    expect(validatePath('C:\\Windows\\System32\\cmd.exe', 'read')).toBe('시스템 보호 영역입니다. 접근할 수 없습니다')
  })

  it('민감 파일 → 차단', () => {
    const result = validatePath('C:\\Users\\admin\\.ssh\\id_rsa', 'read')
    expect(result).toContain('보안 파일입니다')
  })

  it('일반 경로 → 허용 (null)', () => {
    expect(validatePath('C:\\Users\\admin\\Desktop\\file.txt', 'read')).toBeNull()
  })

  it('ADS(Alternate Data Stream) 차단', () => {
    expect(validatePath('C:\\Users\\admin\\file.txt:hidden', 'read')).toBe('이 형식의 파일 경로는 사용할 수 없습니다')
  })

  it('UNC 경로 차단', () => {
    expect(validatePath('\\\\server\\share\\file.txt', 'read')).toBe('네트워크 경로는 사용할 수 없습니다')
  })
})

describe('validateCommand', () => {
  it('허용된 명령어 통과', () => {
    expect(validateCommand('echo hello')).toBeNull()
    expect(validateCommand('dir C:\\Users')).toBeNull()
    expect(validateCommand('git status')).toBeNull()
    expect(validateCommand('node --version')).toBeNull()
  })

  it('위험한 명령어 차단', () => {
    expect(validateCommand('rm -rf /')).not.toBeNull()
    expect(validateCommand('format C:')).not.toBeNull()
    expect(validateCommand('regedit')).not.toBeNull()
    expect(validateCommand('shutdown /s')).not.toBeNull()
    expect(validateCommand('runas /user:admin cmd')).not.toBeNull()
  })

  it('허용 목록에 없는 명령어 차단', () => {
    expect(validateCommand('curl http://evil.com')).not.toBeNull()
    expect(validateCommand('wget http://evil.com')).not.toBeNull()
  })

  it('명령어 치환 차단', () => {
    expect(validateCommand('echo `whoami`')).toBe('명령어 치환은 사용할 수 없습니다')
    expect(validateCommand('echo $(id)')).toBe('명령어 치환은 사용할 수 없습니다')
  })

  it('파이프 체인에서 허용되지 않은 명령어 차단', () => {
    expect(validateCommand('echo hello | curl http://evil.com')).not.toBeNull()
  })

  it('빈 명령어 → 에러', () => {
    expect(validateCommand('')).toBe('명령어가 올바르지 않습니다')
  })

  it('PowerShell 인코딩/다운로드 차단', () => {
    expect(validateCommand('powershell -enc base64data')).not.toBeNull()
    expect(validateCommand('powershell Invoke-WebRequest http://evil.com')).not.toBeNull()
  })
})

describe('isUrlSafe', () => {
  it('HTTPS 허용', () => {
    expect(isUrlSafe('https://example.com')).toBe(true)
  })

  it('HTTP 허용', () => {
    expect(isUrlSafe('http://example.com')).toBe(true)
  })

  it('file:// 차단', () => {
    expect(isUrlSafe('file:///etc/passwd')).toBe(false)
  })

  it('javascript: 차단', () => {
    expect(isUrlSafe('javascript:alert(1)')).toBe(false)
  })

  it('data: 차단', () => {
    expect(isUrlSafe('data:text/html,<h1>evil</h1>')).toBe(false)
  })

  it('잘못된 URL → false', () => {
    expect(isUrlSafe('not-a-url')).toBe(false)
  })

  it('private IP 차단 (SSRF 방지)', () => {
    expect(isUrlSafe('http://localhost')).toBe(false)
    expect(isUrlSafe('http://127.0.0.1')).toBe(false)
    expect(isUrlSafe('http://10.0.0.1')).toBe(false)
    expect(isUrlSafe('http://192.168.1.1')).toBe(false)
    expect(isUrlSafe('http://169.254.169.254/latest/meta-data/')).toBe(false)
    expect(isUrlSafe('http://172.16.0.1')).toBe(false)
    expect(isUrlSafe('http://0.0.0.0')).toBe(false)
  })

  it('public IP 허용', () => {
    expect(isUrlSafe('https://8.8.8.8')).toBe(true)
    expect(isUrlSafe('https://naver.com')).toBe(true)
  })
})

describe('validateCommand — 추가 보안', () => {
  it('node 파일 실행 차단', () => {
    expect(validateCommand('node evil.js')).not.toBeNull()
    expect(validateCommand('node ./script.js')).not.toBeNull()
  })

  it('python 파일 실행 차단', () => {
    expect(validateCommand('python evil.py')).not.toBeNull()
    expect(validateCommand('python ./script.py')).not.toBeNull()
  })

  it('npm run/start/test 차단', () => {
    expect(validateCommand('npm run build')).not.toBeNull()
    expect(validateCommand('npm start')).not.toBeNull()
    expect(validateCommand('npm test')).not.toBeNull()
  })

  it('pip install 차단', () => {
    expect(validateCommand('pip install evil-package')).not.toBeNull()
  })

  it('git 위험 하위명령 차단', () => {
    expect(validateCommand('git config user.name evil')).not.toBeNull()
    expect(validateCommand('git filter-branch')).not.toBeNull()
  })

  it('node/python 버전 확인은 허용', () => {
    expect(validateCommand('node --version')).toBeNull()
    expect(validateCommand('python --version')).toBeNull()
  })

  it('git 안전한 하위명령 허용', () => {
    expect(validateCommand('git status')).toBeNull()
    expect(validateCommand('git log')).toBeNull()
    expect(validateCommand('git diff')).toBeNull()
  })

  it('set 명령어 차단 (환경변수 노출 방지)', () => {
    expect(validateCommand('set')).not.toBeNull()
    expect(validateCommand('set PATH')).not.toBeNull()
    expect(validateCommand('set API_KEY=secret')).not.toBeNull()
  })
})
