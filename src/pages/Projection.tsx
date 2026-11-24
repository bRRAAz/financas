import { Fragment, useMemo, useState } from 'react'
import { Calculator, ChevronDown, ChevronRight } from 'lucide-react'
import { BalanceChart } from '../components/charts'
import { SimulationDialog } from '../components/SimulationDialog'
import { Button, Card, Empty, Heading, Money, MonthPicker, Select } from '../components/ui'
import { useFinance } from '../lib/context'
import { monthLabel, shortDate } from '../lib/dates'
import { monthly, type Movement } from '../lib/finance'

export function Projection() {
  const { data, month, setMonth, now } = useFinance()
  const [count, setCount] = useState(6)
  const [expanded, setExpanded] = useState<string[]>([])
  const [simulating, setSimulating] = useState(false)
  const forecast = useMemo(() => monthly(data, month, count, now), [data, month, count, now])
  const categories = data.categories.filter(category => category.kind === 'expense' &&
    (category.active || forecast.some(period => period.entries.some(item => item.category_id === category.id))))
  const rows: { key: string; label: string; values: number[]; entries?: Movement[][]; emphasis?: boolean; tone?: boolean }[] = []
  function appendEntries(key: string, label: string, filter: (item: Movement) => boolean) {
    const entries = forecast.map(period => period.entries.filter(filter))
    rows.push({ key, label, entries, values: entries.map(items => items.reduce((sum, item) => sum + item.amount, 0)) })
  }
  rows.push({ key: 'opening', label: 'Saldo inicial', values: forecast.map(period => period.opening) })
  if (forecast.some(period => period.accountOpening)) {
    rows.push({ key: 'accounts', label: 'Saldos iniciais de novas contas', values: forecast.map(period => period.accountOpening) })
  }
  appendEntries('income', 'Receitas', item => item.kind === 'income')
  for (const category of categories) appendEntries(category.id, category.name, item => item.kind === 'expense' && !item.invoice && item.category_id === category.id)
  const unassigned = forecast.some(period => period.entries.some(item => item.kind === 'expense' && !item.invoice && !item.category_id))
  if (unassigned) appendEntries('unassigned', 'Sem categoria', item => item.kind === 'expense' && !item.invoice && !item.category_id)
  appendEntries('invoices', 'Faturas', item => !!item.invoice)
  rows.push(
    { key: 'expenses', label: 'Total de despesas', values: forecast.map(period => period.expenses), emphasis: true },
    { key: 'result', label: 'Sobra mensal', values: forecast.map(period => period.result), emphasis: true, tone: true },
    { key: 'closing', label: 'Saldo acumulado', values: forecast.map(period => period.closing), emphasis: true, tone: true },
  )
  return <>
    <Heading title="Projeção mensal" description="Compare suas receitas, despesas e saldos ao longo do tempo."
      action={<Button variant="secondary" onClick={() => setSimulating(true)}><Calculator size={17} /> Simular gasto</Button>} />
    <Card title="Planejamento financeiro" description="Expanda as linhas para consultar as movimentações de cada mês."
      action={<div className="inline-actions"><MonthPicker month={month} onChange={setMonth} />
        <Select aria-label="Horizonte da projeção" value={count} onChange={event => setCount(Number(event.target.value))}>
          {[3, 6, 12, 24].map(value => <option key={value} value={value}>{value} meses</option>)}
        </Select></div>}>
      <div className="table-scroll" tabIndex={0} aria-label="Projeção por categoria e mês">
        <table className="finance-table projection-table">
          <thead><tr><th scope="col">Categoria</th>{forecast.map(period => <th scope="col" key={period.month}>{monthLabel(period.month)}</th>)}</tr></thead>
          <tbody>{rows.map(row => {
            const open = expanded.includes(row.key)
            return <Fragment key={row.key}>
              <tr className={(row.emphasis ? 'emphasis ' : '') + (row.key === 'closing' ? 'closing-row' : '')}>
                <th scope="row">{row.entries ? <button className="expand-row" aria-expanded={open} onClick={() => setExpanded(previous =>
                  open ? previous.filter(key => key !== row.key) : [...previous, row.key])}>
                  {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}{row.label}</button> : row.label}</th>
                {row.values.map((value, index) => <td key={forecast[index].month}><Money value={value} tone={row.tone} /></td>)}
              </tr>
              {open && row.entries && <tr className="details-row"><th scope="row">Lançamentos</th>{row.entries.map((items, index) =>
                <td key={forecast[index].month}>{items.length ? <ul className="projection-details">{items.map(item => <li key={item.id}>
                  <span>{shortDate(item.date)} · {item.description}</span><Money value={item.amount} />
                  {item.invoice?.items.map(part => <small key={part.purchase.id}>{part.purchase.description} ({part.number}/{part.purchase.installments}) · <Money value={part.amount} /></small>)}
                </li>)}</ul> : <span className="muted">Sem lançamentos</span>}</td>)}</tr>}
            </Fragment>
          })}</tbody>
        </table>
      </div>
    </Card>
    <Card title="Evolução do saldo acumulado" description="Projeção no encerramento de cada mês">
      {forecast.length ? <BalanceChart points={forecast.map(period => ({ label: monthLabel(period.month).split(' ')[0].slice(0, 3) + '/' + period.month.slice(2, 4), value: period.closing }))} name="Saldo acumulado" /> : <Empty>Sem dados para o período.</Empty>}
    </Card>
    {simulating && <SimulationDialog onClose={() => setSimulating(false)} />}
  </>
}
