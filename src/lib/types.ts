export type Kind = 'income' | 'expense' | 'transfer'
export type Status = 'pending' | 'paid' | 'received' | 'cancelled'
export type Frequency = 'weekly' | 'fortnightly' | 'monthly' | 'bimonthly' | 'quarterly' | 'semiannual' | 'yearly'

interface Row { id: string }
export interface Category extends Row {
  name: string; kind: 'income' | 'expense'; color: string; icon: string; active: boolean
}
export interface Account extends Row {
  name: string; opening_balance: number; opening_date: string; active: boolean
}
export interface EntryFields {
  description: string; kind: Kind; amount: number; category_id: string | null
  account_id: string | null; destination_id: string | null; method: string; notes: string
}
export interface Transaction extends Row, EntryFields {
  planned_date: string; effective_date: string | null; status: Status
}
export interface Recurrence extends Row, EntryFields {
  start_date: string; end_date: string | null; repeat_count: number | null
  frequency: Frequency; active: boolean; stop_before: string | null; anchor_day: number | null; superseded: boolean
}
export interface Exception extends Transaction {
  recurrence_id: string; occurrence_date: string
}
export interface Card extends Row {
  name: string; institution: string; credit_limit: number | null; closing_day: number
  due_day: number; color: string; last_four: string; active: boolean
}
export interface Purchase extends Row {
  description: string; amount: number; purchase_date: string; category_id: string | null
  card_id: string; installments: number; first_number: number; first_month: string; notes: string
}
export interface InvoiceRecord extends Row {
  card_id: string; month: string; manual_amount: number | null; reconciled: boolean
  paid_date: string | null; paid_amount: number | null; account_id: string | null
  closing_date: string | null; due_date: string | null
}
export interface FinanceData {
  accounts: Account[]; categories: Category[]; transactions: Transaction[]
  recurring_transactions: Recurrence[]; recurrence_exceptions: Exception[]
  credit_cards: Card[]; credit_card_purchases: Purchase[]; credit_card_invoices: InvoiceRecord[]
}
export type Table = keyof FinanceData
export type Entity<T extends Table> = FinanceData[T][number]
export type Theme = 'light' | 'dark' | 'system'
