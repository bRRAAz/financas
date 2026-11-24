import type { Frequency, Kind, Status } from './types'

export const kinds: Record<Kind, string> = { income: 'Receita', expense: 'Despesa', transfer: 'Transferência' }
export const statuses: Record<Status, string> = { pending: 'Pendente', paid: 'Pago', received: 'Recebido', cancelled: 'Cancelado' }
export const frequencies: Record<Frequency, string> = {
  weekly: 'Semanal', fortnightly: 'Quinzenal (a cada 15 dias)', monthly: 'Mensal',
  bimonthly: 'Bimestral', quarterly: 'Trimestral', semiannual: 'Semestral', yearly: 'Anual',
}
export const methods = ['Pix', 'Débito', 'Dinheiro', 'Boleto', 'Transferência', 'À vista', 'Outro']
