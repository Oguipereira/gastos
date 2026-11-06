import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'

export function Auth() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
        if (error) throw error
        if (!data.session) setMsg({ kind: 'info', text: 'Conta criada! Abra o e-mail de confirmação que o Supabase mandou, toque no link e depois entre aqui.' })
      }
    } catch (err) {
      const m = (err as Error).message
      setMsg({ kind: 'error', text: m.includes('Invalid login') ? 'E-mail ou senha errados.' : m.includes('not confirmed') ? 'Confirme seu e-mail antes de entrar.' : m })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="center-screen">
      <div className="col" style={{ gap: 8 }}>
        <span style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 26 }} aria-hidden="true">R$</span>
        <h1 className="display page-title">Minhas finanças</h1>
        <p className="subtitle">Limite da semana, plano até a meta e simulador de fatura.</p>
      </div>
      <form className="stack" onSubmit={submit}>
        <label className="field">E-mail<input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field">Senha<input className="input" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        {msg && <div className={msg.kind === 'error' ? 'alert' : 'notice'} role="alert">{msg.text}</div>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Aguarde…' : mode === 'in' ? 'Entrar' : 'Criar conta'}</button>
        <button className="btn ghost" type="button" style={{ textAlign: 'center' }} onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null) }}>
          {mode === 'in' ? 'Primeira vez? Criar conta' : 'Já tenho conta. Entrar'}
        </button>
      </form>
    </main>
  )
}
