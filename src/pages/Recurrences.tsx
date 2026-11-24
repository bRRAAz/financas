import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Pencil, Plus, Repeat2 } from 'lucide-react'
import { Button, Card, Empty, Field, Heading, Modal, Money, Select } from '../components/ui'
import { useFinance } from '../lib/context'
import { addMonths, brDate, fromCents, toCents } from '../lib/dates'
import { occurrences } from '../lib/finance'
import { dateField, frequencyField, integerField, moneyField, nameField, optional } from '../lib/forms'
import { frequencies, kinds, methods } from '../lib/labels'
import { splitRecurrence } from '../lib/recurrence-edits'
import type { Recurrence } from '../lib/types'
import { useSave } from '../lib/use-save'

const recurrenceSchema = z.object({
  description: nameField(), kind: z.enum(['income', 'expense', 'transfer']), amount: moneyField(),
  start: dateField, end: optional(dateField), count: optional(integerField(1, 10000)), frequency: frequencyField,
  category: z.string(), account: z.string(), destination: z.string(), method: z.string(), active: z.boolean(),
  notes: z.string().max(2000),
}).superRefine((values, ctx) => {
  if (values.end && values.end < values.start) ctx.addIssue({ code: 'custom', path: ['end'], message: 'A data final deve vir depois do início.' })
  if (values.kind === 'transfer' && !values.account) ctx.addIssue({ code: 'custom', path: ['account'], message: 'Selecione a conta de origem.' })
  if (values.kind === 'transfer' && (!values.destination || values.destination === values.account)) {
    ctx.addIssue({ code: 'custom', path: ['destination'], message: 'Selecione outra conta como destino.' })
  }
})
type Values = z.infer<typeof recurrenceSchema>

function RecurrenceForm({ rule, onClose }: { rule?: Recurrence; onClose: () => void }) {
  const { data, now, repository } = useFinance()
  const save = useSave()
  const { register, handleSubmit, control, setValue, setError, formState: { errors } } = useForm<Values>({
    resolver: zodResolver(recurrenceSchema), defaultValues: {
      description: rule?.description ?? '', kind: rule?.kind ?? 'expense', amount: rule ? fromCents(rule.amount) : '',
      start: rule?.start_date ?? now, end: rule?.end_date ?? '', count: String(rule?.repeat_count ?? ''),
      frequency: rule?.frequency ?? 'monthly', category: rule?.category_id ?? '', account: rule?.account_id ?? '',
      destination: rule?.destination_id ?? '', method: rule?.method ?? '', active: rule?.active ?? true, notes: rule?.notes ?? '',
    },
  })
  const [kind, end, count] = useWatch({ control, name: ['kind', 'end', 'count'] })
  const kindField = register('kind')
  const accounts = data.accounts.filter(item => item.active || item.id === rule?.account_id || item.id === rule?.destination_id)

  function submit(values: Values) {
    const next: Recurrence = {
      id: rule?.id ?? crypto.randomUUID(), description: values.description, kind: values.kind, amount: toCents(values.amount),
      category_id: values.kind === 'transfer' ? null : values.category || null, account_id: values.account || null,
      destination_id: values.kind === 'transfer' ? values.destination : null, method: values.kind === 'transfer' ? 'Transferência' : values.method,
      notes: values.notes.trim(), start_date: values.start, end_date: values.end || null, repeat_count: values.count ? Number(values.count) : null,
      frequency: values.frequency, active: values.active, stop_before: null, superseded: false,
      anchor_day: rule?.start_date === values.start ? rule.anchor_day : null,
    }
    if (rule && !rule.active && values.active && rule.stop_before && next.start_date < (rule.stop_before > now ? rule.stop_before : now)) {
      setError('start', { message: 'Para reativar, informe uma data de início a partir de hoje.' })
      return
    }
    save.mutate({ run: async () => {
      if (rule?.active && !next.active) {
        await repository.split(rule, rule.start_date > now ? rule.start_date : now, { ...next, id: crypto.randomUUID() }, {})
      } else if (rule?.active && next.active && (rule.start_date !== next.start_date || rule.frequency !== next.frequency ||
        rule.repeat_count !== next.repeat_count || rule.end_date !== next.end_date)) {
        const result = splitRecurrence(rule, rule.start_date, next.start_date, next, 'all', data.recurrence_exceptions)
        await repository.split(rule, result.cutoff, result.next, result.dates)
      } else {
        await repository.save('recurring_transactions', next)
      }
    }, message: 'Recorrência salva.', done: onClose })
  }

  return <Modal title={rule ? 'Editar recorrência' : 'Nova recorrência'} onClose={onClose}>
    <form className="form-grid" noValidate onSubmit={handleSubmit(submit)}>
      <Field label="Descrição" error={errors.description?.message} full><input placeholder="Ex.: salário do dia 5" {...register('description')} /></Field>
      <Field label="Tipo"><Select {...kindField} onChange={event => { void kindField.onChange(event); setValue('category', '') }}>
        {Object.entries(kinds).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select></Field>
      <Field label="Valor (R$)" error={errors.amount?.message}><input inputMode="decimal" placeholder="0,00" {...register('amount')} /></Field>
      {kind !== 'transfer' && <Field label="Categoria"><Select {...register('category')}><option value="">Sem categoria</option>
        {data.categories.filter(item => item.kind === kind && (item.active || item.id === rule?.category_id)).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</Select></Field>}
      <Field label={kind === 'transfer' ? 'Conta de origem' : 'Conta'} error={errors.account?.message}><Select {...register('account')}>
        <option value="">{kind === 'transfer' ? 'Selecione' : 'Sem conta vinculada'}</option>
        {accounts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
      {kind === 'transfer' ? <Field label="Conta de destino" error={errors.destination?.message}><Select {...register('destination')}>
        <option value="">Selecione</option>{accounts.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select></Field>
        : <Field label="Forma de pagamento"><Select {...register('method')}><option value="">Selecione</option>
          {methods.map(method => <option key={method}>{method}</option>)}</Select></Field>}
      <Field label="Frequência"><Select {...register('frequency')}>
        {Object.entries(frequencies).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select></Field>
      <Field label="Data inicial" error={errors.start?.message}><input type="date" {...register('start')} /></Field>
      <Field label="Data final (opcional)" error={errors.end?.message}><input type="date" {...register('end')} /></Field>
      <Field label="Número de repetições (opcional)" error={errors.count?.message}><input type="number" min="1" max="10000" {...register('count')} /></Field>
      {!end && !count && <p className="field-full muted">Frequência por tempo indeterminado.</p>}
      <Field label="Observação (opcional)" error={errors.notes?.message} full><textarea rows={2} {...register('notes')} /></Field>
      <label className="checkbox-row field-full"><input type="checkbox" {...register('active')} /> Recorrência ativa</label>
      <div className="form-actions field-full"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={save.isPending}>Salvar recorrência</Button></div>
    </form>
  </Modal>
}

export function Recurrences() {
  const { data, now } = useFinance()
  const [editing, setEditing] = useState<Recurrence | 'new' | null>(null)
  const rows = data.recurring_transactions.filter(item => !item.superseded).sort((a, b) =>
    Number(b.active) - Number(a.active) || a.description.localeCompare(b.description))

  return <>
    <Heading title="Recorrências" description="Automatize receitas e despesas que se repetem."
      action={<Button variant="secondary" onClick={() => setEditing('new')}><Plus size={17} /> Nova recorrência</Button>} />
    <Card title="Regras de recorrência" description="Receitas, despesas e transferências recorrentes">
      {rows.length ? <ul className="movement-list">{rows.map(item => {
        const next = occurrences(item, addMonths(now, 12), now).find(occurrence =>
          !data.recurrence_exceptions.some(exception => exception.recurrence_id === item.id &&
            exception.occurrence_date === occurrence.date && exception.status === 'cancelled'))
        return <li key={item.id} className="movement">
          <span className="icon-tile tone-violet"><Repeat2 size={17} /></span>
          <div className="movement-main"><strong>{item.description}</strong><small>{frequencies[item.frequency]} · {kinds[item.kind]}{next && ' · Próximo em ' + brDate(next.date)}</small></div>
          <div className="movement-value"><Money value={item.amount} /><span className={'status ' + (item.active ? 'status-confirmed' : '')}>{item.active ? 'Ativa' : 'Inativa'}</span></div>
          <div className="row-actions"><Button variant="ghost" size="icon" aria-label={'Editar ' + item.description} onClick={() => setEditing(item)}><Pencil size={16} /></Button></div>
        </li>
      })}</ul> : <Empty>Nenhuma recorrência cadastrada.</Empty>}
    </Card>
    {editing && <RecurrenceForm rule={editing !== 'new' ? editing : undefined} onClose={() => setEditing(null)} />}
  </>
}
