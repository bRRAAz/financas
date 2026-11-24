import { useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Download, LogOut, Monitor, Pencil, Plus, Tag, Wallet } from 'lucide-react'
import { categoryIcons } from '../components/icons'
import { Button, Card, Empty, Field, Heading, Modal, Money, Select } from '../components/ui'
import { useFinance } from '../lib/context'
import { addMonths, brDate, endOfMonth, fromCents, monthOf, toCents } from '../lib/dates'
import { daily, isConfirmed, movements } from '../lib/finance'
import { dateField, moneyField, nameField } from '../lib/forms'
import { kinds, statuses } from '../lib/labels'
import type { Account, Category, Theme } from '../lib/types'
import { useSave } from '../lib/use-save'

const categorySchema = z.object({
  name: nameField(80), kind: z.enum(['income', 'expense']), color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  icon: z.string().min(1), active: z.boolean(),
})
type CategoryValues = z.infer<typeof categorySchema>
const iconLabels: Record<keyof typeof categoryIcons, string> = {
  house: 'Casa', utensils: 'Alimentação', car: 'Carro', heart: 'Saúde', book: 'Livro', sparkles: 'Lazer',
  bag: 'Compras', repeat: 'Recorrência', chart: 'Gráfico', tag: 'Etiqueta', wallet: 'Carteira', briefcase: 'Trabalho',
}
function CategoryForm({ category, onClose }: { category?: Category; onClose: () => void }) {
  const { repository } = useFinance()
  const save = useSave()
  const { register, handleSubmit, formState: { errors } } = useForm<CategoryValues>({ resolver: zodResolver(categorySchema),
    defaultValues: { name: category?.name ?? '', kind: category?.kind ?? 'expense', color: category?.color ?? '#6176dc',
      icon: category?.icon ?? 'tag', active: category?.active ?? true },
  })
  return <Modal title={category ? 'Editar categoria' : 'Nova categoria'} onClose={onClose}>
    <form className="form-grid" noValidate onSubmit={handleSubmit(values => save.mutate({
      run: () => repository.save('categories', { ...values, kind: category?.kind ?? values.kind, id: category?.id ?? crypto.randomUUID() }),
      message: 'Categoria salva.', done: onClose,
    }))}>
      <Field label="Nome" error={errors.name?.message} full><input placeholder="Ex.: condomínio" {...register('name')} /></Field>
      <Field label="Tipo"><Select {...register('kind')} disabled={!!category}><option value="expense">Despesa</option><option value="income">Receita</option></Select></Field>
      <Field label="Ícone"><Select {...register('icon')}>{Object.entries(iconLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></Field>
      <Field label="Cor" error={errors.color?.message}><input type="color" {...register('color')} /></Field>
      <label className="checkbox-row field-full"><input type="checkbox" {...register('active')} /> Categoria ativa</label>
      <div className="form-actions field-full"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={save.isPending}>Salvar categoria</Button></div>
    </form>
  </Modal>
}

const accountSchema = z.object({ name: nameField(80), opening: moneyField('signed'), date: dateField, active: z.boolean() })
type AccountValues = z.infer<typeof accountSchema>
function AccountForm({ account, onClose }: { account?: Account; onClose: () => void }) {
  const { repository, now } = useFinance()
  const save = useSave()
  const { register, handleSubmit, formState: { errors } } = useForm<AccountValues>({ resolver: zodResolver(accountSchema),
    defaultValues: { name: account?.name ?? '', opening: fromCents(account?.opening_balance ?? 0),
      date: account?.opening_date ?? now, active: account?.active ?? true },
  })
  return <Modal title={account ? 'Editar conta financeira' : 'Nova conta financeira'}
    description="Informe o saldo no começo da data de referência. Movimentações vinculadas anteriores à data não entram nesse saldo." onClose={onClose}>
    <form className="form-grid" noValidate onSubmit={handleSubmit(values => save.mutate({
      run: () => repository.save('accounts', { id: account?.id ?? crypto.randomUUID(), name: values.name,
        opening_balance: toCents(values.opening), opening_date: values.date, active: values.active }),
      message: 'Conta salva.', done: onClose,
    }))}>
      <Field label="Nome" error={errors.name?.message} full><input placeholder="Ex.: carteira" {...register('name')} /></Field>
      <Field label="Saldo inicial (R$)" error={errors.opening?.message}><input inputMode="decimal" {...register('opening')} /></Field>
      <Field label="Data de referência" error={errors.date?.message}><input type="date" {...register('date')} /></Field>
      <label className="checkbox-row field-full"><input type="checkbox" {...register('active')} /> Conta ativa</label>
      <div className="form-actions field-full"><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" disabled={save.isPending}>Salvar conta</Button></div>
    </form>
  </Modal>
}

function escapeCsv(value: string, userText = false) {
  const safe = userText && /^[\s]*[=+\-@]|^[\t\r\n]/.test(value) ? "'" + value : value
  return '"' + safe.replace(/"/g, '""') + '"'
}

export function Settings() {
  const { data, theme, now, month, demo, user, repository, signOut, notice, openEntry } = useFinance()
  const save = useSave()
  const [dialog, setDialog] = useState<{ type: 'account'; item?: Account } | { type: 'category'; item?: Category } | null>(null)
  const [from, setFrom] = useState(monthOf(month))
  const [to, setTo] = useState(endOfMonth(addMonths(month, 5)))
  const allBalance = daily(data, now, now, now)[0].realized
  const categoryList = [...data.categories].sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name))
  const accounts = [...data.accounts].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))
  const close = () => setDialog(null)

  function exportCsv() {
    if (!from || !to || from > to) { notice('Informe um período válido.', true); return }
    const header = ['Descrição', 'Tipo', 'Valor (BRL)', 'Data prevista', 'Data efetiva', 'Categoria', 'Conta', 'Destino', 'Status', 'Forma de pagamento', 'Observação']
    const rows = movements(data, to > now ? to : now, now).filter(item => {
      const date = isConfirmed(item) ? item.date : item.planned_date
      return date >= from && date <= to
    }).map(item => [
      escapeCsv(item.description, true), escapeCsv(kinds[item.kind]), escapeCsv(fromCents(item.amount)),
      escapeCsv(brDate(item.planned_date)), escapeCsv(item.effective_date ? brDate(item.effective_date) : ''),
      escapeCsv(data.categories.find(row => row.id === item.category_id)?.name ?? '', true),
      escapeCsv(data.accounts.find(row => row.id === item.account_id)?.name ?? '', true),
      escapeCsv(data.accounts.find(row => row.id === item.destination_id)?.name ?? '', true),
      escapeCsv(item.overdue ? 'Vencido' : statuses[item.status]), escapeCsv(item.method, true), escapeCsv(item.notes, true),
    ].join(';'))
    const blob = new Blob(['\uFEFF', [header.map(cell => escapeCsv(cell)).join(';'), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'lancamentos-' + from + '-' + to + '.csv'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    notice('CSV exportado.')
  }

  return <>
    <Heading title="Configurações" description="Gerencie suas contas, categorias e preferências." />
    <div className="dashboard-secondary">
      <Card title={demo ? 'Modo demonstração' : 'Minha conta'} description={demo ? 'Dados fictícios salvos neste navegador.' : user?.email ?? ''}>
        <Button variant="secondary" onClick={() => { void signOut().catch(() => notice('Não foi possível sair. Tente novamente.', true)) }}><LogOut size={16} />{demo ? 'Sair da demonstração' : 'Sair do sistema'}</Button>
      </Card>
      <Card title="Aparência" description="Escolha o tema da aplicação.">
        <div className="inline-actions theme-actions"><Monitor size={18} /><Select aria-label="Tema" value={theme} onChange={event => {
          const value = event.target.value as Theme
          save.mutate({ run: () => repository.theme(value), message: 'Tema atualizado.' })
        }}><option value="system">Sistema</option><option value="light">Claro</option><option value="dark">Escuro</option></Select></div>
      </Card>
    </div>
    <Card title="Contas financeiras" description="Saldo realizado por conta e consolidado."
      action={<div className="inline-actions">
        <Button variant="ghost" size="small" onClick={() => openEntry({ kind: 'transfer' })}>Transferir</Button>
        <Button variant="secondary" size="small" onClick={() => setDialog({ type: 'account' })}><Plus size={16} /> Nova conta</Button>
      </div>}>
      <div className="account-total"><span>Saldo consolidado</span><strong><Money value={allBalance} tone /></strong></div>
      {accounts.length ? <ul className="movement-list">{accounts.map(account => <li className="movement" key={account.id}>
        <span className="icon-tile tone-blue"><Wallet size={17} /></span>
        <div className="movement-main"><strong>{account.name}</strong><small>Saldo em {brDate(account.opening_date)} · <Money value={account.opening_balance} /></small></div>
        <div className="movement-value"><Money value={daily(data, now, now, now, account.id)[0].realized} tone />
          {!account.active && <span className="status">Inativa</span>}</div>
        <div className="row-actions"><Button variant="ghost" size="icon" aria-label={'Editar ' + account.name} onClick={() => setDialog({ type: 'account', item: account })}><Pencil size={16} /></Button></div>
      </li>)}</ul> : <Empty>Nenhuma conta cadastrada.</Empty>}
    </Card>
    <Card title="Categorias" description="Arquive categorias para mantê-las apenas no histórico."
      action={<Button variant="secondary" size="small" onClick={() => setDialog({ type: 'category' })}><Plus size={16} /> Nova categoria</Button>}>
      {categoryList.length ? <div className="categories-settings">
        {categoryList.map(category => {
          const Icon = categoryIcons[category.icon as keyof typeof categoryIcons] ?? Tag
          return <button key={category.id} className="category-tile" onClick={() => setDialog({ type: 'category', item: category })}>
            <span className="category-tile-icon" style={{ color: category.color }}><Icon size={18} /></span>
            <span><strong>{category.name}</strong><small>{kinds[category.kind]}{category.active ? '' : ' · Arquivada'}</small></span>
            <Pencil size={15} />
          </button>
        })}
      </div> : <Empty>Nenhuma categoria cadastrada.</Empty>}
    </Card>
    <Card title="Exportar lançamentos" description="Baixe um CSV com as movimentações no período selecionado.">
      <div className="export-fields">
        <Field label="De"><input type="date" value={from} onChange={event => setFrom(event.target.value)} /></Field>
        <Field label="Até"><input type="date" value={to} onChange={event => setTo(event.target.value)} /></Field>
        <Button variant="secondary" onClick={exportCsv}><Download size={17} /> Exportar CSV</Button>
      </div>
    </Card>
    {dialog?.type === 'account' && <AccountForm account={dialog.item} onClose={close} />}
    {dialog?.type === 'category' && <CategoryForm category={dialog.item} onClose={close} />}
  </>
}
