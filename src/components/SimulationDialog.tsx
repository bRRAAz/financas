import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { CircleAlert } from 'lucide-react'
import { useFinance } from '../lib/context'
import { addMonths, brDate, brl, monthLabel, monthOf, monthsBetween, toCents } from '../lib/dates'
import { invoices, monthly } from '../lib/finance'
import { dateField, integerField, moneyField, nameField } from '../lib/forms'
import { simulateExpense } from '../lib/simulation'
import { useSave } from '../lib/use-save'
import { BalanceChart } from './charts'
import { Button, Field, Modal, Money, Select } from './ui'

const schema = z.object({
  description: nameField(), amount: moneyField(), date: dateField, card: z.string(), installments: integerField(1, 120),
}).refine(value => !value.card || toCents(value.amount) >= Number(value.installments), {
  path: ['installments'], message: 'As parcelas precisam ter pelo menos um centavo.',
})
type Values = z.infer<typeof schema>

export function SimulationDialog({ onClose }: { onClose: () => void }) {
  const { data, now, repository } = useFinance()
  const save = useSave()
  const [result, setResult] = useState<ReturnType<typeof simulateExpense> | null>(null)
  const [origin, setOrigin] = useState(now)
  const [dailyMonth, setDailyMonth] = useState('')
  const { register, handleSubmit, control, formState: { errors, isDirty }, reset } = useForm<Values>({
    resolver: zodResolver(schema), defaultValues: { description: '', amount: '', date: now, card: '', installments: '1' },
  })
  const cardId = useWatch({ control, name: 'card' })
  const start = monthOf(origin)
  const lastBill = result?.purchase && addMonths(result.purchase.first_month, result.purchase.installments - 1)
  const horizon = lastBill ? Math.max(6, monthsBetween(start, lastBill) + 1) : 6
  const projection = result ? monthly(result.data, start, horizon, now) : []
  const baseline = result ? monthly(data, start, horizon, now) : []
  const firstAffected = projection.find((period, index) => period.days.some((day, position) => day.closing !== baseline[index].days[position].closing))
  const dailyPeriod = projection.find(period => period.month === dailyMonth) ?? firstAffected
  const dailyBaseline = baseline.find(period => period.month === dailyPeriod?.month)
  const negative = projection.flatMap(period => period.days).find(day => day.date >= now && day.closing < 0)
  const oldInvoices = new Map(invoices(data).map(item => [item.card.id + item.month, item.amount]))
  const changedInvoices = result?.purchase ? invoices(result.data).filter(item => item.card.id === result.purchase.card_id &&
    item.items.some(part => part.purchase.id === result.purchase.id)) : []
  const hasChanges = changedInvoices.some(item => (oldInvoices.get(item.card.id + item.month) ?? 0) !== item.amount)

  return <Modal title="Simular gasto" description="Compare a previsão atual com o cenário antes de registrar a despesa." onClose={onClose} wide>
    <form className="form-grid" onSubmit={handleSubmit(values => {
      const card = data.credit_cards.find(item => item.id === values.card)
      if (values.date < now) return
      const next = simulateExpense(data, { description: values.description, amount: toCents(values.amount),
        date: values.date, installments: card ? Number(values.installments) : 1, cardId: card?.id })
      setOrigin(values.date)
      setDailyMonth('')
      setResult(next)
      reset(values)
    })}>
      <Field label="Descrição" error={errors.description?.message} full><input placeholder="Ex.: compra de um notebook" {...register('description')} /></Field>
      <Field label="Valor (R$)" error={errors.amount?.message}><input inputMode="decimal" placeholder="0,00" {...register('amount')} /></Field>
      <Field label="Data prevista" error={errors.date?.message}><input type="date" min={now} required {...register('date')} /></Field>
      <Field label="Pagamento"><Select {...register('card')}><option value="">À vista</option>
        {data.credit_cards.filter(item => item.active).map(item => <option value={item.id} key={item.id}>Cartão · {item.name}</option>)}
      </Select></Field>
      {cardId && <Field label="Número de parcelas" error={errors.installments?.message}><input type="number" min="1" max="120" {...register('installments')} /></Field>}
      <div className="form-actions field-full"><Button type="submit" variant="secondary"><CircleAlert size={16} aria-hidden="true" /> Calcular impacto</Button></div>
    </form>
    {result && !isDirty && <>
      {negative && <div className="negative-banner"><CircleAlert size={18} /> Cenário com saldo negativo de {brl(Math.abs(negative.closing))} em {brDate(negative.date)}.</div>}
      {firstAffected && dailyPeriod && dailyBaseline && <section className="simulation-section">
        <div className="inline-actions simulation-heading">
          <h3>Saldo diário</h3>
          <Select value={dailyPeriod.month} aria-label="Mês do saldo diário simulado" onChange={event => setDailyMonth(event.target.value)}>
            {projection.map(period => <option value={period.month} key={period.month}>{monthLabel(period.month)}</option>)}
          </Select>
        </div>
        <BalanceChart points={dailyPeriod.days.map((day, index) => ({
          label: day.date.slice(-2), value: day.closing, baseline: dailyBaseline.days[index].closing,
        }))} name="Saldo diário simulado" />
        <p className="muted">Primeira mudança em {brDate(firstAffected.days.find((day, index) => day.closing !== baseline.find(item => item.month === firstAffected.month)?.days[index].closing)!.date)}.</p>
      </section>}
      {changedInvoices.length > 0 && <section className="simulation-section">
        <h3>Próximas faturas</h3>
        {!hasChanges && <p className="muted">Os totais manuais das faturas já cobrem as parcelas deste cenário.</p>}
        <div className="table-scroll"><table className="finance-table">
          <thead><tr><th>Vencimento</th><th>Atual</th><th>Simulado</th></tr></thead>
          <tbody>{changedInvoices.map(item => <tr key={item.month}><th>{brDate(item.due)}</th>
            <td><Money value={oldInvoices.get(item.card.id + item.month) ?? 0} /></td><td><Money value={item.amount} /></td></tr>)}</tbody>
        </table></div>
      </section>}
      <section className="simulation-section"><h3>Impacto mensal e acumulado</h3>
        <div className="table-scroll"><table className="finance-table">
          <thead><tr><th>Mês</th><th>Sobra simulada</th><th>Saldo atual</th><th>Saldo simulado</th><th>Diferença acumulada</th></tr></thead>
          <tbody>{projection.map((month, index) => <tr key={month.month}><th>{monthLabel(month.month)}</th>
            <td><Money value={month.result} tone /></td><td><Money value={baseline[index].closing} /></td>
            <td><Money value={month.closing} tone /></td><td><Money value={month.closing - baseline[index].closing} tone /></td></tr>)}</tbody>
        </table></div>
      </section>
      <div className="form-actions"><Button variant="secondary" onClick={onClose}>Fechar</Button>
        <Button disabled={save.isPending} onClick={() => save.mutate({
          run: () => result.purchase ? repository.save('credit_card_purchases', result.purchase)
            : repository.save('transactions', result.transaction!),
          message: 'Despesa da simulação registrada.', done: onClose,
        })}>Registrar despesa</Button></div>
    </>}
  </Modal>
}
