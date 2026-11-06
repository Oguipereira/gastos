import { useState, type FormEvent } from 'react'
import { suggestEmail } from '../lib/email'
import { supabase } from '../lib/supabase'

const normalize = (email: string) => email.trim().toLowerCase()

export function Auth() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)
  const [unconfirmed, setUnconfirmed] = useState<string | null>(null)

  const clean = normalize(email)
  const suggestion = suggestEmail(clean)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg(null)
    setUnconfirmed(null)
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email: clean, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email: clean, password, options: { emailRedirectTo: window.location.origin } })
        if (error) throw error
        if (!data.session) setMsg({ kind: 'info', text: `Conta criada! Abra o e-mail de confirmação enviado para ${clean}, toque no link e depois entre aqui.` })
      }
    } catch (err) {
      const m = (err as Error).message
      if (m.toLowerCase().includes('not confirmed')) {
        setUnconfirmed(clean)
        setMsg({ kind: 'error', text: `O e-mail ${clean} ainda não foi confirmado. Confira se digitou o endereço certo ou reenvie a confirmação.` })
      } else if (m.includes('Invalid login')) {
        setMsg({ kind: 'error', text: `E-mail ou senha errados para ${clean}.` })
      } else {
        setMsg({ kind: 'error', text: m })
      }
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    if (!unconfirmed) return
    setBusy(true)
    const { error } = await supabase.auth.resend({ type: 'signup', email: unconfirmed, options: { emailRedirectTo: window.location.origin } })
    setBusy(false)
    setMsg(error ? { kind: 'error', text: error.message } : { kind: 'info', text: `Enviamos de novo para ${unconfirmed}. Abra o link no e-mail e volte aqui.` })
  }

  return (
    <main className="center-screen">
      <div className="col" style={{ gap: 8 }}>
        <span style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--accent)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 26 }} aria-hidden="true">R$</span>
        <h1 className="display page-title">Minhas finanças</h1>
        <p className="subtitle">Limite da semana, plano até a meta e simulador de fatura.</p>
      </div>
      <form className="stack" onSubmit={submit}>
        <label className="field">
          E-mail
          <input className="input" type="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        {suggestion && (
          <button type="button" className="notice" style={{ border: 'none', textAlign: 'left' }} onClick={() => setEmail(suggestion)}>
            Você quis dizer <strong>{suggestion}</strong>? Toque para corrigir.
          </button>
        )}
        <label className="field">
          Senha
          <input className="input" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {msg && <div className={msg.kind === 'error' ? 'alert' : 'notice'} role="alert">{msg.text}</div>}
        {unconfirmed && (
          <button type="button" className="btn secondary" disabled={busy} onClick={resend}>Reenviar e-mail de confirmação</button>
        )}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Aguarde…' : mode === 'in' ? 'Entrar' : 'Criar conta'}</button>
        <button className="btn ghost" type="button" style={{ textAlign: 'center' }} onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null); setUnconfirmed(null) }}>
          {mode === 'in' ? 'Primeira vez? Criar conta' : 'Já tenho conta. Entrar'}
        </button>
      </form>
    </main>
  )
}
