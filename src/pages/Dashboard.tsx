import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, CalendarDays, CircleAlert, CreditCard, TrendingUp, Wallet } from 'lucide-react'
import { useFinance } from '../lib/context'
import { brl, monthLabel, monthOf, shortDate } from '../lib/dates'
import { daily, expenseBreakdown, monthly } from '../lib/finance'
import { Button, Card, Empty, Heading, Money, MonthPicker } from '../components/ui'
import { BalanceChart, CategoryChart, ComparisonChart } from '../components/charts'
import { MovementList } from '../components/MovementList'

export function Dashboard() {
  const { data, month, setMonth, now, demo } = useFinance()
  const summary = useMemo(() => monthly(data, month, 6, now), [data, month, now])
  const selected = summary[0]
  const current = daily(data, now, now, now)[0].realized
  const negative = summary.flatMap(period => period.days).find(day => day.date >= now && day.closing < 0)
  const upcomingEntries = month === monthOf(now) ? summary.flatMap(period => period.entries) : selected.entries
  const upcoming = upcomingEntries.filter(item => item.date >= now && item.status === 'pending').slice(0, 5)
  const groups = new Map<string | null, number>()
  for (const item of expenseBreakdown(selected.entries)) groups.set(item.categoryId, (groups.get(item.categoryId) ?? 0) + item.amount)
  const categories = [...groups].map(([id, value]) => {
    const category = data.categories.find(item => item.id === id)
    return { label: category?.name ?? 'Sem categoria', value, color: category?.color ?? '#8895a8' }
  }).filter(item => item.value > 0).sort((a, b) => b.value - a.value)
  const metrics = [
    { title: 'Receitas previstas', value: selected.income, icon: ArrowDownLeft, className: 'positive' },
    { title: 'Despesas previstas', value: selected.expenses, icon: ArrowUpRight, className: 'negative' },
    { title: 'Total das faturas', value: selected.invoicesTotal, icon: CreditCard },
    { title: 'Saldo final previsto', value: selected.closing, icon: TrendingUp, balance: true },
    { title: 'Menor saldo do mês', value: selected.minimum.closing, icon: CalendarDays,
      detail: shortDate(selected.minimum.date), balance: true },
  ]

  return <>
    <Heading title="Visão geral" description="Acompanhe seu dinheiro hoje e planeje os próximos meses."
      action={<MonthPicker month={month} onChange={setMonth} />} />
    {negative && <div className="negative-banner" role="status"><CircleAlert size={19} /><span>
      Seu saldo ficará negativo em <strong>{brl(Math.abs(negative.closing))}</strong> no dia <strong>{shortDate(negative.date)}</strong>.
    </span></div>}
    <div className="dashboard-main">
      <Card className="balance-panel" title="Evolução do saldo" description={'Projeção diária em ' + monthLabel(month)}
        action={<span className="chart-key"><span /> Saldo projetado</span>}>
        <BalanceChart points={selected.days.map(day => ({ label: day.date.slice(-2), value: day.closing }))} />
      </Card>
      <Card className="summary-panel" title="Resumo financeiro">
        <dl>
          <div className="current-balance">
            <dt><Wallet size={16} aria-hidden="true" /> Saldo atual</dt>
            <dd><Money value={current} tone /><p>Movimentações confirmadas até hoje</p></dd>
          </div>
          {metrics.map(({ title, value, icon: Icon, className, detail, balance }) => <div className="summary-row" key={title}>
            <dt><Icon size={15} aria-hidden="true" /><span>{title}{detail && <small> · {detail}</small>}</span></dt>
            <dd className={className}><Money value={value} tone={balance} /></dd>
          </div>)}
        </dl>
      </Card>
    </div>
    <div className="dashboard-secondary">
      <Card title="Próximas movimentações" description="Recebimentos e pagamentos previstos"
        action={<Button variant="ghost" size="small" asChild><Link to={demo ? '/demo/lancamentos' : '/lancamentos'}>Ver todos</Link></Button>}>
        {upcoming.length ? <MovementList items={upcoming} compact /> : <Empty>Nenhuma movimentação próxima neste mês.</Empty>}
      </Card>
      <Card title="Projeção de seis meses" description="Saldo acumulado no fim de cada mês">
        <BalanceChart points={summary.map(item => ({ label: monthLabel(item.month).split(' ')[0], value: item.closing }))} name="Saldo acumulado" />
      </Card>
    </div>
    <div className="dashboard-secondary">
      <Card title="Receitas e despesas" description="Totais do mês selecionado"><ComparisonChart income={selected.income} expenses={selected.expenses} /></Card>
      <Card title="Despesas por categoria" description="Inclui as parcelas de compras no cartão"><CategoryChart items={categories} /></Card>
    </div>
  </>
}
