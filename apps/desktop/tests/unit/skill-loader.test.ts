import { describe, it, expect } from 'vitest'

// parseFrontmatter is not exported, so we test it indirectly
// by importing the module and testing loadAllSkills with a temp dir
import { loadAllSkills, filterSkillsForRuntime, type Skill } from '@main/skills/skill-loader'
import { writeFile, mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const TMP_DIR = join(tmpdir(), 'usan-test-skills-' + Date.now())

describe('skill-loader', () => {
  it('SKILL.md 파싱 — 프론트매터 + 본문 분리', async () => {
    await mkdir(TMP_DIR, { recursive: true })

    const skillContent = `---
id: test-skill
name: 테스트 스킬
description: 테스트용 스킬입니다
triggers: [테스트, 시험]
tools: [screenshot]
category: test
---
## 절차

1. 테스트를 시작합니다
2. 결과를 확인합니다
`
    await writeFile(join(TMP_DIR, 'test.skill.md'), skillContent, 'utf-8')

    const skills = await loadAllSkills(TMP_DIR)
    expect(skills.length).toBe(1)

    const skill = skills[0]
    expect(skill.meta.id).toBe('test-skill')
    expect(skill.meta.name).toBe('테스트 스킬')
    expect(skill.meta.triggers).toEqual(['테스트', '시험'])
    expect(skill.meta.tools).toEqual(['screenshot'])
    expect(skill.meta.category).toBe('test')
    expect(skill.procedure).toContain('테스트를 시작합니다')

    await rm(TMP_DIR, { recursive: true, force: true })
  })

  it('빈 디렉토리 → 빈 배열', async () => {
    const emptyDir = join(tmpdir(), 'usan-empty-' + Date.now())
    await mkdir(emptyDir, { recursive: true })

    const skills = await loadAllSkills(emptyDir)
    expect(skills).toEqual([])

    await rm(emptyDir, { recursive: true, force: true })
  })

  it('프론트매터 없는 파일 → 건너뜀 (id/name 필수)', async () => {
    const dir = join(tmpdir(), 'usan-nofm-' + Date.now())
    await mkdir(dir, { recursive: true })

    await writeFile(join(dir, 'bad.skill.md'), '# No frontmatter\nJust content.', 'utf-8')

    const skills = await loadAllSkills(dir)
    expect(skills).toEqual([])

    await rm(dir, { recursive: true, force: true })
  })

  it('openclaw 호환: id 없이 name만 있어도 로드 + 트리거 기본값 적용', async () => {
    const dir = join(tmpdir(), 'usan-openclaw-compat-' + Date.now())
    await mkdir(dir, { recursive: true })
    const skillDir = join(dir, 'github')
    await mkdir(skillDir, { recursive: true })

    const skillContent = `---
name: GitHub Ops
description: GitHub skill
---
# GitHub Skill

Run gh commands safely.
`
    await writeFile(join(skillDir, 'SKILL.md'), skillContent, 'utf-8')

    const skills = await loadAllSkills(dir)
    expect(skills.length).toBe(1)
    expect(skills[0].meta.name).toBe('GitHub Ops')
    expect(skills[0].meta.id).toBe('github-ops')
    expect(skills[0].meta.triggers).toEqual(['GitHub Ops'])

    await rm(dir, { recursive: true, force: true })
  })

  it('존재하지 않는 디렉토리 → 빈 배열', async () => {
    const skills = await loadAllSkills('/nonexistent/path/abc123')
    expect(skills).toEqual([])
  })

  it('하위 디렉토리 재귀 탐색', async () => {
    const dir = join(tmpdir(), 'usan-recursive-' + Date.now())
    const subDir = join(dir, 'sub')
    await mkdir(subDir, { recursive: true })

    const skill1 = `---\nid: s1\nname: 스킬1\ntriggers: [하나]\n---\n본문1`
    const skill2 = `---\nid: s2\nname: 스킬2\ntriggers: [둘]\n---\n본문2`
    await writeFile(join(dir, 'one.skill.md'), skill1, 'utf-8')
    await writeFile(join(subDir, 'two.skill.md'), skill2, 'utf-8')

    const skills = await loadAllSkills(dir)
    expect(skills.length).toBe(2)
    const ids = skills.map((s) => s.meta.id).sort()
    expect(ids).toEqual(['s1', 's2'])

    await rm(dir, { recursive: true, force: true })
  })

  it('name/id 누락 시 폴더명 기반 fallback 적용', async () => {
    const dir = join(tmpdir(), 'usan-folder-fallback-' + Date.now())
    const subDir = join(dir, 'my-special-skill')
    await mkdir(subDir, { recursive: true })

    const skillContent = `---
description: fallback test
---
본문`
    await writeFile(join(subDir, 'SKILL.md'), skillContent, 'utf-8')

    const skills = await loadAllSkills(dir)
    expect(skills.length).toBe(1)
    expect(skills[0].meta.name).toBe('my-special-skill')
    expect(skills[0].meta.id).toBe('my-special-skill')
    expect(skills[0].meta.triggers).toEqual(['my-special-skill'])

    await rm(dir, { recursive: true, force: true })
  })

  it('runtime 필터: 카테고리 + 최대 개수 제한', () => {
    const base = (id: string, category: string): Skill => ({
      meta: {
        id,
        name: id,
        description: '',
        triggers: [id],
        tools: [],
        category,
        metadata: {},
      },
      procedure: '',
      filePath: `${id}.md`,
      eligible: true,
    })

    const skills: Skill[] = [
      base('a', 'security'),
      base('b', 'general'),
      base('c', 'security'),
      base('d', 'notes'),
    ]

    const filtered = filterSkillsForRuntime(skills, {
      includeCategories: ['security', 'notes'],
      maxSkills: 2,
    })

    expect(filtered.map((s) => s.meta.id)).toEqual(['a', 'c'])
  })
})
