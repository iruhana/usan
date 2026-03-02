/**
 * Authentication manager — Supabase Auth integration.
 *
 * Supports:
 * - Email/password sign-in and sign-up
 * - Phone OTP sign-in (senior-friendly)
 * - Session management
 */

import { getSupabaseClient } from './supabase-client'

export interface UserProfile {
  id: string
  email?: string
  phone?: string
  displayName?: string
  avatarUrl?: string
}

export interface AuthResult {
  success: boolean
  user?: UserProfile
  error?: string
}

function toProfile(user: { id: string; email?: string; phone?: string; user_metadata?: Record<string, unknown> }): UserProfile {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: (user.user_metadata?.display_name as string) || (user.user_metadata?.full_name as string) || undefined,
    avatarUrl: (user.user_metadata?.avatar_url as string) || undefined,
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { success: false, error: error.message }
    if (!data.user) return { success: false, error: '로그인 실패' }
    return { success: true, user: toProfile(data.user) }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export async function signUp(email: string, password: string, displayName?: string): Promise<AuthResult> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: displayName ? { data: { display_name: displayName } } : undefined,
    })
    if (error) return { success: false, error: error.message }
    if (!data.user) return { success: false, error: '회원가입 실패' }
    return { success: true, user: toProfile(data.user) }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export async function signInWithOTP(phone: string): Promise<AuthResult> {
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.signInWithOtp({ phone })
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export async function verifyOTP(phone: string, token: string): Promise<AuthResult> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.verifyOtp({ phone, token, type: 'sms' })
    if (error) return { success: false, error: error.message }
    if (!data.user) return { success: false, error: '인증 실패' }
    return { success: true, user: toProfile(data.user) }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export async function signOut(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.signOut()
    if (error) return { success: false, error: error.message }
    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

export async function getSession(): Promise<AuthResult> {
  try {
    const supabase = getSupabaseClient()
    const { data, error } = await supabase.auth.getSession()
    if (error) return { success: false, error: error.message }
    if (!data.session?.user) return { success: false }
    return { success: true, user: toProfile(data.session.user) }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}
