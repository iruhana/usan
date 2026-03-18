import { describe, expect, it } from 'vitest'
import { tokenizeLaunchArgs, validateLaunchTargetInput } from '../../src/main/orchestration/app-launcher'

describe('app-launcher helpers', () => {
  describe('tokenizeLaunchArgs', () => {
    it('keeps quoted values together', () => {
      expect(tokenizeLaunchArgs('--showUrl "https://usan.ai/help center"')).toEqual([
        '--showUrl',
        'https://usan.ai/help center',
      ])
    })

    it('supports pre-tokenized arrays', () => {
      expect(tokenizeLaunchArgs(['--collectionFile', 'C:\\Docs\\help.qhc'])).toEqual([
        '--collectionFile',
        'C:\\Docs\\help.qhc',
      ])
    })

    it('throws on unclosed quotes', () => {
      expect(() => tokenizeLaunchArgs('"broken')).toThrow('unclosed quote')
    })
  })

  describe('validateLaunchTargetInput', () => {
    it('allows safe built-in bare commands', () => {
      expect(validateLaunchTargetInput('code')).toEqual({
        normalized: 'code',
        needsResolution: true,
      })
    })

    it('requires absolute paths for custom executables', () => {
      expect(validateLaunchTargetInput('C:\\Program Files (x86)\\App\\tool.exe')).toEqual({
        normalized: 'C:\\Program Files (x86)\\App\\tool.exe',
        needsResolution: false,
      })
    })

    it('rejects blocked bare commands that are likely to collide', () => {
      expect(() => validateLaunchTargetInput('assistant')).toThrow('전체 경로')
    })

    it('rejects unknown bare commands', () => {
      expect(() => validateLaunchTargetInput('python')).toThrow('기본 앱 이름이 아니면 전체 경로')
    })
  })
})
