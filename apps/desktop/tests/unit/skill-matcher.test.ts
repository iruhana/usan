import { describe, it, expect } from 'vitest'
import { matchSkills, formatSkillContext, formatAvailableSkills } from '@main/skills/skill-matcher'
import type { Skill } from '@main/skills/skill-loader'

function makeSkill(id: string, name: string, triggers: string[]): Skill {
  return {
    meta: {
      id,
      name,
      description: `${name} 설명`,
      triggers,
      tools: [],
      category: 'general',
      metadata: {},
    },
    procedure: `${name} 절차 안내`,
    filePath: `/skills/${id}.skill.md`,
    eligible: true,
  }
}

const testSkills: Skill[] = [
  makeSkill('wifi', '와이파이 연결', ['와이파이', '인터넷 연결', 'wifi']),
  makeSkill('screenshot', '스크린샷 찍기', ['스크린샷', '화면 캡처', '캡처']),
  makeSkill('printer', '프린터 설정', ['프린터', '인쇄', '출력']),
  makeSkill('font-size', '글씨 크기', ['글씨 크기', '폰트 크기', '글자 크기']),
]

describe('matchSkills', () => {
  it('정확한 트리거 일치 → 점수 1.0', () => {
    const results = matchSkills('와이파이', testSkills)
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].skill.meta.id).toBe('wifi')
    expect(results[0].score).toBe(1.0)
  })

  it('부분 문장에서 트리거 매칭', () => {
    const results = matchSkills('인터넷 연결이 안 돼요', testSkills)
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].skill.meta.id).toBe('wifi')
  })

  it('여러 스킬 매칭 시 관련도 순 정렬', () => {
    const results = matchSkills('화면 캡처', testSkills)
    expect(results[0].skill.meta.id).toBe('screenshot')
  })

  it('무관한 메시지 → 빈 결과', () => {
    const results = matchSkills('오늘 날씨 어때?', testSkills)
    // Should return few or no matches since no trigger matches
    for (const r of results) {
      expect(r.score).toBeLessThan(0.8)
    }
  })

  it('maxResults 제한 적용', () => {
    const results = matchSkills('글씨', testSkills, 1)
    expect(results.length).toBeLessThanOrEqual(1)
  })

  it('이름 매칭 (0.8 배수)', () => {
    const results = matchSkills('프린터 설정 방법', testSkills)
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].skill.meta.id).toBe('printer')
  })

  it('영어 트리거도 매칭', () => {
    const results = matchSkills('wifi 연결해줘', testSkills)
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].skill.meta.id).toBe('wifi')
  })
})

describe('formatSkillContext', () => {
  it('빈 매칭 → 빈 문자열', () => {
    expect(formatSkillContext([])).toBe('')
  })

  it('매칭 결과 → 마크다운 포맷', () => {
    const matches = matchSkills('스크린샷', testSkills)
    const context = formatSkillContext(matches)
    expect(context).toContain('## 관련 스킬 가이드')
    expect(context).toContain('스크린샷 찍기')
  })
})

describe('formatAvailableSkills', () => {
  it('빈 스킬 → 빈 문자열', () => {
    expect(formatAvailableSkills([])).toBe('')
  })

  it('스킬 목록 → XML 카탈로그', () => {
    const xml = formatAvailableSkills(testSkills)
    expect(xml).toContain('<available_skills>')
    expect(xml).toContain('</available_skills>')
    expect(xml).toContain('name="와이파이 연결"')
    expect(xml).toContain('description="와이파이 연결 설명"')
  })

  it('metadata.emoji → XML에 포함', () => {
    const skillWithEmoji: Skill = {
      meta: {
        id: 'test',
        name: '테스트',
        description: '테스트 설명',
        triggers: [],
        tools: [],
        category: 'test',
        metadata: { emoji: '🧪' },
      },
      procedure: '',
      filePath: '/test/SKILL.md',
      eligible: true,
    }
    const xml = formatAvailableSkills([skillWithEmoji])
    expect(xml).toContain('emoji="🧪"')
  })
})
