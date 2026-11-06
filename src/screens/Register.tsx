import { useState } from 'react'
import { Icon } from '../components'
import { insertRow } from '../lib/data'
import { brl } from '../lib/format'
import { isoDate, weekSummary } from '../lib/plan'
import type { AppData, PaymentMethod } from '../lib/types'

const PAYS: PaymentMethod[] = ['Débito', 'Pix', 'Dinheiro', 'Crédito']
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', 'del']

export function Register({ data, today, reload }: { data: AppData; today: Date; reload: () => Promise<void> }) {
  const { settings, categories, expenses } = data
  const [cents, setCents] = useState(0)
  const [desc, setDesc] = useState('')
  const [catId, setCatId] = useState<number | null>(categories[0]?.id ?? null)
  const [pay, setPay] = useState<PaymentMethod>('Débito')
  const [date, setDate] = useState(isoDate(today))
  const [newCat, setNewCat] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const week = weekSummary(settings, categories, expenses, today)
  const selected = categories.find((c) => c.id === catId)
  const counts = !selected || selected.in_weekly_limit
  const after = week.left - (counts ? cents / 100 : 0)

  const press = (k: string) => {
    setCents((c) => {
      let s = String(c)
      if (k === 'del') s = s.slice(0, -1) || '0'
      else s = (s === '0' ? '' : s) + k
      return Math.min(parseInt(s, 10) || 0, 99999999)
    })
  }

  const createCategory = async () => {
    const name = (newCat ?? '').trim()
    if (!name) return setNewCat(null)
    try {
      const row = await insertRow('categories', { name, weekly_cap: 0, in_weekly_limit: true, sort: categories.length })
      await reload()
      setCatId(row.id)
      setNewCat(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const save = async () => {
    if (cents <= 0) return setError('Digite o valor do gasto.')
    setSaving(true)
    setError(null)
    try {
      await insertRow('expenses', {
        amount: cents / 100,
        description: desc.trim(),
        category_id: catId,
        payment_method: pay,
        spent_on: date,
      })
      await reload()
      setSaved(true)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (saved) {
    const w = weekSummary(settings, categories, data.expenses, today)
    return (
      <>
        <header className="between">
          <a href="#inicio" className="icon-btn" aria-label="Voltar ao início" style={{ color: 'var(--ink)' }}><Icon.close /></a>
          <h1 className="display" style={{ fontSize: 20, fontWeight: 700 }}>Novo gasto</h1>
          <span style={{ width: 44 }} />
        </header>
        <div className="card" style={{ alignItems: 'center', textAlign: 'center', padding: 28, marginTop: 40 }}>
          <div style={{ width: 56, height: 56, borderRadius: 28, background: 'var(--accent-soft)', color: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon.check /></div>
          <span style={{ fontSize: 18, fontWeight: 700 }}>Gasto salvo</span>
          <span className="muted" style={{ fontSize: 14 }}>
            {w.left >= 0 ? <>Ainda pode gastar <strong style={{ color: 'var(--ink)' }}>{brl(w.left)}</strong> esta semana.</> : <>Você passou <strong style={{ color: 'var(--warn)' }}>{brl(-w.left)}</strong> do limite da semana.</>}
          </span>
        </div>
        <button type="button" className="btn secondary" onClick={() => { setSaved(false); setCents(0); setDesc('') }}>Registrar outro</button>
        <a href="#inicio" className="btn" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>Voltar ao início</a>
      </>
    )
  }

  return (
    <>
      <header className="between">
        <a href="#inicio" className="icon-btn" aria-label="Fechar" style={{ color: 'var(--ink)' }}><Icon.close /></a>
        <h1 className="display" style={{ fontSize: 20, fontWeight: 700 }}>Novo gasto</h1>
        <span style={{ width: 44 }} />
      </header>

      <div className="col" style={{ alignItems: 'center', gap: 2 }}>
        <span className="muted" style={{ fontSize: 13 }}>Quanto?</span>
        <span className="display" style={{ fontSize: 48, fontWeight: 700 }} aria-live="polite">{brl(cents / 100, { cents: true })}</span>
        <span className="muted" style={{ fontSize: 13 }}>
          {counts ? <>Sobra da semana depois: <strong style={{ color: after < 0 ? 'var(--warn)' : 'var(--ink)' }}>{brl(after)}</strong></> : 'Esta categoria não entra no limite semanal'}
        </span>
      </div>

      <label className="field">
        O quê?
        <input className="input" type="text" placeholder="ex.: lanche na cantina" value={desc} onChange={(e) => setDesc(e.target.value)} />
      </label>

      <div className="stack" style={{ gap: 8 }}>
        <span className="muted" style={{ fontSize: 13 }}>Categoria</span>
        <div className="chips">
          {categories.map((c) => (
            <button key={c.id} type="button" className="chip" aria-pressed={catId === c.id} onClick={() => setCatId(c.id)}>{c.name}</button>
          ))}
          {newCat === null ? (
            <button type="button" className="chip dashed" onClick={() => setNewCat('')}>+ Nova</button>
          ) : (
            <div className="row" style={{ width: '100%', gap: 8 }}>
              <input className="input compact" autoFocus placeholder="Nome da categoria" aria-label="Nome da nova categoria" value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createCategory()} />
              <button type="button" className="chip" aria-pressed onClick={createCategory}>Criar</button>
            </div>
          )}
        </div>
      </div>

      <div className="stack" style={{ gap: 8 }}>
        <span className="muted" style={{ fontSize: 13 }}>Pago com</span>
        <div className="segmented" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {PAYS.map((p) => (
            <button key={p} type="button" aria-pressed={pay === p} onClick={() => setPay(p)}>{p}</button>
          ))}
        </div>
        {pay === 'Crédito' && <div className="alert" role="alert">Combinado: nada novo no crédito até sair do vermelho. Tem certeza?</div>}
      </div>

      <label className="field">
        Quando
        <input className="input compact" type="date" value={date} max={isoDate(today)} onChange={(e) => setDate(e.target.value)} />
      </label>

      <div className="keypad">
        {KEYS.map((k) => (
          <button key={k} type="button" onClick={() => press(k)} aria-label={k === 'del' ? 'Apagar' : k}>{k === 'del' ? '⌫' : k}</button>
        ))}
      </div>
      {error && <div className="alert" role="alert">{error}</div>}
      <button type="button" className="btn" onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar gasto'}</button>
    </>
  )
}
