import { firstInvoiceMonth } from './finance'
import type { FinanceData, Purchase, Transaction } from './types'

export function simulateExpense(data: FinanceData, input: {
  description: string; amount: number; date: string; installments: number; cardId?: string
}) {
  const card = data.credit_cards.find(item => item.id === input.cardId)
  const base = { id: crypto.randomUUID(), description: input.description, amount: input.amount, category_id: null, notes: '' }
  if (card) {
    const purchase: Purchase = {
      ...base, card_id: card.id, purchase_date: input.date, installments: input.installments,
      first_month: firstInvoiceMonth(card, input.date), first_number: 1,
    }
    return { data: { ...data, credit_card_purchases: [...data.credit_card_purchases, purchase] }, purchase }
  }
  const transaction: Transaction = { ...base, kind: 'expense', account_id: null, destination_id: null,
    method: 'À vista', planned_date: input.date, effective_date: null, status: 'pending' }
  return { data: { ...data, transactions: [...data.transactions, transaction] }, transaction }
}
