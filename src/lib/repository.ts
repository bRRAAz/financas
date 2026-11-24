import { demoData } from './demo'
import { supabase } from './supabase'
import type { Entity, Exception, FinanceData, Recurrence, Table, Theme } from './types'

const storageKey = 'meu-financeiro-demo-v1'
const themeKey = 'meu-financeiro-demo-theme'
const tables: Table[] = ['accounts', 'categories', 'transactions', 'recurring_transactions',
  'recurrence_exceptions', 'credit_cards', 'credit_card_purchases', 'credit_card_invoices']

function demoRead(): FinanceData {
  const saved = localStorage.getItem(storageKey)
  return saved ? JSON.parse(saved) as FinanceData : demoData()
}
function demoWrite(data: FinanceData) { localStorage.setItem(storageKey, JSON.stringify(data)) }
function client() {
  if (!supabase) throw new Error('Configuração do Supabase pendente.')
  return supabase
}

export interface FinanceRepository {
  read: () => Promise<{ data: FinanceData; theme: Theme }>
  save: <T extends Table>(table: T, row: Entity<T>) => Promise<void>
  remove: (table: Table, id: string) => Promise<void>
  split: (previous: Recurrence, cutoff: string, next: Recurrence, dates: Record<string, string>) => Promise<void>
  theme: (theme: Theme) => Promise<void>
}
export const demoRepository: FinanceRepository = {
  async read() { return { data: demoRead(), theme: (localStorage.getItem(themeKey) ?? 'system') as Theme } },
  async save(table, row) {
    const data = demoRead()
    let found = false
    const rows = (data[table] as { id: string }[]).map(item => {
      if (item.id !== row.id) return item
      found = true
      return row
    })
    demoWrite({ ...data, [table]: found ? rows : [...rows, row] })
  },
  async remove(table, id) {
    const data = demoRead()
    demoWrite({ ...data, [table]: data[table].filter(item => item.id !== id) })
  },
  async split(previous, cutoff, next, dates) {
    const data = demoRead()
    const rule = data.recurring_transactions.find(item => item.id === previous.id)
    if (!rule || (rule.stop_before && (rule.stop_before < cutoff || (rule.stop_before === cutoff && rule.superseded)))) {
      throw new Error('A recorrência já foi alterada.')
    }
    const recurring_transactions = data.recurring_transactions.map(item => item.id === previous.id
      ? { ...item, active: false, stop_before: cutoff, superseded: true } : item)
    const recurrence_exceptions = data.recurrence_exceptions.map((exception): Exception => {
      if (exception.recurrence_id !== previous.id || exception.occurrence_date < cutoff) return exception
      const date = dates[exception.occurrence_date]
      if (date) return { ...exception, recurrence_id: next.id, occurrence_date: date }
      return exception.status === 'pending' ? { ...exception, status: 'cancelled' } : exception
    })
    demoWrite({ ...data, recurring_transactions: [...recurring_transactions, next], recurrence_exceptions })
  },
  async theme(theme) { localStorage.setItem(themeKey, theme) },
}

async function readRows(table: Table) {
  const rows: unknown[] = []
  const size = 500
  for (let from = 0; ; from += size) {
    const { data, error } = await client().from(table).select('*').order('id').range(from, from + size - 1)
    if (error) throw error
    rows.push(...data)
    if (data.length < size) return [table, rows] as const
  }
}

export const remoteRepository: FinanceRepository = {
  async read() {
    const { error } = await client().rpc('initialize_finance')
    if (error) throw error
    const [entries, settings] = await Promise.all([
      Promise.all(tables.map(readRows)), client().from('user_settings').select('theme').single(),
    ])
    if (settings.error) throw settings.error
    return { data: Object.fromEntries(entries) as unknown as FinanceData, theme: settings.data.theme as Theme }
  },
  async save(table, row) {
    const conflict = table === 'credit_card_invoices' ? 'user_id,card_id,month'
      : table === 'recurrence_exceptions' ? 'user_id,recurrence_id,occurrence_date' : 'id'
    const { error } = await client().from(table).upsert(row, { onConflict: conflict })
    if (error) throw error
  },
  async remove(table, id) {
    const { error } = await client().from(table).delete().eq('id', id)
    if (error) throw error
  },
  async split(previous, cutoff, next, dates) {
    const { error } = await client().rpc('split_finance_recurrence', {
      old_id: previous.id, cutoff, replacement: next, new_dates: dates,
    })
    if (error) throw error
  },
  async theme(theme) {
    const { data: { user }, error: authError } = await client().auth.getUser()
    if (authError || !user) throw authError ?? new Error('Sessão encerrada.')
    const { error } = await client().from('user_settings').update({ theme }).eq('user_id', user.id)
    if (error) throw error
  },
}
