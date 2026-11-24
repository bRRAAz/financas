import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Check, CreditCard, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { CardForm, InvoiceManualForm, InvoicePaymentForm, invoiceRow, PurchaseForm } from '../components/CardForms'
import { Button, Card as Panel, Confirm, Empty, Heading, Money, MonthPicker } from '../components/ui'
import { useFinance } from '../lib/context'
import { addMonths, brDate, monthLabel, monthOf, shortDate } from '../lib/dates'
import { invoiceDates, invoices } from '../lib/finance'
import type { Card, Purchase } from '../lib/types'
import { useSave } from '../lib/use-save'

type Dialog = { type: 'card'; card?: Card } | { type: 'purchase'; purchase?: Purchase } | { type: 'manual' | 'pay' | 'undo' } | { type: 'delete'; purchase: Purchase }

export function Cards() {
  const { data, now, repository } = useFinance()
  const [params, setParams] = useSearchParams()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const save = useSave()
  const cards = [...data.credit_cards].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
  const selected = cards.find(item => item.id === params.get('cartao')) ?? cards[0]
  const requested = params.get('mes') ?? ''
  const calendarMonth = monthOf(now)
  const currentMonth = selected && invoiceDates(selected, calendarMonth).due < now
    ? addMonths(calendarMonth, 1) : calendarMonth
  const selectedMonth = /^\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested + '-01' : currentMonth
  const selectedId = selected?.id
  const accountInvoices = useMemo(() => selectedId
    ? invoices(data, [{ cardId: selectedId, month: selectedMonth }, { cardId: selectedId, month: currentMonth }])
      .filter(item => item.card.id === selectedId) : [],
  [data, selectedId, selectedMonth, currentMonth])
  const invoice = accountInvoices.find(item => item.month === selectedMonth)
  const current = accountInvoices.find(item => item.month === currentMonth)
  const outstanding = accountInvoices.filter(item => !item.record?.paid_date && item.amount > 0)
  const used = outstanding.reduce((sum, item) => sum + item.amount, 0)
  const next = outstanding.find(item => item.due >= now) ?? outstanding[0] ?? current
  const future = outstanding.filter(item => item.month > currentMonth).slice(0, 6)
  const purchasing = new Map<string, { purchase: Purchase; remaining: number; next: number }>()
  for (const once of outstanding) {
    for (const part of once.items) {
      if (part.purchase.installments < 2) continue
      const previous = purchasing.get(part.purchase.id)
      purchasing.set(part.purchase.id, { purchase: part.purchase, remaining: (previous?.remaining ?? 0) + 1,
        next: Math.min(previous?.next ?? part.number, part.number) })
    }
  }
  const close = () => setDialog(null)
  const selectCard = (id: string) => setParams({ cartao: id })

  return <>
    <Heading title="Cartões de crédito" description="Acompanhe faturas, compras parceladas e limites."
      action={<div className="inline-actions">
        <Button variant="secondary" onClick={() => setDialog({ type: 'card' })}><Plus size={17} /> Novo cartão</Button>
        <Button onClick={() => setDialog({ type: 'purchase' })} disabled={!cards.some(card => card.active)}><Plus size={17} /> Nova compra</Button>
      </div>} />
    {!cards.length && <Panel><Empty>Cadastre seu primeiro cartão para acompanhar as faturas.</Empty></Panel>}
    {!!cards.length && <div className="credit-card-list" aria-label="Selecionar cartão">
      {cards.map(card => <button key={card.id} className={'credit-tile ' + (card.id === selected?.id ? 'credit-selected' : '')}
        aria-pressed={card.id === selected?.id} onClick={() => selectCard(card.id)}>
        <span className="credit-icon" style={{ backgroundColor: card.color }}><CreditCard size={20} /></span>
        <span><strong>{card.name}</strong><small>{[card.institution, card.last_four && '•••• ' + card.last_four].filter(Boolean).join(' · ') || 'Cartão de crédito'}</small></span>
        {!card.active && <span className="status">Inativo</span>}
      </button>)}
    </div>}
    {selected && <Panel title={selected.name} description={selected.institution || 'Resumo do cartão'}
      action={<Button variant="secondary" size="small" onClick={() => setDialog({ type: 'card', card: selected })}><Pencil size={15} /> Editar cartão</Button>}>
      <dl className="day-summary">
        <div><dt>Fatura atual</dt><dd><Money value={current?.amount ?? 0} /></dd></div>
        <div><dt>Próximo vencimento</dt><dd>{next ? brDate(next.due) : '—'}</dd></div>
        <div><dt>Limite utilizado</dt><dd><Money value={used} /></dd></div>
        <div><dt>Limite disponível</dt><dd>{selected.credit_limit == null ? '—' : <Money value={selected.credit_limit - used} tone />}</dd></div>
      </dl>
    </Panel>}
    {invoice && <Panel title="Detalhes da fatura" description={monthLabel(invoice.month)}
      action={<MonthPicker month={invoice.month} onChange={month => setParams({ cartao: invoice.card.id, mes: month.slice(0, 7) })} />}>
      <dl className="day-summary invoice-summary">
        <div><dt>Total da fatura</dt><dd><Money value={invoice.amount} /></dd></div>
        <div><dt>Fechamento</dt><dd>{brDate(invoice.closing)}</dd></div>
        <div><dt>Vencimento</dt><dd>{brDate(invoice.due)}</dd></div>
        <div><dt>Situação</dt><dd><span className={'status ' + (invoice.record?.paid_date ? 'status-confirmed' : invoice.due < now && invoice.amount ? 'status-overdue' : '')}>
          {invoice.record?.paid_date ? 'Paga em ' + shortDate(invoice.record.paid_date) : !invoice.amount ? 'Sem cobrança' : invoice.due < now ? 'Vencida' : 'Pendente'}</span></dd></div>
      </dl>
      <div className="inline-actions invoice-actions">
        <Button variant="secondary" size="small" onClick={() => setDialog({ type: 'manual' })}><Pencil size={15} /> Ajustar fatura</Button>
        {invoice.record?.paid_date
          ? <Button variant="ghost" size="small" onClick={() => setDialog({ type: 'undo' })}><RotateCcw size={15} /> Estornar confirmação</Button>
          : <Button variant="secondary" size="small" disabled={!invoice.amount} onClick={() => setDialog({ type: 'pay' })}><Check size={16} /> Marcar como paga</Button>}
      </div>
      {invoice.items.length ? <ul className="movement-list">{invoice.items.map(part => <li key={part.purchase.id} className="movement">
        <span className="icon-tile tone-violet"><CreditCard size={17} /></span>
        <div className="movement-main"><strong>{part.purchase.description}</strong><small>{part.number}/{part.purchase.installments} · {brDate(part.purchase.purchase_date)}
          {part.purchase.category_id && ' · ' + (data.categories.find(item => item.id === part.purchase.category_id)?.name ?? 'Categoria')}</small></div>
        <strong className="movement-value"><Money value={part.amount} /></strong>
        <div className="row-actions"><Button variant="ghost" size="icon" aria-label={'Editar ' + part.purchase.description} onClick={() => setDialog({ type: 'purchase', purchase: part.purchase })}><Pencil size={16} /></Button>
          <Button variant="ghost" size="icon" aria-label={'Excluir ' + part.purchase.description} onClick={() => setDialog({ type: 'delete', purchase: part.purchase })}><Trash2 size={16} /></Button></div>
      </li>)}</ul> : <Empty>Nenhuma compra detalhada nesta fatura.</Empty>}
      {invoice.adjustment !== 0 && <p className="invoice-adjustment">Diferença entre o total da fatura e os itens <strong><Money value={invoice.adjustment} /></strong></p>}
    </Panel>}
    {selected && <div className="dashboard-secondary">
      <Panel title="Próximas faturas">
        {future.length ? <ul className="simple-list">{future.map(item => <li key={item.month}>
          <button className="quiet-link" onClick={() => setParams({ cartao: item.card.id, mes: item.month.slice(0, 7) })}>{monthLabel(item.month)}</button>
          <small>Vence em {shortDate(item.due)}</small><Money value={item.amount} />
        </li>)}</ul> : <Empty>Sem faturas futuras.</Empty>}
      </Panel>
      <Panel title="Compras parceladas em andamento">
        {purchasing.size ? <ul className="simple-list">{[...purchasing.values()].map(item => <li key={item.purchase.id}>
          <button className="quiet-link" onClick={() => setDialog({ type: 'purchase', purchase: item.purchase })}>{item.purchase.description}</button>
          <small>Parcela {item.next}/{item.purchase.installments}</small><span>{item.remaining} em aberto</span>
        </li>)}</ul> : <Empty>Sem parcelas em andamento.</Empty>}
      </Panel>
    </div>}
    {dialog?.type === 'card' && <CardForm card={dialog.card} onClose={close} />}
    {dialog?.type === 'purchase' && <PurchaseForm cardId={selected?.active ? selected.id : undefined} purchase={dialog.purchase} onClose={close} />}
    {dialog?.type === 'manual' && invoice && <InvoiceManualForm invoice={invoice} onClose={close} />}
    {dialog?.type === 'pay' && invoice && <InvoicePaymentForm invoice={invoice} onClose={close} />}
    {dialog?.type === 'delete' && <Confirm title="Excluir compra do cartão?" onClose={close} busy={save.isPending} onConfirm={() => save.mutate({
      run: () => repository.remove('credit_card_purchases', dialog.purchase.id), message: 'Compra excluída.', done: close,
    })}>As parcelas da compra serão removidas das faturas. Totais de pagamentos confirmados serão preservados.</Confirm>}
    {dialog?.type === 'undo' && invoice && <Confirm title="Estornar pagamento da fatura?" label="Estornar" onClose={close} busy={save.isPending} onConfirm={() => save.mutate({
      run: () => repository.save('credit_card_invoices', { ...invoiceRow(invoice), paid_date: null, paid_amount: null, closing_date: null, due_date: null }),
      message: 'Pagamento estornado.', done: close,
    })}>A fatura voltará a ficar pendente e aparecerá novamente na projeção.</Confirm>}
  </>
}
