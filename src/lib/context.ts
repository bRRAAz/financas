import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'
import type { FinanceRepository } from './repository'
import type { FinanceData, Kind, Theme } from './types'
import type { Movement } from './finance'

export interface EntryDialogState { date?: string; kind?: Kind; movement?: Movement; duplicate?: boolean }
export const FinanceContext = createContext<{
  data: FinanceData
  theme: Theme
  repository: FinanceRepository
  demo: boolean
  user: User | null
  now: string
  month: string
  setMonth: (month: string) => void
  openEntry: (options?: EntryDialogState) => void
  signOut: () => Promise<void>
  notice: (message: string, error?: boolean) => void
} | null>(null)

export function useFinance() {
  const value = useContext(FinanceContext)
  if (!value) throw new Error('Dados financeiros indisponíveis.')
  return value
}
