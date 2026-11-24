import { addDays, addMonths, dateInMonth, daysBetween, endOfMonth, monthOf, monthsBetween } from './dates'
import type { Card, FinanceData, InvoiceRecord, Purchase, Recurrence, Transaction } from './types'

const intervals = { monthly: 1, bimonthly: 2, quarterly: 3, semiannual: 6, yearly: 12 }
export function occurrenceAt(rule: Recurrence, index: number) {
  if (rule.frequency === 'weekly' || rule.frequency === 'fortnightly') {
    return addDays(rule.start_date, index * (rule.frequency === 'weekly' ? 7 : 15))
  }
  const date = addMonths(rule.start_date, index * intervals[rule.frequency])
  return index > 0 && rule.anchor_day ? dateInMonth(monthOf(date), rule.anchor_day) : date
}

export function occurrences(rule: Recurrence, end: string, start = rule.start_date) {
  if ((!rule.active && !rule.stop_before) || end < rule.start_date) return []
  const frequency = rule.frequency
  const first = Math.max(0, Math.floor(frequency === 'weekly' || frequency === 'fortnightly'
    ? daysBetween(rule.start_date, start) / (frequency === 'weekly' ? 7 : 15)
    : monthsBetween(rule.start_date, start) / intervals[frequency]))
  const result: { date: string; index: number }[] = []
  for (let index = first; rule.repeat_count === null || index < rule.repeat_count; index++) {
    const date = occurrenceAt(rule, index)
    if (date > end || (rule.end_date && date > rule.end_date) || (rule.stop_before && date >= rule.stop_before)) break
    if (date >= start) result.push({ date, index })
  }
  return result
}

export interface Installment {
  purchase: Purchase; number: number; amount: number; month: string
}
export function installmentValues(purchase: Purchase): Installment[] {
  const base = Math.floor(purchase.amount / purchase.installments)
  const remainder = purchase.amount % purchase.installments
  return Array.from({ length: purchase.installments - purchase.first_number + 1 }, (_, index) => {
    const number = purchase.first_number + index
    return {
      purchase, number, amount: base + Number(number <= remainder),
      month: addMonths(purchase.first_month, index),
    }
  })
}
export function invoiceDates(card: Card, month: string) {
  const closingMonth = card.closing_day >= card.due_day ? addMonths(month, -1) : month
  const due = dateInMonth(month, card.due_day)
  const closing = dateInMonth(closingMonth, card.closing_day)
  return { closing: closing >= due ? addDays(due, -1) : closing, due }
}
export function firstInvoiceMonth(card: Card, date: string) {
  let month = monthOf(date)
  while (invoiceDates(card, month).closing < date) month = addMonths(month, 1)
  return month
}

export interface Invoice {
  card: Card; month: string; items: Installment[]; amount: number; detailTotal: number
  adjustment: number; closing: string; due: string; record?: InvoiceRecord
}
export function invoices(data: FinanceData, include: { cardId: string; month: string }[] = []) {
  const result: Invoice[] = []
  for (const card of data.credit_cards) {
    const grouped = new Map<string, Installment[]>()
    for (const purchase of data.credit_card_purchases.filter(item => item.card_id === card.id)) {
      for (const item of installmentValues(purchase)) {
        const group = grouped.get(item.month) ?? []
        group.push(item)
        grouped.set(item.month, group)
      }
    }
    const records = new Map(data.credit_card_invoices.filter(item => item.card_id === card.id).map(item => [item.month, item]))
    const months = new Set([...grouped.keys(), ...records.keys(), ...include.filter(item => item.cardId === card.id).map(item => item.month)])
    for (const month of months) {
      const record = records.get(month)
      const items = grouped.get(month) ?? []
      const detailTotal = items.reduce((total, item) => total + item.amount, 0)
      const amount = record?.paid_amount ?? (record?.manual_amount != null && !record.reconciled
        ? Math.max(record.manual_amount, detailTotal) : detailTotal)
      const dates = invoiceDates(card, month)
      result.push({ card, month, items, record, amount, detailTotal, adjustment: amount - detailTotal,
        closing: record?.closing_date ?? dates.closing, due: record?.due_date ?? dates.due })
    }
  }
  return result.sort((a, b) => a.due.localeCompare(b.due) || a.card.name.localeCompare(b.card.name))
}

export interface Movement extends Transaction {
  date: string; overdue: boolean; recurrenceId?: string; occurrenceDate?: string; invoice?: Invoice
}
export function isConfirmed(item: Transaction) { return item.status === 'paid' || item.status === 'received' }

export function movements(data: FinanceData, end: string, asOf: string): Movement[] {
  const entries: (Transaction & { recurrenceId?: string; occurrenceDate?: string; invoice?: Invoice })[] = [...data.transactions]
  const exceptions = new Set(data.recurrence_exceptions.map(item => item.recurrence_id + item.occurrence_date))
  for (const item of data.recurrence_exceptions) {
    entries.push({ ...item, recurrenceId: item.recurrence_id, occurrenceDate: item.occurrence_date })
  }
  for (const rule of end >= asOf ? data.recurring_transactions : []) {
    for (const { date } of occurrences(rule, end)) {
      if (exceptions.has(rule.id + date)) continue
      entries.push({ ...rule, id: rule.id + ':' + date, planned_date: date, effective_date: null,
        status: 'pending', recurrenceId: rule.id, occurrenceDate: date })
    }
  }
  for (const invoice of invoices(data)) {
    if (!invoice.amount) continue
    entries.push({
      id: invoice.card.id + ':' + invoice.month, description: 'Fatura · ' + invoice.card.name,
      kind: 'expense', amount: invoice.amount, category_id: null, account_id: invoice.record?.account_id ?? null,
      destination_id: null, method: 'Cartão de crédito', notes: '', planned_date: invoice.due,
      effective_date: invoice.record?.paid_date ?? null, status: invoice.record?.paid_date ? 'paid' : 'pending', invoice,
    })
  }
  return entries.filter(item => item.status !== 'cancelled').map(item => {
    const overdue = item.status === 'pending' && item.planned_date < asOf
    const date = isConfirmed(item) ? item.effective_date ?? item.planned_date : overdue ? asOf : item.planned_date
    return { ...item, date, overdue }
  }).filter(item => item.date <= end).sort((a, b) => a.date.localeCompare(b.date) || a.description.localeCompare(b.description))
}

export interface DayBalance {
  date: string; opening: number; income: number; expenses: number; closing: number
  realized: number; entries: Movement[]; accountOpening: number
}
function valueFor(item: Movement, accountId?: string) {
  if (!accountId) return item.kind === 'transfer' ? 0 : item.kind === 'income' ? item.amount : -item.amount
  if (item.kind === 'transfer' && item.destination_id === accountId) return item.amount
  if (item.account_id !== accountId) return 0
  return item.kind === 'income' ? item.amount : -item.amount
}

export function daily(data: FinanceData, start: string, end: string, asOf: string, accountId?: string): DayBalance[] {
  const accounts = accountId ? data.accounts.filter(account => account.id === accountId) : data.accounts
  const accountDates = new Map(data.accounts.map(account => [account.id, account.opening_date]))
  const entries = movements(data, end, asOf).filter(item => {
    if (accountId) return item.date >= (accountDates.get(accountId) ?? item.date) && valueFor(item, accountId) !== 0
    return !item.account_id || item.kind === 'transfer' || item.date >= (accountDates.get(item.account_id) ?? item.date)
  })
  const initial = accounts.filter(account => account.opening_date < start).reduce((total, account) => total + account.opening_balance, 0)
  let closing = initial
  let realized = initial
  const byDate = new Map<string, Movement[]>()
  for (const item of entries) {
    if (item.date < start) {
      closing += valueFor(item, accountId)
      if (isConfirmed(item)) realized += valueFor(item, accountId)
    } else {
      const group = byDate.get(item.date) ?? []
      group.push(item)
      byDate.set(item.date, group)
    }
  }
  const result: DayBalance[] = []
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const group = byDate.get(date) ?? []
    const accountOpening = accounts.filter(account => account.opening_date === date).reduce((total, account) => total + account.opening_balance, 0)
    const opening = closing + accountOpening
    let income = 0
    let expenses = 0
    realized += accountOpening
    for (const item of group) {
      const value = valueFor(item, accountId)
      if (isConfirmed(item)) realized += value
      if (value > 0) income += value
      if (value < 0) expenses -= value
    }
    closing = opening + income - expenses
    result.push({ date, opening, income, expenses, closing, realized, entries: group, accountOpening })
  }
  return result
}

export function monthly(data: FinanceData, firstMonth: string, count: number, asOf: string) {
  const start = monthOf(firstMonth)
  const days = daily(data, start, endOfMonth(addMonths(start, count - 1)), asOf)
  return Array.from({ length: count }, (_, index) => {
    const month = addMonths(start, index)
    const group = days.filter(day => monthOf(day.date) === month)
    const entries = group.flatMap(day => day.entries)
    const income = group.reduce((total, day) => total + day.income, 0)
    const expenses = group.reduce((total, day) => total + day.expenses, 0)
    const invoicesTotal = entries.reduce((total, item) => total + (item.invoice ? item.amount : 0), 0)
    return {
      month, days: group, entries, opening: group[0].opening - (index > 0 ? group[0].accountOpening : 0),
      accountOpening: group.slice(index > 0 ? 0 : 1).reduce((total, day) => total + day.accountOpening, 0),
      income, expenses, invoicesTotal, result: income - expenses, closing: group[group.length - 1].closing,
      minimum: group.reduce((minimum, day) => day.closing < minimum.closing ? day : minimum, group[0]),
    }
  })
}

export function expenseBreakdown(entries: Movement[]) {
  return entries.filter(item => item.kind === 'expense').flatMap(item => {
    if (!item.invoice) return [{ categoryId: item.category_id, amount: item.amount }]
    const { items, adjustment } = item.invoice
    return [
      ...items.map(part => ({ categoryId: part.purchase.category_id, amount: part.amount })),
      ...(adjustment > 0 ? [{ categoryId: null, amount: adjustment }] : []),
    ]
  })
}
