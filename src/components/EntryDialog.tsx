import { useWatch, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useFinance, type EntryDialogState } from '../lib/context'
import { dateField, frequencyField, integerField, moneyField, monthField, nameField, optional } from '../lib/forms'
import { fromCents, toCents } from '../lib/dates'
import { firstInvoiceMonth, isConfirmed } from '../lib/finance'
import { frequencies, kinds, methods, statuses } from '../lib/labels'
import { splitRecurrence } from '../lib/recurrence-edits'
import type { EntryFields, Exception, Recurrence, Transaction } from '../lib/types'
import { useSave } from '../lib/use-save'
import { Button, Field, Modal, Select } from './ui'

const credit = 'Cartão de crédito'
const entrySchema = z.object({
  description: nameField(), kind: z.enum(['income', 'expense', 'transfer']), amount: moneyField(),
  date: dateField, category: z.string(), account: z.string(), destination: z.string(),
  method: z.string(), notes: z.string().max(2000), status: z.enum(['pending', 'paid', 'received']),
  effective: optional(dateField), recurrence: z.boolean(), frequency: frequencyField,
  scope: z.enum(['single', 'future', 'all']), card: z.string(), installments: integerField(1, 120),
  firstMonth: optional(monthField),
}).superRefine((value, ctx) => {
  if (value.kind === 'transfer') {
    if (!value.account) ctx.addIssue({ code: 'custom', path: ['account'], message: 'Selecione a conta de origem.' })
    if (!value.destination || value.destination === value.account) {
      ctx.addIssue({ code: 'custom', path: ['destination'], message: 'Selecione outra conta como destino.' })
    }
  }
  if (value.status !== 'pending' && !value.effective && !value.recurrence && value.method !== credit) {
    ctx.addIssue({ code: 'custom', path: ['effective'], message: 'Informe a data efetiva.' })
  }
  if (value.kind === 'expense' && value.method === credit) {
    if (!value.card) ctx.addIssue({ code: 'custom', path: ['card'], message: 'Selecione um cartão.' })
    if (toCents(value.amount) < Number(value.installments)) {
      ctx.addIssue({ code: 'custom', path: ['installments'], message: 'As parcelas precisam ter pelo menos um centavo.' })
    }
  }
})
type EntryForm = z.infer<typeof entrySchema>

export function EntryDialog({ options, onClose }: { options: EntryDialogState; onClose: () => void }) {
  const { data, now, repository } = useFinance()
  const mutation = useSave()
  const item = options.movement
  const recurrenceId = item?.recurrenceId
  const editing = !!item && !options.duplicate
  const rule = editing && item.recurrenceId ? data.recurring_transactions.find(entry => entry.id === item.recurrenceId) : undefined
  const occurrence = editing && item.recurrenceId && item.occurrenceDate ? item.occurrenceDate : undefined
  const allowScope = !!rule && !rule.superseded && !!occurrence && !!item && !isConfirmed(item)
  const { register, control, handleSubmit, setValue, setError, formState: { errors } } = useForm<EntryForm>({
    resolver: zodResolver(entrySchema),
    defaultValues: {
      description: item ? (options.duplicate ? item.description.slice(0, 152) + ' · cópia' : item.description) : '',
      kind: options.kind ?? item?.kind ?? 'expense',
      amount: item ? fromCents(item.amount) : '', date: options.date ?? item?.planned_date ?? now,
      category: item?.category_id ?? '', account: item?.account_id ?? '', destination: item?.destination_id ?? '',
      method: item?.method ?? '', notes: item?.notes ?? '', status: editing && item.status !== 'cancelled' ? item.status : 'pending',
      effective: editing ? item.effective_date ?? '' : '', recurrence: false, frequency: 'monthly',
      scope: 'single', card: '', installments: '1', firstMonth: '',
    },
  })
  const [kind, method, status, recurrence, scope, cardId, date] = useWatch({
    control, name: ['kind', 'method', 'status', 'recurrence', 'scope', 'card', 'date'],
  })
  const cardPurchase = !editing && kind === 'expense' && method === credit
  const card = data.credit_cards.find(item => item.id === cardId)
  const autoMonth = card && date ? firstInvoiceMonth(card, date).slice(0, 7) : ''
  const category = useWatch({ control, name: 'category' })
  const account = useWatch({ control, name: 'account' })
  const destination = useWatch({ control, name: 'destination' })
  const accountList = data.accounts.filter(row => row.active || row.id === account || row.id === destination)
  const kindRegister = register('kind')
  const methodRegister = register('method')

  function save(values: EntryForm) {
    if (values.status !== 'pending' && values.effective > now) {
      setError('effective', { message: 'Informe uma data até hoje.' })
      return
    }
    const fields: EntryFields = {
      description: values.description, kind: values.kind, amount: toCents(values.amount),
      category_id: values.kind === 'transfer' ? null : values.category || null,
      account_id: values.account || null, destination_id: values.kind === 'transfer' ? values.destination : null,
      method: values.kind === 'transfer' ? 'Transferência' : values.method, notes: values.notes.trim(),
    }
    const transaction: Transaction = {
      ...fields, id: editing ? item.id : crypto.randomUUID(), planned_date: values.date,
      status: values.status === 'pending' ? 'pending' : values.kind === 'income' ? 'received' : 'paid',
      effective_date: values.status === 'pending' ? null : values.effective,
    }
    const run = async () => {
      if (cardPurchase && card) {
        await repository.save('credit_card_purchases', {
          id: transaction.id, description: fields.description, amount: fields.amount, category_id: fields.category_id,
          notes: fields.notes, card_id: card.id, purchase_date: values.date, installments: Number(values.installments),
          first_number: 1, first_month: (values.firstMonth || autoMonth) + '-01',
        })
      } else if (rule && occurrence && recurrenceId) {
        const existing = data.recurrence_exceptions.find(entry => entry.recurrence_id === recurrenceId && entry.occurrence_date === occurrence)
        if (values.scope === 'single' || !allowScope) {
          const exception: Exception = { ...transaction, id: existing?.id ?? crypto.randomUUID(),
            recurrence_id: recurrenceId, occurrence_date: occurrence }
          await repository.save('recurrence_exceptions', exception)
        } else {
          const split = splitRecurrence(rule, occurrence, values.date, fields, values.scope, data.recurrence_exceptions)
          await repository.split(rule, split.cutoff, split.next, split.dates)
        }
      } else if (values.recurrence && !editing) {
        const recurrence: Recurrence = { ...fields, id: transaction.id, start_date: values.date, end_date: null,
          repeat_count: null, frequency: values.frequency, active: true, stop_before: null, anchor_day: null, superseded: false }
        await repository.save('recurring_transactions', recurrence)
      } else {
        await repository.save('transactions', transaction)
      }
    }
    mutation.mutate({ run, message: cardPurchase ? 'Compra registrada.' : 'Lançamento salvo.', done: onClose })
  }

  return <Modal title={editing ? 'Editar lançamento' : options.duplicate ? 'Duplicar lançamento' : 'Novo lançamento'}
    description={cardPurchase ? 'A compra entra no fluxo de caixa no pagamento ou no vencimento da fatura.' : undefined} onClose={onClose}>
    <form className="form-grid" onSubmit={handleSubmit(save)} noValidate>
      <Field label="Descrição" error={errors.description?.message} full><input placeholder="Ex.: pagamento de internet" autoFocus {...register('description')} /></Field>
      <Field label="Tipo"><Select {...kindRegister} onChange={event => {
        void kindRegister.onChange(event)
        setValue('category', '')
        setValue('status', 'pending')
        if (method === credit) setValue('method', '')
      }}>{Object.entries(kinds).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</Select></Field>
      <Field label="Valor (R$)" error={errors.amount?.message}><input inputMode="decimal" placeholder="0,00" {...register('amount')} /></Field>
      <Field label={cardPurchase ? 'Data da compra' : 'Data prevista'} error={errors.date?.message}><input type="date" {...register('date')} /></Field>
      {kind !== 'transfer' && <Field label="Categoria"><Select {...register('category')}>
        <option value="">Sem categoria</option>
        {data.categories.filter(row => row.kind === kind && (row.active || row.id === category)).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
      </Select></Field>}
      {kind !== 'transfer' && <Field label="Forma de pagamento"><Select {...methodRegister} onChange={event => {
        void methodRegister.onChange(event)
        if (event.target.value === credit) { setValue('recurrence', false); setValue('status', 'pending') }
      }}>
        <option value="">Selecione</option>{methods.map(value => <option key={value}>{value}</option>)}
        {!editing && kind === 'expense' && <option>{credit}</option>}
      </Select></Field>}
      {cardPurchase ? <>
        <Field label="Cartão" error={errors.card?.message}><Select {...register('card')}><option value="">Selecione</option>
          {data.credit_cards.filter(row => row.active).map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
        </Select></Field>
        <Field label="Parcelas" error={errors.installments?.message}><input type="number" min="1" max="120" {...register('installments')} /></Field>
        <Field label={autoMonth ? 'Primeira fatura · automática se em branco' : 'Primeira fatura'} error={errors.firstMonth?.message}>
          <input type="month" {...register('firstMonth')} />
          {autoMonth && <small>Previsão automática de {autoMonth.split('-').reverse().join('/')}</small>}
        </Field>
      </> : <>
        <Field label={kind === 'transfer' ? 'Conta de origem' : 'Conta'} error={errors.account?.message}><Select {...register('account')}>
          <option value="">{kind === 'transfer' ? 'Selecione' : 'Sem conta vinculada'}</option>
          {accountList.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
        </Select></Field>
        {kind === 'transfer' && <Field label="Conta de destino" error={errors.destination?.message}><Select {...register('destination')}>
          <option value="">Selecione</option>{accountList.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
        </Select></Field>}
        {allowScope && <Field label="Aplicar alterações a" full><Select {...register('scope')} onChange={event => {
          setValue('scope', event.target.value as EntryForm['scope'])
          if (event.target.value !== 'single') setValue('status', 'pending')
        }}>
          <option value="single">Somente este lançamento</option><option value="future">Este lançamento e os próximos</option>
          <option value="all">Toda a recorrência</option>
        </Select></Field>}
        {!recurrence && scope === 'single' && <Field label="Status"><Select {...register('status')} onChange={event => {
          const value = event.target.value as EntryForm['status']
          setValue('status', value)
          if (value !== 'pending' && status === 'pending') setValue('effective', now)
        }}>
          <option value="pending">{statuses.pending}</option>
          <option value={kind === 'income' ? 'received' : 'paid'}>{kind === 'income' ? statuses.received : statuses.paid}</option>
        </Select></Field>}
        {!recurrence && scope === 'single' && status !== 'pending' && <Field label="Data efetiva" error={errors.effective?.message}><input type="date" max={now} {...register('effective')} /></Field>}
        {!editing && <label className="checkbox-row field-full"><input type="checkbox" {...register('recurrence')} onChange={event => {
          setValue('recurrence', event.target.checked)
          if (event.target.checked) setValue('status', 'pending')
        }} /> Repetir lançamento</label>}
        {recurrence && <Field label="Frequência" full><Select {...register('frequency')}>
          {Object.entries(frequencies).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
        </Select></Field>}
      </>}
      <Field label="Observação (opcional)" error={errors.notes?.message} full><textarea rows={2} {...register('notes')} /></Field>
      <div className="form-actions field-full"><Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? 'Salvando…' : 'Salvar lançamento'}</Button></div>
    </form>
  </Modal>
}
