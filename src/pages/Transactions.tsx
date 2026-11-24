import { useMemo, useState } from 'react'
import { ArrowLeftRight, Search } from 'lucide-react'
import { useFinance } from '../lib/context'
import { endOfMonth } from '../lib/dates'
import { isConfirmed, movements } from '../lib/finance'
import { kinds, statuses } from '../lib/labels'
import { MovementList } from '../components/MovementList'
import { Button, Card, Field, Heading, Select } from '../components/ui'

export function Transactions() {
  const { data, month, now, openEntry } = useFinance()
  const [from, setFrom] = useState(month)
  const [to, setTo] = useState(endOfMonth(month))
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState('')
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const list = useMemo(() => movements(data, to > now ? to : now, now).filter(item => {
    const date = isConfirmed(item) ? item.date : item.planned_date
    return (!from || date >= from) && (!to || date <= to)
      && (!kind || item.kind === kind) && (!category || item.category_id === category)
      && (!status || (status === 'overdue' ? item.overdue : item.status === status))
      && item.description.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))
  }).sort((a, b) => b.date.localeCompare(a.date)), [data, now, from, to, kind, category, status, search])

  return <>
    <Heading title="Lançamentos" description="Consulte e organize receitas, despesas e transferências."
      action={<Button variant="secondary" onClick={() => openEntry({ kind: 'transfer' })}><ArrowLeftRight size={16} /> Nova transferência</Button>} />
    <Card title="Filtrar lançamentos">
      <div className="filters">
        <Field label="Pesquisar"><span className="input-icon"><Search size={16} /><input type="search" placeholder="Buscar descrição" value={search} onChange={event => setSearch(event.target.value)} /></span></Field>
        <Field label="De"><input type="date" value={from} onChange={event => setFrom(event.target.value)} /></Field>
        <Field label="Até"><input type="date" value={to} onChange={event => setTo(event.target.value)} /></Field>
        <Field label="Tipo"><Select value={kind} onChange={event => { setKind(event.target.value); setCategory('') }}><option value="">Todos</option>
          {Object.entries(kinds).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</Select></Field>
        <Field label="Categoria"><Select value={category} onChange={event => setCategory(event.target.value)}><option value="">Todas</option>
          {data.categories.filter(item => !kind || item.kind === kind).map(item => <option value={item.id} key={item.id}>{item.name} · {kinds[item.kind]}</option>)}</Select></Field>
        <Field label="Status"><Select value={status} onChange={event => setStatus(event.target.value)}><option value="">Todos</option>
          {Object.entries(statuses).filter(([value]) => value !== 'cancelled').map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          <option value="overdue">Vencido</option>
        </Select></Field>
      </div>
    </Card>
    <Card title={list.length === 1 ? '1 lançamento' : list.length + ' lançamentos'}>
      <MovementList items={list} />
    </Card>
  </>
}
