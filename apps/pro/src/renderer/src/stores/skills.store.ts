import { create } from 'zustand'
import type { SkillMeta } from '@shared/types'

type Panel = 'skills' | 'history'

interface SkillsState {
  skills: SkillMeta[]
  isLoading: boolean
  query: string
  selectedSkill: SkillMeta | null
  skillContent: string
  activePanel: Panel
  // Active skill as system prompt
  activatedSkill: SkillMeta | null
  activatedContent: string

  setPanel: (panel: Panel) => void
  search: (q: string) => Promise<void>
  selectSkill: (skill: SkillMeta) => Promise<void>
  activateSkill: (skill: SkillMeta) => Promise<void>
  deactivateSkill: () => void
  clearSelection: () => void
  reindex: () => Promise<number>
}

export const useSkillsStore = create<SkillsState>((set) => ({
  skills: [],
  isLoading: false,
  query: '',
  selectedSkill: null,
  skillContent: '',
  activePanel: 'skills',
  activatedSkill: null,
  activatedContent: '',

  setPanel: (panel) => set({ activePanel: panel }),

  search: async (q) => {
    set({ isLoading: true, query: q })
    try {
      const skills = await window.usan.skills.list(q || undefined)
      set({ skills, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  selectSkill: async (skill) => {
    set({ selectedSkill: skill, skillContent: '' })
    const content = await window.usan.skills.read(skill.skillPath)
    set({ skillContent: content })
  },

  activateSkill: async (skill) => {
    const content = await window.usan.skills.read(skill.skillPath)
    set({ activatedSkill: skill, activatedContent: content })
  },

  deactivateSkill: () => set({ activatedSkill: null, activatedContent: '' }),

  clearSelection: () => set({ selectedSkill: null, skillContent: '' }),

  reindex: async () => {
    set({ isLoading: true })
    const { count } = await window.usan.skills.reindex()
    const skills = await window.usan.skills.list()
    set({ skills, isLoading: false })
    return count
  },
}))
