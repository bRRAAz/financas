import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarDays, Plus } from 'lucide-react'
import { useFinance } from '../lib/context'
import { brDate, brl, endOfMonth, weekday } from '../lib/dates'
import { daily, invoices } from '../lib/finance'
import { MovementList } from '../components/MovementList'
import { Button, Card, Heading, Modal, Money, MonthPicker, Select } from '../components/ui'

const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
export function Calendar() {
  const { data, month, setMonth, now, openEntry, demo } = useFinance()
  const [selected, setSelected] = useState<string | null>(null)
  const [account, setAccount] = useState('')
  const days = useMemo(() => daily(data, month, endOfMonth(month), now, account || undefined), [data, month, now, account])
  const active = days.find(day => day.date === selected)
  const dueOutsideFlow = useMemo(() => selected ? invoices(data).filter(invoice => invoice.due === selected && invoice.amount > 0
    && (!account || invoice.record?.account_id === account)
    && !active?.entries.some(item => item.invoice?.card.id === invoice.card.id && item.invoice.month === invoice.month)) : [],
  [data, active, selected, account])
  return <>
    <Heading title="Calendário financeiro" description="Veja o saldo previsto ao final de cada dia."
      action={<MonthPicker month={month} onChange={setMonth} />} />
    <Card title="Saldo diário" description="Selecione uma data para ver as movimentações." className="calendar-card"
      action={<Select aria-label="Conta financeira" value={account} onChange={event => setAccount(event.target.value)}><option value="">Todas as contas</option>
        {data.accounts.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}</Select>}>
      <div className="calendar-grid">
        {weekdays.map(label => <div key={label} className="calendar-weekday">{label}</div>)}
        {Array.from({ length: weekday(month) }, (_, index) => <div key={'empty-' + index} className="calendar-empty" />)}
        {days.map(day => <button key={day.date} className={'calendar-day ' + (day.date === now ? 'calendar-today' : '')}
          onClick={() => setSelected(day.date)} aria-current={day.date === now ? 'date' : undefined}>
          <span className="date-number">{day.date.slice(-2)}</span>
          <span className="money-full"><Money value={day.closing} tone /></span>
          <span className={'money money-mobile ' + (day.closing > 0 ? 'positive' : day.closing < 0 ? 'negative' : 'neutral')}
            aria-label={brl(day.closing)}>{brl(day.closing).replace(/R\$\s?/, '')}</span>
          {!!day.entries.length && <small>{day.entries.length}<span> mov.</span></small>}
        </button>)}
      </div>
      <div className="calendar-legend"><span><i className="legend-color legend-positive" /> Positivo</span><span><i className="legend-color legend-negative" /> Negativo</span>
        <span><i className="legend-color legend-zero" /> Zerado</span><span><CalendarDays size={15} /> Hoje</span></div>
    </Card>
    {active && <Modal title={brDate(active.date)} description="Movimentações e saldo projetado do dia" onClose={() => setSelected(null)} wide>
      <dl className="day-summary">
        <div><dt>Saldo inicial</dt><dd><Money value={active.opening} tone /></dd></div>
        <div><dt>Receitas</dt><dd><Money value={active.income} tone /></dd></div>
        <div><dt>Despesas e faturas</dt><dd><Money value={-active.expenses} tone /></dd></div>
        <div><dt>Saldo final</dt><dd><Money value={active.closing} tone /></dd></div>
      </dl>
      <MovementList items={active.entries} />
      {dueOutsideFlow.length > 0 && <section className="day-due">
        <h3>Faturas com vencimento nesta data</h3>
        <ul className="simple-list">{dueOutsideFlow.map(invoice => <li key={invoice.card.id}>
          <Link className="quiet-link" to={(demo ? '/demo' : '') + '/cartoes?cartao=' + invoice.card.id + '&mes=' + invoice.month.slice(0, 7)}>
            {invoice.card.name}
          </Link>
          <small>{invoice.record?.paid_date ? 'Paga em ' + brDate(invoice.record.paid_date)
            : invoice.due < now ? 'Vencida · prevista para ' + brDate(now) : 'Pendente'}</small>
          <Money value={invoice.amount} />
        </li>)}</ul>
      </section>}
      <div className="form-actions"><Button onClick={() => { setSelected(null); openEntry({ date: active.date }) }}><Plus size={17} /> Novo lançamento</Button></div>
    </Modal>}
  </>
}
