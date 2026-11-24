import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
export const appName = import.meta.env.VITE_APP_NAME?.trim() || 'Meu Financeiro'
export const supabase = /^https?:\/\//.test(url ?? '') && key?.startsWith('sb_publishable_')
  ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } })
  : null

export function isPasswordSession(session: Session | null) {
  const providers: unknown = session?.user.app_metadata.providers
  if (!session?.user.email || session.user.is_anonymous || !Array.isArray(providers) || !providers.includes('email')) return false
  try {
    const encoded = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(encoded)) as { amr?: { method: string }[] }
    return !!claims.amr?.some(entry => entry.method === 'password')
  } catch {
    return false
  }
}

export async function passwordSetupIssue() {
  const response = await fetch(url + '/auth/v1/settings', { headers: { apikey: key ?? '' } })
  if (!response.ok) throw new Error('Configuração de autenticação indisponível.')
  const config = await response.json() as { external?: Record<string, boolean>; disable_signup?: boolean }
  if (!config.external?.email) return 'Ative o provedor Email no Supabase para entrar.'
  const otherSignIn = Object.entries(config.external).some(([provider, enabled]) => provider !== 'email' && enabled)
  if (!config.disable_signup || otherSignIn) {
    return 'Desative novos cadastros e mantenha somente o provedor Email habilitado no Supabase.'
  }
  return null
}
