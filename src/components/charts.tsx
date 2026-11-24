import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { brl } from '../lib/dates'
import { Empty, Money } from './ui'

const green = 'var(--chart-positive)'
const red = 'var(--chart-negative)'
const comparison = 'var(--subtle)'
type Point = { label: string; value: number; baseline?: number }
const axis = { fill: 'var(--muted)', fontSize: 12 }
const formatAxis = (cents: number) => {
  if (Math.abs(cents) >= 100000) return 'R$ ' + new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(cents / 100000) + ' mil'
  return 'R$ ' + new Intl.NumberFormat('pt-BR').format(cents / 100)
}
const tooltip = { background: 'var(--surface)', color: 'var(--ink)', border: '1px solid var(--border)', borderRadius: 10 }

export function BalanceChart({ points, name = 'Saldo projetado' }: { points: Point[]; name?: string }) {
  return <div className="chart balance-chart" role="img" aria-label={name}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <AreaChart data={points} margin={{ top: 15, left: 7, right: 12, bottom: 1 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="4 4" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={11} tick={axis} minTickGap={22} />
        <YAxis width={70} tickFormatter={formatAxis} axisLine={false} tickLine={false} tick={axis} />
        <Tooltip contentStyle={tooltip} labelStyle={{ color: 'var(--muted)' }} formatter={value => brl(Number(value))} />
        {points[0]?.baseline !== undefined && <Area type="linear" dataKey="baseline" name="Saldo sem simulação"
          stroke={comparison} strokeWidth={2} strokeDasharray="5 4" fill="none" dot={false} />}
        <Area type="linear" dataKey="value" name={name} stroke={green} strokeWidth={2.5}
          fill={green} fillOpacity={0.1} dot={false} activeDot={{ r: 5, stroke: 'var(--surface)', strokeWidth: 2 }} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
}

export function ComparisonChart({ income, expenses }: { income: number; expenses: number }) {
  return <div className="chart small-chart" role="img" aria-label={'Receitas ' + brl(income) + ' e despesas ' + brl(expenses)}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart data={[{ label: 'Receitas', value: income }, { label: 'Despesas', value: expenses }]}
        margin={{ top: 10, left: 0, right: 12, bottom: 4 }}>
        <CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="4 4" />
        <XAxis dataKey="label" axisLine={false} tickLine={false} tickMargin={10} tick={axis} />
        <YAxis width={70} tickFormatter={formatAxis} axisLine={false} tickLine={false} tick={axis} />
        <Tooltip contentStyle={tooltip} cursor={{ fill: 'var(--surface-muted)' }} formatter={value => brl(Number(value))} />
        <Bar dataKey="value" name="Total" maxBarSize={65} radius={[5, 5, 0, 0]}>
          <Cell fill={green} /><Cell fill={red} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
}

export function CategoryChart({ items }: { items: { label: string; value: number; color: string }[] }) {
  if (!items.length) return <Empty>Sem despesas neste período.</Empty>
  return <div className="category-chart">
    <div className="chart donut" role="img" aria-label="Distribuição das despesas por categoria">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <PieChart><Pie data={items} dataKey="value" nameKey="label" innerRadius="63%" outerRadius="94%" stroke="none" paddingAngle={3}>
          {items.map(item => <Cell key={item.label} fill={item.color} />)}
        </Pie><Tooltip contentStyle={tooltip} formatter={value => brl(Number(value))} /></PieChart>
      </ResponsiveContainer>
    </div>
    <ul className="category-legend">{items.map(item => <li key={item.label}>
      <span className="legend-color" style={{ background: item.color }} /><span>{item.label}</span><Money value={item.value} />
    </li>)}</ul>
  </div>
}
