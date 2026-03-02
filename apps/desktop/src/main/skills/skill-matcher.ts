import type { Skill, SkillMeta } from './skill-loader'

export interface SkillMatch {
  skill: Skill
  score: number
  matchedTrigger: string
}

export function matchSkills(message: string, skills: Skill[], maxResults = 3): SkillMatch[] {
  const normalizedMsg = normalize(message)
  const matches: SkillMatch[] = []

  for (const skill of skills) {
    let bestScore = 0
    let bestTrigger = ''

    for (const trigger of skill.meta.triggers) {
      const normalizedTrigger = normalize(trigger)
      const score = calculateScore(normalizedMsg, normalizedTrigger)
      if (score > bestScore) {
        bestScore = score
        bestTrigger = trigger
      }
    }

    const nameScore = calculateScore(normalizedMsg, normalize(skill.meta.name)) * 0.8
    if (nameScore > bestScore) {
      bestScore = nameScore
      bestTrigger = skill.meta.name
    }

    if (bestScore >= 0.3) {
      matches.push({ skill, score: bestScore, matchedTrigger: bestTrigger })
    }
  }

  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults)
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function calculateScore(message: string, trigger: string): number {
  if (message.includes(trigger)) return 1.0

  const msgWords = message.split(/\s+/)
  const trigWords = trigger.split(/\s+/)

  let matchedWords = 0
  for (const tw of trigWords) {
    if (tw.length < 2) continue
    if (msgWords.some((mw) => mw.includes(tw) || tw.includes(mw))) {
      matchedWords++
    }
  }

  if (trigWords.length === 0) return 0
  return matchedWords / trigWords.length
}

export function formatSkillContext(matches: SkillMatch[]): string {
  if (matches.length === 0) return ''

  const lines = ['## 관련 스킬 가이드\n']
  for (const m of matches) {
    lines.push(`### ${m.skill.meta.name}`)
    lines.push(m.skill.procedure)
    lines.push('')
  }
  return lines.join('\n')
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const MAX_SKILL_DESC_LENGTH = 200

export function formatAvailableSkills(skills: Skill[]): string {
  if (skills.length === 0) return ''
  const entries = skills.map((s) => {
    const emoji = s.meta.metadata?.emoji ? ` emoji="${escapeXml(s.meta.metadata.emoji)}"` : ''
    const desc = s.meta.description.length > MAX_SKILL_DESC_LENGTH
      ? s.meta.description.slice(0, MAX_SKILL_DESC_LENGTH)
      : s.meta.description
    return `  <skill name="${escapeXml(s.meta.name)}" description="${escapeXml(desc)}" id="${escapeXml(s.meta.id)}"${emoji} />`
  }).join('\n')
  return `<available_skills>\n${entries}\n</available_skills>`
}
