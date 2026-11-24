import { describe, expect, it } from 'vitest'
import { addMonths, toCents } from './dates'
import { daily, expenseBreakdown, firstInvoiceMonth, installmentValues, invoiceDates, invoices, monthly, movements, occurrences } from './finance'
import { splitRecurrence } from './recurrence-edits'
import { simulateExpense } from './simulation'
import type { Card, Exception, FinanceData, Purchase, Recurrence, Transaction } from './types'

const january = '2026-01-01'
const entry = (id: string, kind: Transaction['kind'], amount: number, planned_date: string, patch: Partial<Transaction> = {}): Transaction => ({
  id, kind, description: id, amount, planned_date, status: 'pending', effective_date: null,
  category_id: null, account_id: null, destination_id: null, method: '', notes: '', ...patch,
})
const rule = (kind: Recurrence['kind'], patch: Partial<Recurrence> = {}): Recurrence => ({
  id: 'rule', kind, description: 'Recorrência', amount: 10000, category_id: null,
  account_id: null, destination_id: null, method: '', notes: '', start_date: '2026-01-31', end_date: null,
  repeat_count: null, frequency: 'monthly', active: true, stop_before: null, anchor_day: null, superseded: false, ...patch,
})
const card: Card = { id: 'card', name: 'Cartão', institution: '', credit_limit: null, closing_day: 26,
  due_day: 5, color: '#123456', last_four: '', active: true }
const purchase: Purchase = { id: 'purchase', description: 'Compra', amount: 10000, purchase_date: january,
  category_id: 'shopping', card_id: card.id, installments: 3, first_number: 1, first_month: '2026-02-01', notes: '' }
const blank = (): FinanceData => ({ accounts: [], categories: [], transactions: [], recurring_transactions: [],
  recurrence_exceptions: [], credit_cards: [], credit_card_purchases: [], credit_card_invoices: [] })

describe('Fluxo de caixa', () => {
  it('acumula saldos nos dias com e sem lançamentos e leva o negativo ao mês seguinte', () => {
    const data = blank()
    data.transactions = [entry('Salário', 'income', 200000, '2026-01-05'), entry('Fatura', 'expense', 90000, '2026-01-07'),
      entry('Financiamento', 'expense', 139000, '2026-01-10'), entry('Internet', 'expense', 10000, '2026-01-15')]
    const result = monthly(data, january, 2, january)
    expect(result[0].days[8].closing).toBe(110000)
    expect(result[0].days[9].closing).toBe(-29000)
    expect(result[0].minimum).toMatchObject({ date: '2026-01-15', closing: -39000 })
    expect(result[1]).toMatchObject({ opening: -39000, result: 0, closing: -39000 })
  })

  it('separa saldo realizado e projetado, move vencidos para hoje e ignora cancelados', () => {
    const data = blank()
    data.accounts = [{ id: 'a', name: 'Conta', opening_date: january, opening_balance: 50000, active: true }]
    data.transactions = [
      entry('Pago em atraso', 'expense', 13000, '2026-01-02', { status: 'paid', effective_date: '2026-01-04' }),
      entry('Vencido', 'expense', 12000, '2026-01-02'),
      entry('Cancelado', 'expense', 8000, '2026-01-04', { status: 'cancelled' }),
    ]
    const days = daily(data, january, '2026-01-05', '2026-01-05')
    expect(days[0].opening).toBe(50000)
    expect(days[1].closing).toBe(50000)
    expect(days[3]).toMatchObject({ closing: 37000, realized: 37000 })
    expect(days[4]).toMatchObject({ closing: 25000, realized: 37000, entries: [{ overdue: true }] })
  })

  it('movimenta o saldo de cada conta sem alterar o saldo consolidado', () => {
    const data = blank()
    data.accounts = ['A', 'B'].map(id => ({ id, name: id, opening_date: january, opening_balance: 50000, active: true }))
    const date = '2026-01-11'
    data.transactions = [entry('Transferência', 'transfer', 15000, date, { account_id: 'A', destination_id: 'B', status: 'paid', effective_date: date })]
    expect(daily(data, date, date, date, 'A')[0].realized).toBe(35000)
    expect(daily(data, date, date, date, 'B')[0].realized).toBe(65000)
    expect(daily(data, date, date, date)[0]).toMatchObject({ closing: 100000, income: 0, expenses: 0 })
  })
})

describe('Recorrências', () => {
  it('prevê duas receitas no mesmo mês e despesas quinzenais em intervalos de 15 dias', () => {
    const data = blank()
    data.recurring_transactions = [
      rule('income', { id: 'salary-1', start_date: '2026-01-05', amount: 200000 }),
      rule('income', { id: 'salary-2', start_date: '2026-01-20', amount: 210000 }),
      rule('expense', { id: 'expense', start_date: january, frequency: 'fortnightly', repeat_count: 3 }),
    ]
    expect(monthly(data, january, 1, january)[0]).toMatchObject({ income: 410000, expenses: 30000 })
    expect(occurrences(data.recurring_transactions[2], '2026-02-28').map(item => item.date)).toEqual([january, '2026-01-16', '2026-01-31'])
  })

  it('respeita meses de tamanhos diferentes, anos bissextos e a data final', () => {
    expect(occurrences(rule('income', { start_date: '2024-01-31', end_date: '2024-04-01' }), '2024-07-01').map(item => item.date))
      .toEqual(['2024-01-31', '2024-02-29', '2024-03-31'])
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(occurrences(rule('expense', { frequency: 'bimonthly' }), '2026-10-31').map(item => item.date))
      .toEqual(['2026-01-31', '2026-03-31', '2026-05-31', '2026-07-31', '2026-09-30'])
  })

  it('substitui ou cancela ocorrências individuais e preserva a data efetiva', () => {
    const data = blank()
    data.recurring_transactions = [rule('expense')]
    const changed: Exception = { ...entry('individual', 'expense', 15500, '2026-02-28', { status: 'paid', effective_date: '2026-03-02' }),
      recurrence_id: 'rule', occurrence_date: '2026-02-28' }
    data.recurrence_exceptions = [changed, { ...changed, id: 'cancel', occurrence_date: '2026-03-31', status: 'cancelled', effective_date: null }]
    expect(movements(data, '2026-03-31', january).map(item => [item.date, item.amount])).toEqual([
      ['2026-01-31', 10000], ['2026-03-02', 15500],
    ])
  })

  it('divide uma recorrência mantendo o dia original, a quantidade restante e as confirmações', () => {
    const previous = rule('expense', { repeat_count: 4 })
    const confirmed: Exception = {
      ...entry('march', 'expense', 10000, '2026-03-31', { status: 'paid', effective_date: '2026-03-30' }),
      recurrence_id: previous.id, occurrence_date: '2026-03-31',
    }
    const result = splitRecurrence(previous, '2026-02-28', '2026-02-28', { amount: 12000 }, 'future', [confirmed])
    expect(result.next.repeat_count).toBe(3)
    expect(occurrences(result.next, '2026-06-30').map(item => item.date)).toEqual(['2026-02-28', '2026-03-31', '2026-04-30'])
    expect(result.dates).toEqual({ '2026-03-31': '2026-03-31' })
  })
})

describe('Cartões e simulação', () => {
  it('distribui centavos e conserva a ordem ao importar uma compra já parcelada', () => {
    expect(installmentValues(purchase).map(item => item.amount)).toEqual([3334, 3333, 3333])
    expect(installmentValues({ ...purchase, first_number: 2 }).map(item => [item.number, item.amount])).toEqual([[2, 3333], [3, 3333]])
    expect(toCents('1.234,56')).toBe(123456)
    expect(toCents('10.03')).toBe(1003)
  })

  it('calcula fechamento e vencimento de meses diferentes, inclusive no limite de fevereiro', () => {
    expect(firstInvoiceMonth(card, '2026-01-26')).toBe('2026-02-01')
    expect(firstInvoiceMonth(card, '2026-01-27')).toBe('2026-03-01')
    expect(invoiceDates(card, '2026-02-01')).toEqual({ closing: '2026-01-26', due: '2026-02-05' })
    expect(invoiceDates({ ...card, closing_day: 30, due_day: 31 }, '2026-02-01'))
      .toEqual({ closing: '2026-02-27', due: '2026-02-28' })
  })

  it('concilia valor manual com os itens e contabiliza apenas a fatura na data efetiva', () => {
    const data = blank()
    data.credit_cards = [card]
    data.credit_card_purchases = [purchase]
    const manual = { id: 'invoice', card_id: card.id, month: '2026-02-01', manual_amount: 5000, reconciled: false,
      paid_date: null, paid_amount: null, account_id: null, closing_date: null, due_date: null }
    data.credit_card_invoices = [manual]
    expect(invoices(data)[0]).toMatchObject({ amount: 5000, detailTotal: 3334, adjustment: 1666 })
    const pending = monthly(data, january, 2, january)
    expect(pending[0].expenses).toBe(0)
    expect(pending[1].expenses).toBe(5000)
    expect(expenseBreakdown(pending[1].entries)).toEqual([{ categoryId: 'shopping', amount: 3334 }, { categoryId: null, amount: 1666 }])
    data.credit_card_invoices = [{ ...manual, reconciled: true }]
    expect(invoices(data)[0].amount).toBe(3334)
    data.credit_card_invoices = [{ ...manual, reconciled: true, paid_date: '2026-01-29', paid_amount: 3334 }]
    const paid = monthly(data, january, 2, '2026-01-30')
    expect(paid[0].days[28]).toMatchObject({ closing: -3334, realized: -3334 })
    expect(paid[1].expenses).toBe(0)
  })

  it('simula despesa à vista ou parcelada sem modificar os dados reais', () => {
    const data = blank()
    data.credit_cards = [card]
    const simulated = simulateExpense(data, { description: 'Férias', amount: 80300, date: '2026-01-12', installments: 3, cardId: card.id })
    expect(data.credit_card_purchases).toHaveLength(0)
    expect(monthly(simulated.data, january, 4, january).map(month => month.expenses)).toEqual([0, 26767, 26767, 26766])
    const cash = simulateExpense(data, { description: 'Compra à vista', amount: 1000, date: january, installments: 1 })
    expect(daily(cash.data, january, january, january)[0].closing).toBe(-1000)
    expect(data.transactions).toHaveLength(0)
  })
})
