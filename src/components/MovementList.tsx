import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Copy, CreditCard, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useFinance } from '../lib/context'
import { brDate, shortDate } from '../lib/dates'
import { isConfirmed, type Movement } from '../lib/finance'
import { kinds, statuses } from '../lib/labels'
import type { Exception, Status, Transaction } from '../lib/types'
import { useSave } from '../lib/use-save'
import { kindIcons } from './icons'
import { Button, Confirm, Empty, Field, Modal, Money } from './ui'

export function MovementList({ items, compact = false }: { items: Movement[]; compact?: boolean }) {
  const { data, now, demo, repository, openEntry } = useFinance()
  const save = useSave()
  const [deleteItem, setDeleteItem] = useState<Movement | null>(null)
  const [confirmItem, setConfirmItem] = useState<Movement | null>(null)
  const [date, setDate] = useState(now)
  const [dateError, setDateError] = useState(false)

  async function change(item: Movement, status: Status, effectiveDate: string | null) {
    const row: Transaction = {
      id: item.id, description: item.description, kind: item.kind, amount: item.amount,
      planned_date: item.planned_date, effective_date: effectiveDate, status,
      category_id: item.category_id, notes: item.notes, account_id: item.account_id,
      destination_id: item.destination_id, method: item.method,
    }
    if (item.recurrenceId && item.occurrenceDate) {
      const previous = data.recurrence_exceptions.find(entry => entry.recurrence_id === item.recurrenceId && entry.occurrence_date === item.occurrenceDate)
      const exception: Exception = { ...row, id: previous?.id ?? crypto.randomUUID(), recurrence_id: item.recurrenceId, occurrence_date: item.occurrenceDate }
      await repository.save('recurrence_exceptions', exception)
    } else if (status === 'cancelled') {
      await repository.remove('transactions', item.id)
    } else {
      await repository.save('transactions', row)
    }
  }

  if (!items.length) return <Empty>Nenhum lançamento encontrado.</Empty>
  return <>
    <ul className={'movement-list' + (compact ? ' compact-list' : '')}>
      {items.map(item => {
        const Icon = item.invoice ? CreditCard : kindIcons[item.kind]
        const category = data.categories.find(row => row.id === item.category_id)?.name
        const label = item.overdue ? 'Vencido' : statuses[item.status]
        const sign = item.kind === 'income' ? '+' : item.kind === 'expense' ? '−' : ''
        const day = item.overdue && !compact ? item.planned_date : item.date
        return <li className="movement" key={item.id}>
          <span className={'icon-tile tone-' + (item.invoice ? 'violet' : item.kind === 'income' ? 'green' : item.kind === 'expense' ? 'red' : 'blue')}><Icon size={17} /></span>
          <div className="movement-main"><strong>{item.description}</strong><small>{[category ?? (item.invoice ? 'Cartão de crédito' : kinds[item.kind]), compact ? shortDate(day) : brDate(day)].join(' · ')}</small></div>
          <div className="movement-value"><strong className={item.kind === 'income' ? 'positive' : item.kind === 'expense' ? 'negative' : ''}>
            {sign && sign + ' '}<Money value={item.amount} />
          </strong>{compact ? item.overdue && <small className="negative">Vencido</small> : <span className={'status ' + (item.overdue ? 'status-overdue' : isConfirmed(item) ? 'status-confirmed' : '')}>{label}</span>}</div>
          {!compact && <div className="row-actions">
            {item.invoice ? <Button asChild variant="secondary" size="small"><Link to={(demo ? '/demo' : '') + '/cartoes?cartao=' + item.invoice.card.id + '&mes=' + item.invoice.month.slice(0, 7)}>Ver fatura</Link></Button> : <>
              {isConfirmed(item) ? <Button variant="ghost" size="icon" disabled={save.isPending} title="Estornar confirmação" aria-label={'Estornar confirmação de ' + item.description}
                onClick={() => save.mutate({ run: () => change(item, 'pending', null), message: 'Confirmação estornada.' })}><RotateCcw size={16} /></Button>
                : <Button variant="ghost" size="icon" title={item.kind === 'income' ? 'Marcar como recebido' : 'Marcar como pago'} aria-label={'Confirmar ' + item.description}
                  onClick={() => { setDate(now); setDateError(false); setConfirmItem(item) }}><Check size={17} /></Button>}
              <Button variant="ghost" size="icon" title="Editar" aria-label={'Editar ' + item.description} onClick={() => openEntry({ movement: item })}><Pencil size={16} /></Button>
              <Button variant="ghost" size="icon" title="Duplicar" aria-label={'Duplicar ' + item.description} onClick={() => openEntry({ movement: item, duplicate: true })}><Copy size={16} /></Button>
              <Button variant="ghost" size="icon" title="Excluir" aria-label={'Excluir ' + item.description} onClick={() => setDeleteItem(item)}><Trash2 size={16} /></Button>
            </>}
          </div>}
        </li>
      })}
    </ul>
    {deleteItem && <Confirm title="Excluir lançamento?" busy={save.isPending} onClose={() => setDeleteItem(null)}
      onConfirm={() => save.mutate({ run: () => change(deleteItem, 'cancelled', null), message: 'Lançamento excluído.', done: () => setDeleteItem(null) })}>
      {deleteItem.recurrenceId ? 'Somente a ocorrência selecionada será excluída.' : 'A movimentação será removida do seu histórico e das projeções.'}
    </Confirm>}
    {confirmItem && <Modal title={confirmItem.kind === 'income' ? 'Confirmar recebimento' : 'Confirmar pagamento'}
      description={confirmItem.description} onClose={() => setConfirmItem(null)}>
      <form onSubmit={event => {
        event.preventDefault()
        if (!date || date > now) { setDateError(true); return }
        save.mutate({ run: () => change(confirmItem, confirmItem.kind === 'income' ? 'received' : 'paid', date),
          message: 'Movimentação confirmada.', done: () => setConfirmItem(null) })
      }}>
        <Field label="Data efetiva" error={dateError ? 'Informe uma data até hoje.' : undefined}><input type="date" value={date} max={now} required onChange={event => setDate(event.target.value)} /></Field>
        <div className="form-actions"><Button variant="secondary" onClick={() => setConfirmItem(null)}>Cancelar</Button>
          <Button type="submit" disabled={save.isPending}>Confirmar</Button></div>
      </form>
    </Modal>}
  </>
}
