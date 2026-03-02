import { create } from 'zustand'

export interface UserProfile {
  id: string
  email?: string
  displayName?: string
  avatarUrl?: string
}

interface AuthState {
  user: UserProfile | null
  loading: boolean
  error: string | null
  checkSession: () => Promise<void>
  login: (email: string, password: string) => Promise<boolean>
  signup: (email: string, password: string, displayName?: string) => Promise<boolean>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,

  checkSession: async () => {
    set({ loading: true })
    try {
      const result = await window.usan?.auth.session()
      if (result?.success && result.user) {
        set({ user: result.user as UserProfile, loading: false, error: null })
      } else {
        set({ user: null, loading: false, error: null })
      }
    } catch {
      set({ user: null, loading: false })
    }
  },

  login: async (email: string, password: string) => {
    set({ loading: true, error: null })
    try {
      const result = await window.usan?.auth.login(email, password)
      if (result?.success && result.user) {
        set({ user: result.user as UserProfile, loading: false, error: null })
        return true
      }
      set({ loading: false, error: result?.error || '로그인 실패' })
      return false
    } catch (err) {
      set({ loading: false, error: (err as Error).message })
      return false
    }
  },

  signup: async (email: string, password: string, displayName?: string) => {
    set({ loading: true, error: null })
    try {
      const result = await window.usan?.auth.signup(email, password, displayName)
      if (result?.success && result.user) {
        set({ user: result.user as UserProfile, loading: false, error: null })
        return true
      }
      set({ loading: false, error: result?.error || '회원가입 실패' })
      return false
    } catch (err) {
      set({ loading: false, error: (err as Error).message })
      return false
    }
  },

  logout: async () => {
    set({ loading: true })
    try {
      await window.usan?.auth.logout()
    } catch {
      // ignore
    }
    set({ user: null, loading: false, error: null })
  },
}))
