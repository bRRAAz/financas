import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useFinance } from '../lib/context'
import { brl, fromCents, monthLabel, toCents } from '../lib/dates'
import { firstInvoiceMonth, type Invoice } from '../lib/finance'
import { dateField, integerField, moneyField, monthField, nameField, optional } from '../lib/forms'
import type { Card, InvoiceRecord, Purchase } from '../lib/types'
import { useSave } from '../lib/use-save'
import { Button, Field, Modal, Select } from './ui'

const cardSchema = z.object({
  name: nameField(80), institution: z.string().trim().max(80), limit: optional(moneyField()),
  closing: integerField(1, 31), due: integerField(1, 31), color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  four: z.string().regex(/^([0-9]{4})?$/, 'Informe quatro dígitos.'), active: z.boolean(),
})
type CardValues = z.infer<typeof cardSchema>
export function CardForm({ card, onClose }: { card?: Card; onClose: () => void }) {
  const { repository } = useFinance()
  const mutation = useSave()
  const { register, handleSubmit, formState: { errors } } = useForm<CardValues>({
    resolver: zodResolver(cardSchema), defaultValues: {
      name: card?.name ?? '', institution: card?.institution ?? '', limit: card?.credit_limit ? fromCents(card.credit_limit) : '',
      closing: String(card?.closing_day ?? 15), due: String(card?.due_day ?? 24), color: card?.color ?? '#5a6ce3', four: card?.last_four ?? '', active: card?.active ?? true,
    },
  })
  return <Modal title={card ? 'Editar cartão' : 'Novo cartão'} onClose={onClose}>
    <form className="form-grid" noValidate onSubmit={handleSubmit(values => mutation.mutate({
      run: () => repository.save('credit_cards', {
        id: card?.id ?? crypto.randomUUID(), name: values.name, institution: values.institution,
        credit_limit: values.limit ? toCents(values.limit) : null, closing_day: Number(values.closing),
        due_day: Number(values.due), color: values.color, last_four: values.four, active: values.active,
      }), message: 'Cartão salvo.', done: onClose,
    }))}>
      <Field label="Nome do cartão" error={errors.name?.message} full><input placeholder="Ex.: cartão principal" {...register('name')} /></Field>
      <Field label="Instituição financeira" error={errors.institution?.message}><input {...register('institution')} /></Field>
      <Field label="Limite (R$)" error={errors.limit?.message}><input inputMode="decimal" placeholder="Opcional" {...register('limit')} /></Field>
      <Field label="Dia de fechamento" error={errors.closing?.message}><input type="number" min="1" max="31" {...register('closing')} /></Field>
      <Field label="Dia de vencimento" error={errors.due?.message}><input type="number" min="1" max="31" {...register('due')} /></Field>
      <Field label="Últimos quatro dígitos" error={errors.four?.message}><input inputMode="numeric" maxLength={4} {...register('four')} /></Field>
      <Field label="Cor do cartão" error={errors.color?.message}><input type="color" {...register('color')} /></Field>
      <label className="checkbox-row field-full"><input type="checkbox" {...register('active')} /> Cartão ativo</label>
      <div className="form-actions field-full"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={mutation.isPending}>Salvar cartão</Button></div>
    </form>
  </Modal>
}

const purchaseSchema = z.object({
  description: nameField(), amount: moneyField(), date: dateField, category: z.string(),
  card: z.string().min(1, 'Selecione um cartão.'), installments: integerField(1, 120),
  firstNumber: integerField(1, 120), firstMonth: optional(monthField), notes: z.string().max(2000),
}).superRefine((values, ctx) => {
  if (Number(values.firstNumber) > Number(values.installments)) {
    ctx.addIssue({ code: 'custom', path: ['firstNumber'], message: 'A parcela atual excede o total de parcelas.' })
  }
  if (toCents(values.amount) < Number(values.installments)) {
    ctx.addIssue({ code: 'custom', path: ['installments'], message: 'As parcelas precisam ter pelo menos um centavo.' })
  }
  if (Number(values.firstNumber) > 1 && !values.firstMonth) {
    ctx.addIssue({ code: 'custom', path: ['firstMonth'], message: 'Informe o mês da parcela atual.' })
  }
})
type PurchaseValues = z.infer<typeof purchaseSchema>
export function PurchaseForm({ cardId, purchase, onClose }: { cardId?: string; purchase?: Purchase; onClose: () => void }) {
  const { data, now, repository } = useFinance()
  const mutation = useSave()
  const { register, handleSubmit, control, formState: { errors } } = useForm<PurchaseValues>({
    resolver: zodResolver(purchaseSchema), defaultValues: {
      description: purchase?.description ?? '', amount: purchase ? fromCents(purchase.amount) : '', date: purchase?.purchase_date ?? now,
      category: purchase?.category_id ?? '', card: purchase?.card_id ?? cardId ?? '', installments: String(purchase?.installments ?? 1),
      firstNumber: String(purchase?.first_number ?? 1), firstMonth: purchase?.first_month.slice(0, 7) ?? '', notes: purchase?.notes ?? '',
    },
  })
  const [selectedCard, date, firstNumber] = useWatch({ control, name: ['card', 'date', 'firstNumber'] })
  const card = data.credit_cards.find(item => item.id === selectedCard)
  const suggested = card && date ? firstInvoiceMonth(card, date) : ''
  return <Modal title={purchase ? 'Editar compra' : 'Nova compra no cartão'} onClose={onClose}>
    <form className="form-grid" noValidate onSubmit={handleSubmit(values => {
      if (!card) return
      mutation.mutate({ run: () => repository.save('credit_card_purchases', {
        id: purchase?.id ?? crypto.randomUUID(), description: values.description, amount: toCents(values.amount),
        purchase_date: values.date, category_id: values.category || null, card_id: card.id,
        installments: Number(values.installments), first_number: Number(values.firstNumber),
        first_month: values.firstMonth ? values.firstMonth + '-01' : firstInvoiceMonth(card, values.date), notes: values.notes.trim(),
      }), message: 'Compra salva.', done: onClose })
    })}>
      <Field label="Descrição" error={errors.description?.message} full><input placeholder="Ex.: notebook" {...register('description')} /></Field>
      <Field label="Valor total (R$)" error={errors.amount?.message}><input inputMode="decimal" placeholder="0,00" {...register('amount')} /></Field>
      <Field label="Data da compra" error={errors.date?.message}><input type="date" {...register('date')} /></Field>
      <Field label="Cartão" error={errors.card?.message}><Select {...register('card')}><option value="">Selecione</option>
        {data.credit_cards.filter(item => item.active || item.id === purchase?.card_id).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
      </Select></Field>
      <Field label="Categoria"><Select {...register('category')}><option value="">Sem categoria</option>
        {data.categories.filter(item => item.kind === 'expense' && (item.active || item.id === purchase?.category_id)).map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
      </Select></Field>
      <Field label="Total de parcelas" error={errors.installments?.message}><input type="number" min="1" max="120" {...register('installments')} /></Field>
      <Field label="Parcela atual" error={errors.firstNumber?.message}><input type="number" min="1" max="120" {...register('firstNumber')} /></Field>
      <Field label={Number(firstNumber) > 1 ? 'Mês da parcela atual' : 'Primeira fatura'} error={errors.firstMonth?.message} full>
        <input type="month" {...register('firstMonth')} />
        {suggested && Number(firstNumber) === 1 && <small>Automático se em branco · {monthLabel(suggested)}</small>}
      </Field>
      <Field label="Observação (opcional)" error={errors.notes?.message} full><textarea rows={2} {...register('notes')} /></Field>
      <div className="form-actions field-full"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={mutation.isPending}>Salvar compra</Button></div>
    </form>
  </Modal>
}

export function invoiceRow(invoice: Invoice): InvoiceRecord {
  const previous = invoice.record
  return {
    id: previous?.id ?? crypto.randomUUID(), card_id: invoice.card.id, month: invoice.month,
    manual_amount: previous?.manual_amount ?? null, reconciled: previous?.reconciled ?? false,
    paid_date: previous?.paid_date ?? null, paid_amount: previous?.paid_amount ?? null,
    account_id: previous?.account_id ?? null, closing_date: previous?.closing_date ?? null, due_date: previous?.due_date ?? null,
  }
}
const manualSchema = z.object({ value: optional(moneyField('nonnegative')), reconciled: z.boolean(), account: z.string() })
const paymentSchema = z.object({ date: dateField, account: z.string() })
type ManualValues = z.infer<typeof manualSchema>
type PaymentValues = z.infer<typeof paymentSchema>

export function InvoiceManualForm({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { data, repository } = useFinance()
  const mutation = useSave()
  const { register, handleSubmit, formState: { errors } } = useForm<ManualValues>({
    resolver: zodResolver(manualSchema), defaultValues: { value: invoice.record?.manual_amount != null ? fromCents(invoice.record.manual_amount) : '',
      reconciled: invoice.record?.reconciled ?? false, account: invoice.record?.account_id ?? '' },
  })
  return <Modal title="Ajustar fatura" description="As compras detalhadas já fazem parte do total informado. Ao concluir a conciliação, o sistema passa a usar a soma dos itens." onClose={onClose}>
    <form className="form-grid" noValidate onSubmit={handleSubmit(values => mutation.mutate({
      run: () => repository.save('credit_card_invoices', {
        ...invoiceRow(invoice), manual_amount: values.value ? toCents(values.value) : null,
        reconciled: values.reconciled, account_id: values.account || null,
      }), message: 'Fatura atualizada.', done: onClose,
    }))}>
      <Field label="Valor manual total (R$)" error={errors.value?.message} full><input inputMode="decimal" placeholder="Opcional" {...register('value')} /></Field>
      <Field label="Conta de pagamento" full><Select {...register('account')}><option value="">Sem conta vinculada</option>
        {data.accounts.filter(item => item.active || item.id === invoice.record?.account_id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </Select></Field>
      <label className="checkbox-row field-full"><input type="checkbox" {...register('reconciled')} /> Conciliação concluída · usar total das compras</label>
      <div className="form-actions field-full"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={mutation.isPending}>Salvar fatura</Button></div>
    </form>
  </Modal>
}

export function InvoicePaymentForm({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  const { data, now, repository } = useFinance()
  const mutation = useSave()
  const { register, handleSubmit, setError, formState: { errors } } = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema), defaultValues: { date: now, account: invoice.record?.account_id ?? '' },
  })
  return <Modal title="Confirmar pagamento da fatura" description={invoice.card.name + ' · ' + brl(invoice.amount)} onClose={onClose}>
    <form className="form-grid" noValidate onSubmit={handleSubmit(values => {
      if (values.date > now) { setError('date', { message: 'Informe uma data até hoje.' }); return }
      mutation.mutate({ run: () => repository.save('credit_card_invoices', { ...invoiceRow(invoice),
        paid_amount: invoice.amount, paid_date: values.date, account_id: values.account || null,
        closing_date: invoice.closing, due_date: invoice.due,
      }), message: 'Pagamento confirmado.', done: onClose })
    })}>
      <Field label="Data do pagamento" error={errors.date?.message}><input type="date" max={now} {...register('date')} /></Field>
      <Field label="Conta de pagamento"><Select {...register('account')}><option value="">Sem conta vinculada</option>
        {data.accounts.filter(item => item.active || item.id === invoice.record?.account_id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
      </Select></Field>
      <div className="form-actions field-full"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={mutation.isPending}>Confirmar</Button></div>
    </form>
  </Modal>
}
