import { addMonths, dateInMonth, monthOf, today } from './dates'
import type { Category, FinanceData, Recurrence, Transaction } from './types'

const defaults = [
  [
    "Moradia",
    "expense",
    "#7368cf",
    "house"
  ],
  [
    "Alimentação",
    "expense",
    "#ed984c",
    "utensils"
  ],
  [
    "Transporte",
    "expense",
    "#4590ef",
    "car"
  ],
  [
    "Saúde",
    "expense",
    "#db6277",
    "heart"
  ],
  [
    "Educação",
    "expense",
    "#727ae1",
    "book"
  ],
  [
    "Lazer",
    "expense",
    "#c078c8",
    "sparkles"
  ],
  [
    "Compras",
    "expense",
    "#60a5c7",
    "bag"
  ],
  [
    "Assinaturas",
    "expense",
    "#64748b",
    "repeat"
  ],
  [
    "Investimentos",
    "expense",
    "#1b9875",
    "chart"
  ],
  [
    "Outros",
    "expense",
    "#8895a8",
    "tag"
  ],
  [
    "Salário",
    "income",
    "#169475",
    "wallet"
  ],
  [
    "Renda extra",
    "income",
    "#559bd9",
    "briefcase"
  ],
  [
    "Rendimentos",
    "income",
    "#1b9875",
    "chart"
  ],
  [
    "Reembolsos",
    "income",
    "#c09443",
    "repeat"
  ],
  [
    "Outros",
    "income",
    "#8895a8",
    "tag"
  ]
] as const

export function demoData(now = today()): FinanceData {
  const month = monthOf(now)
  const date = (day: number) => dateInMonth(month, day)
  const categories: Category[] = defaults.map(([name, kind, color, icon], index) => ({
    id: 'category-' + index, name, kind, color, icon, active: true,
  }))
  const entry = (id: string, description: string, amount: number, category: number, day: number): Transaction => {
    const kind = categories[category].kind
    const planned_date = date(day)
    const completed = planned_date <= now
    return { id, description, kind, amount, category_id: categories[category].id, account_id: 'demo-account',
      destination_id: null, method: kind === 'income' ? 'Transferência' : 'Pix', notes: '', planned_date,
      effective_date: completed ? planned_date : null, status: completed ? (kind === 'income' ? 'received' : 'paid') : 'pending' }
  }
  const transactions = [
    entry('1', 'Salário · primeira quinzena', 320000, 10, 5),
    entry('2', 'Aluguel do apartamento', 152000, 0, 8),
    entry('3', 'Compras do mês', 43860, 1, 10),
    entry('4', 'Farmácia', 8400, 3, 12),
    entry('5', 'Salário · segunda quinzena', 245000, 10, 20),
    entry('6', 'Transporte', 18000, 2, 23),
    entry('7', 'Academia', 12990, 3, 25),
    entry('8', 'Projeto freelancer', 85000, 11, 26),
    entry('9', 'Internet residencial', 11990, 0, 27),
    entry('10', 'Streaming', 5590, 7, 28),
  ]
  const recurring_transactions = transactions.filter(item => ['1', '2', '5', '7', '9', '10'].includes(item.id)).map((item): Recurrence => ({
    id: 'rule-' + item.id, description: item.description, kind: item.kind, amount: item.amount,
    category_id: item.category_id, account_id: item.account_id, destination_id: null, method: item.method, notes: '',
    start_date: addMonths(item.planned_date, 1), end_date: null, repeat_count: null, frequency: 'monthly',
    active: true, stop_before: null, anchor_day: null, superseded: false,
  }))
  return {
    accounts: [
      { id: 'demo-account', name: 'Conta principal', opening_balance: 138540, opening_date: month, active: true },
      { id: 'demo-wallet', name: 'Carteira', opening_balance: 15000, opening_date: month, active: true },
    ],
    categories, transactions, recurring_transactions, recurrence_exceptions: [],
    credit_cards: [{ id: 'demo-card', name: 'Cartão principal', institution: 'Banco digital', credit_limit: 680000,
      closing_day: 15, due_day: 24, color: '#5a6ce3', last_four: '4821', active: true }],
    credit_card_purchases: [
      { id: 'purchase-1', description: 'Notebook', amount: 181500, purchase_date: addMonths(date(11), -1), category_id: 'category-6',
        card_id: 'demo-card', installments: 6, first_number: 2, first_month: month, notes: '' },
      { id: 'purchase-2', description: 'Supermercado', amount: 26890, purchase_date: date(10), category_id: 'category-1',
        card_id: 'demo-card', installments: 1, first_number: 1, first_month: month, notes: '' },
    ], credit_card_invoices: [],
  }
}
