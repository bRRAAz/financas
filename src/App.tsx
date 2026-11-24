import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { CalendarDays, ChartNoAxesCombined, CircleAlert, CreditCard, LayoutDashboard, List, LoaderCircle, LogOut, Menu, PanelLeftClose, PanelLeftOpen, Plus, Repeat2, Settings2, X } from 'lucide-react'
import { Brand } from './components/Brand'
import { Button, Field, Modal, cn } from './components/ui'
import { FinanceContext, type EntryDialogState } from './lib/context'
import { monthOf, today } from './lib/dates'
import { demoRepository, remoteRepository } from './lib/repository'
import { appName, isPasswordSession, passwordSetupIssue, supabase } from './lib/supabase'

const Dashboard = lazy(() => import('./pages/Dashboard').then(module => ({ default: module.Dashboard })))
const Calendar = lazy(() => import('./pages/Calendar').then(module => ({ default: module.Calendar })))
const Projection = lazy(() => import('./pages/Projection').then(module => ({ default: module.Projection })))
const Transactions = lazy(() => import('./pages/Transactions').then(module => ({ default: module.Transactions })))
const EntryDialog = lazy(() => import('./components/EntryDialog').then(module => ({ default: module.EntryDialog })))
const Cards = lazy(() => import('./pages/Cards').then(module => ({ default: module.Cards })))
const Recurrences = lazy(() => import('./pages/Recurrences').then(module => ({ default: module.Recurrences })))
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })))

const denied = 'Sua conta não possui autorização para acessar este sistema'
const links = [
  { icon: LayoutDashboard, path: '', label: 'Visão geral', mobile: 'Início', view: Dashboard },
  { icon: CalendarDays, path: 'calendario', label: 'Calendário financeiro', mobile: 'Calendário', view: Calendar },
  { icon: ChartNoAxesCombined, path: 'projecao', label: 'Projeção mensal', mobile: 'Projeção', view: Projection },
  { icon: List, path: 'lancamentos', label: 'Lançamentos', mobile: 'Lançamentos', view: Transactions },
  { icon: CreditCard, path: 'cartoes', label: 'Cartões de crédito', mobile: 'Cartões', view: Cards },
  { icon: Repeat2, path: 'recorrencias', label: 'Recorrências', mobile: 'Recorrências', view: Recurrences },
  { icon: Settings2, path: 'configuracoes', label: 'Configurações', mobile: 'Configurações', view: Settings },
]
const navGroups = [
  { label: 'Planejamento', links: links.slice(0, 3) },
  { label: 'Movimentações', links: links.slice(3, 6) },
  { label: 'Preferências', links: links.slice(6) },
]

function Loading({ label }: { label: string }) {
  return <div className="screen-feedback" role="status"><LoaderCircle className="spinner" size={25} /><p>{label}</p></div>
}

function Login({ unauthorized }: { unauthorized: boolean }) {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState('')
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || busy) return
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    setFailure('')
    setBusy(true)
    try {
      const setupIssue = await passwordSetupIssue()
      if (setupIssue) { setFailure(setupIssue); return }
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error?.code === 'invalid_credentials' || error?.code === 'email_not_confirmed') {
        setFailure('Não foi possível entrar. Confira o e-mail e a senha da conta autorizada.')
      } else if (error) {
        setFailure('Não foi possível entrar agora. Tente novamente mais tarde.')
      }
    } catch {
      setFailure('Não foi possível conectar ao Supabase. Tente novamente.')
    } finally {
      setBusy(false)
    }
  }
  return <main className="login">
    <div className="login-card">
      <Brand />
      <h1>Entrar no {appName}</h1>
      {(unauthorized || failure) && <p className="login-error" role="alert">{failure || denied}</p>}
      {!supabase && <p className="setup-message">Configuração pendente. Preencha a URL e a chave publicável do Supabase no ambiente da aplicação.</p>}
      <form className="login-form" onSubmit={login}>
        <Field label="E-mail"><input type="email" name="email" autoComplete="username" required disabled={!supabase} /></Field>
        <Field label="Senha"><input type="password" name="password" autoComplete="current-password" required disabled={!supabase} /></Field>
        <Button type="submit" disabled={busy || !supabase}>{busy ? 'Entrando…' : 'Entrar'}</Button>
      </form>
      {import.meta.env.DEV && <Button variant="ghost" asChild><NavLink to="/demo">Abrir demonstração local</NavLink></Button>}
    </div>
  </main>
}

function Workspace({ user, demo }: { user: User | null; demo: boolean }) {
  const repo = import.meta.env.DEV && demo ? demoRepository : remoteRepository
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const base = demo ? '/demo' : ''
  const now = today()
  const [month, setMonth] = useState(monthOf(now))
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('financeiro-sidebar') === 'collapsed')
  const [menu, setMenu] = useState(false)
  const [entry, setEntry] = useState<EntryDialogState | null>(null)
  const [toast, setToast] = useState<{ message: string; error: boolean } | null>(null)
  const query = useQuery({ queryKey: ['finance', user?.id ?? 'demo'], queryFn: repo.read })
  const theme = query.data?.theme ?? 'system'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    return () => { delete document.documentElement.dataset.theme }
  }, [theme])
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(timer)
  }, [toast])

  const notice = (message: string, error = false) => setToast({ message, error })
  const userName = (typeof user?.user_metadata.full_name === 'string' ? user.user_metadata.full_name : user?.email) || 'Demonstração'
  const initials = userName.split(/\s|@/).slice(0, 2).map(piece => piece.charAt(0).toUpperCase()).join('')
  const active = links.find(item => pathname === (item.path ? base + '/' + item.path : base || '/')) ?? links[0]
  const navPath = (path: string) => path ? base + '/' + path : base || '/'
  const signOut = async () => {
    if (!demo && supabase) {
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw error
      queryClient.removeQueries({ queryKey: ['finance', user?.id] })
    }
    navigate('/', { replace: true })
  }
  function toggleSidebar() {
    localStorage.setItem('financeiro-sidebar', collapsed ? 'expanded' : 'collapsed')
    setCollapsed(!collapsed)
  }

  return <div className={cn('workspace', collapsed && 'sidebar-collapsed')}>
    <header className="topbar">
      <div className="topbar-context">
        <NavLink to={navPath('')} className="brand-link" aria-label={appName}><Brand /></NavLink>
        <span className="desktop-context">{active.label}</span>
      </div>
      <div className="topbar-actions">
        {demo && <span className="demo-label" title="Dados fictícios">Demonstração</span>}
        <Button onClick={() => setEntry({})} disabled={!query.data} className="new-entry" aria-label="Novo lançamento"><Plus size={16} /><span>Novo lançamento</span><span className="mobile-entry-label">Novo</span></Button>
        <NavLink to={navPath('configuracoes')} className="topbar-profile" aria-label="Configurações da conta" title={userName}>
          <span className="avatar">{initials}</span>
        </NavLink>
      </div>
    </header>
    <aside className="sidebar">
      <nav id="navegacao-principal" aria-label="Navegação principal" className="side-nav">
        {navGroups.map(group => <div className="nav-group" key={group.label}>
          {!collapsed && <div className="nav-caption">{group.label}</div>}
          {group.links.map(({ icon: Icon, path, label }) => <NavLink key={path} to={navPath(path)} end
            aria-label={label} title={collapsed ? label : undefined} className={({ isActive }) => cn('nav-link', isActive && 'nav-active')}>
            <Icon size={17} />{!collapsed && <span>{label}</span>}
          </NavLink>)}
        </div>)}
      </nav>
      <div className="sidebar-bottom">
        <Button variant="ghost" className="collapse-button" onClick={toggleSidebar}
          aria-controls="navegacao-principal" aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} title={collapsed ? 'Expandir menu' : undefined}>
          {collapsed ? <PanelLeftOpen size={18} /> : <><PanelLeftClose size={18} /> Recolher menu</>}
        </Button>
      </div>
    </aside>
    <div className="workspace-body">
      {query.isPending && <main><Loading label="Carregando seu painel…" /></main>}
      {query.isError && <main><div className="screen-feedback" role="alert">
        <CircleAlert size={25} /><h1>Não foi possível carregar os dados</h1>
        <p>Confira a conexão e a configuração do Supabase.</p>
        <div className="inline-actions"><Button variant="secondary" onClick={() => { void signOut().catch(() => notice('Não foi possível sair.', true)) }}><LogOut size={16} /> Sair</Button>
          <Button onClick={() => { void query.refetch() }}>Tentar novamente</Button></div>
      </div></main>}
      {query.data && <FinanceContext.Provider value={{
        data: query.data.data, theme, repository: repo, demo, user, now, month, setMonth, signOut, notice,
        openEntry: (options = {}) => setEntry(options),
      }}>
        <main className="page-content" id="conteudo">
          <Suspense fallback={<Loading label="Carregando página…" />}>
            <Routes>
              {links.map(({ path, view: View }) => path ? <Route key={path} path={path} element={<View />} />
                : <Route key="home" index element={<View />} />)}
              <Route path="*" element={<Navigate to={navPath('')} replace />} />
            </Routes>
          </Suspense>
        </main>
        {entry && <Suspense fallback={null}><EntryDialog options={entry} onClose={() => setEntry(null)} /></Suspense>}
      </FinanceContext.Provider>}
    </div>
    <nav className="mobile-nav" aria-label="Navegação móvel">
      {links.slice(0, 4).map(({ icon: Icon, path, mobile }) =>
        <NavLink key={path} to={navPath(path)} end className={({ isActive }) => cn('mobile-nav-link', isActive && 'mobile-active')}>
          <Icon size={20} /><span>{mobile}</span>
        </NavLink>)}
      <button className={cn('mobile-nav-link', links.indexOf(active) >= 4 && 'mobile-active')} onClick={() => setMenu(true)}><Menu size={21} /><span>Mais</span></button>
    </nav>
    {menu && <Modal title="Mais opções" onClose={() => setMenu(false)}>
      <nav className="side-nav mobile-menu" aria-label="Outros módulos">{links.slice(4).map(({ icon: Icon, path, label }) =>
        <NavLink key={path} to={navPath(path)} onClick={() => setMenu(false)} className={({ isActive }) => cn('nav-link', isActive && 'nav-active')}>
          <Icon size={19} /><span>{label}</span>
        </NavLink>)}</nav>
    </Modal>}
    {toast && <div className={cn('toast', toast.error && 'toast-error')} role={toast.error ? 'alert' : 'status'}>
      <span>{toast.message}</span><Button variant="ghost" size="icon" aria-label="Dispensar notificação" onClick={() => setToast(null)}><X size={16} /></Button>
    </div>}
  </div>
}

export function App() {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)
  useEffect(() => {
    document.title = appName
    if (!supabase) return
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => subscription.unsubscribe()
  }, [])
  const auth = session === undefined ? <Loading label="Verificando sessão…" /> : session && isPasswordSession(session)
    ? <Workspace key={session.user.id} demo={false} user={session.user} />
    : <Login unauthorized={!!session} />

  return <Routes>
    {import.meta.env.DEV && <Route path="/demo/*" element={<Workspace key="demo" demo user={null} />} />}
    <Route path="/*" element={auth} />
  </Routes>
}
