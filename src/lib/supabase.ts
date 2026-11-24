import { createClient } from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
const query = new URLSearchParams(window.location.search)
const fragment = new URLSearchParams(window.location.hash.slice(1))
export const callbackError = [query, fragment].flatMap(params =>
  ['error_code', 'error_description'].map(name => params.get(name))).filter(Boolean).join(' ')
export const appName = import.meta.env.VITE_APP_NAME?.trim() || 'Meu Financeiro'
export const appUrl = (import.meta.env.VITE_APP_URL?.trim() || window.location.origin).replace(/\/$/, '')
export const supabase = /^https?:\/\//.test(url ?? '') && key?.startsWith('sb_publishable_')
  ? createClient(url, key, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  : null

export function isGoogleSession(session: Session | null) {
  const providers: unknown = session?.user.app_metadata.providers
  if (!session || session.user.is_anonymous || !Array.isArray(providers) ||
      !providers.includes('google') || providers.some(provider => provider !== 'google' && provider !== 'email')) return false
  try {
    const encoded = session.access_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const claims = JSON.parse(atob(encoded)) as { amr?: { method: string }[] }
    return !!claims.amr?.some(entry => entry.method === 'oauth')
  } catch {
    return false
  }
}

export async function googleSetupIssue() {
  const response = await fetch(url + '/auth/v1/settings', { headers: { apikey: key ?? '' } })
  if (!response.ok) throw new Error('Configuração de autenticação indisponível.')
  const config = await response.json() as { external?: Record<string, boolean>; disable_signup?: boolean }
  if (!config.external?.google) return 'Ative o provedor Google no Supabase para entrar.'
  const otherSignIn = Object.entries(config.external).some(([provider, enabled]) => provider !== 'google' && enabled)
  if (!config.disable_signup || otherSignIn) {
    return 'Desative novos cadastros e mantenha somente o Google habilitado no Supabase para entrar.'
  }
  return null
}
