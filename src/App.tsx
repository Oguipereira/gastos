import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Nav, Toast, type Route } from './components'
import { loadAll } from './lib/data'
import { seedDemo, seedEmpty } from './lib/seed'
import { supabase } from './lib/supabase'
import type { AppData } from './lib/types'
import { Auth } from './screens/Auth'
import { Bill } from './screens/Bill'
import { Expenses } from './screens/Expenses'
import { Home } from './screens/Home'
import { Plan } from './screens/Plan'
import { Register } from './screens/Register'
import { SettingsScreen } from './screens/Settings'

const ROUTES: Route[] = ['inicio', 'plano', 'registrar', 'fatura', 'ajustes', 'gastos']
const readRoute = (): Route => {
  const h = window.location.hash.replace('#', '') as Route
  return ROUTES.includes(h) ? h : 'inicio'
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div className="spinner" aria-label="Carregando" />
  if (!session) return <Auth />
  return <Main key={session.user.id} email={session.user.email ?? ''} />
}

function Main({ email }: { email: string }) {
  const [data, setData] = useState<AppData | null | undefined>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [route, setRoute] = useState<Route>(readRoute)
  const [toast, setToast] = useState<string | null>(null)
  const [today, setToday] = useState(() => new Date())

  const reload = useCallback(async () => {
    try {
      setData(await loadAll())
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  useEffect(() => {
    // busca inicial no Supabase (sistema externo); o setState acontece depois do await
    // oxlint-disable-next-line react/set-state-in-effect
    void reload()
    const onHash = () => {
      setRoute(readRoute())
      window.scrollTo(0, 0)
    }
    // ao voltar para o app (PWA), atualiza a data e os dados
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setToday(new Date())
        void reload()
      }
    }
    window.addEventListener('hashchange', onHash)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('hashchange', onHash)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [reload])

  const notify = useCallback((m: string) => setToast(m), [])
  const clearToast = useCallback(() => setToast(null), [])

  if (error && data === undefined) {
    return (
      <main className="center-screen">
        <div className="alert" role="alert">Não consegui carregar seus dados: {error}</div>
        <button className="btn" type="button" onClick={reload}>Tentar de novo</button>
      </main>
    )
  }
  if (data === undefined) return <div className="spinner" aria-label="Carregando" />
  if (data === null) return <Onboarding onDone={reload} />

  return (
    <>
      <main className="app">
        {route === 'inicio' && <Home data={data} today={today} />}
        {route === 'plano' && <Plan data={data} />}
        {route === 'registrar' && <Register data={data} today={today} reload={reload} />}
        {route === 'fatura' && <Bill data={data} today={today} reload={reload} notify={notify} />}
        {route === 'ajustes' && <SettingsScreen data={data} reload={reload} notify={notify} email={email} />}
        {route === 'gastos' && <Expenses data={data} reload={reload} notify={notify} />}
      </main>
      {route !== 'registrar' && <Nav route={route} />}
      <Toast message={toast ?? (error ? `Erro: ${error}` : null)} onDone={clearToast} />
    </>
  )
}

function Onboarding({ onDone }: { onDone: () => Promise<void> }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const go = async (fn: typeof seedDemo) => {
    setBusy(true)
    setErr(null)
    try {
      await fn(supabase)
      await onDone()
    } catch (e) {
      setErr((e as Error).message)
      setBusy(false)
    }
  }
  return (
    <main className="center-screen">
      <div className="col" style={{ gap: 8 }}>
        <h1 className="display page-title">Bem-vindo!</h1>
        <p className="subtitle">Como você quer começar? Dá para mudar tudo depois em Ajustes.</p>
      </div>
      <button type="button" className="card" style={{ border: 'none', textAlign: 'left' }} disabled={busy} onClick={() => go(seedDemo)}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>Explorar com dados de exemplo</span>
        <span className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>Um cenário fictício com salário, dois cartões, parcelas e uma meta, para ver o app funcionando. Depois é só editar em Ajustes.</span>
      </button>
      <button type="button" className="card" style={{ border: 'none', textAlign: 'left' }} disabled={busy} onClick={() => go(seedEmpty)}>
        <span style={{ fontSize: 16, fontWeight: 700 }}>Começar do zero</span>
        <span className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>Só as categorias básicas. Você preenche o resto.</span>
      </button>
      {busy && <div className="spinner" aria-label="Preparando" />}
      {err && <div className="alert" role="alert">{err}</div>}
    </main>
  )
}
