import { useState } from 'react'
import { AutoField, Icon } from '../components'
import { fromMonthInput, parseMoney, toMonthInput } from '../lib/input'
import { deleteRow, insertRow, updateRow, updateSettings, upsertBill } from '../lib/data'
import { brl, monthLabel } from '../lib/format'
import { addMonths } from '../lib/plan'
import { supabase } from '../lib/supabase'
import type { AppData, Card, PlanItem } from '../lib/types'

type Props = { data: AppData; reload: () => Promise<void>; notify: (m: string) => void; email: string }

export function SettingsScreen({ data, reload, notify, email }: Props) {
  const { settings, cards, bills, items, categories } = data
  const run = async (fn: () => Promise<unknown>) => {
    try {
      await fn()
      await reload()
    } catch (e) {
      notify((e as Error).message)
    }
  }
  const setS = (patch: Record<string, unknown>) => run(() => updateSettings(settings.user_id, patch))

  return (
    <>
      <header className="col">
        <h1 className="display page-title">Ajustes</h1>
        <span className="subtitle">Mude qualquer valor: salva sozinho quando você sai do campo, e o plano recalcula.</span>
      </header>

      <h2 className="section-title">Você e o dinheiro</h2>
      <section className="card">
        <AutoField label="Seu nome" value={settings.display_name} onSave={(v) => setS({ display_name: v.trim() })} />
        <div className="grid2">
          <AutoField label="Guardado hoje (R$)" type="number" value={settings.saved_balance} onSave={(v) => setS({ saved_balance: parseMoney(v) })} />
          <AutoField label="Limite por semana (R$)" type="number" value={settings.weekly_limit} onSave={(v) => setS({ weekly_limit: parseMoney(v) })} />
        </div>
        <div className="grid2">
          <AutoField label="Plano começa em" type="month" value={toMonthInput(settings.plan_start)} onSave={(v) => { if (v) void setS({ plan_start: fromMonthInput(v) }) }} />
          <AutoField label="Meses no plano" type="number" value={settings.plan_months} onSave={(v) => setS({ plan_months: Math.max(1, Math.min(60, Math.round(parseMoney(v)))) })} />
        </div>
      </section>

      <h2 className="section-title">Meta</h2>
      <section className="card">
        <div className="grid2">
          <AutoField label="Nome da meta" value={settings.goal_name} onSave={(v) => setS({ goal_name: v.trim() || 'Meta' })} />
          <AutoField label="Valor (R$)" type="number" value={settings.goal_amount} onSave={(v) => setS({ goal_amount: parseMoney(v) })} />
        </div>
      </section>

      <h2 className="section-title">Entradas e compromissos</h2>
      <p className="small muted" style={{ margin: '0 4px' }}>Salário, renda extra, parcelas fora da fatura e gastos únicos (ex.: viagem). Deixe "meses" vazio para "todo mês".</p>
      <section className="card tight">
        {items.map((it) => <ItemRow key={it.id} item={it} run={run} />)}
        <div className="row" style={{ gap: 16 }}>
          <button type="button" className="btn ghost" onClick={() => run(() => insertRow('plan_items', { kind: 'income', name: 'Nova entrada', amount: 0, start_month: settings.plan_start, months: 1 }))}>+ Entrada</button>
          <button type="button" className="btn ghost" onClick={() => run(() => insertRow('plan_items', { kind: 'expense', name: 'Novo gasto', amount: 0, start_month: settings.plan_start, months: 1 }))}>+ Gasto ou parcela</button>
        </div>
      </section>

      <h2 className="section-title">Cartões e faturas</h2>
      {cards.map((c) => <CardEditor key={c.id} card={c} bills={bills.filter((b) => b.card_id === c.id)} planStart={settings.plan_start} run={run} />)}
      <button type="button" className="chip dashed" style={{ height: 48, borderRadius: 14 }} onClick={() => run(() => insertRow('cards', { name: 'Novo cartão', closing_day: null, sort: cards.length }))}>+ Adicionar cartão</button>

      <h2 className="section-title">Categorias e tetos por semana</h2>
      <section className="card tight">
        {categories.map((c) => (
          <div className="edit-row" key={c.id}>
            <div className="row" style={{ gap: 8 }}>
              <div style={{ flex: '1 1 0', minWidth: 0 }}><AutoField compact ariaLabel="Nome da categoria" value={c.name} onSave={(v) => run(() => updateRow('categories', c.id, { name: v.trim() || c.name }))} /></div>
              <div style={{ width: 96 }}><AutoField compact type="number" ariaLabel={`Teto de ${c.name}`} value={c.weekly_cap} onSave={(v) => run(() => updateRow('categories', c.id, { weekly_cap: parseMoney(v) }))} /></div>
              <button type="button" className="icon-btn" aria-label={`Apagar ${c.name}`} style={{ border: 'none', color: 'var(--warn)' }} onClick={() => run(() => deleteRow('categories', c.id))}><Icon.trash /></button>
            </div>
            <label className="check">
              <input type="checkbox" checked={c.in_weekly_limit} onChange={(e) => run(() => updateRow('categories', c.id, { in_weekly_limit: e.target.checked }))} />
              Conta no limite da semana {c.in_weekly_limit ? '' : '(o teto vira orçamento total, ex.: viagem)'}
            </label>
          </div>
        ))}
        <button type="button" className="btn ghost" onClick={() => run(() => insertRow('categories', { name: 'Nova categoria', weekly_cap: 0, in_weekly_limit: true, sort: categories.length }))}>+ Nova categoria</button>
      </section>
      <p className="small muted" style={{ margin: '0 4px' }}>Soma dos tetos: {brl(categories.filter((c) => c.in_weekly_limit).reduce((s, c) => s + c.weekly_cap, 0))} · limite semanal: {brl(settings.weekly_limit)}</p>


      <h2 className="section-title">Conta</h2>
      <section className="card">
        <div className="between"><span className="muted" style={{ fontSize: 14 }}>{email}</span>
          <button type="button" className="btn danger" onClick={() => supabase.auth.signOut()}>Sair</button></div>
      </section>
    </>
  )
}

function ItemRow({ item, run }: { item: PlanItem; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const up = (patch: Record<string, unknown>) => run(() => updateRow('plan_items', item.id, patch))
  return (
    <div className="edit-row">
      <div className="row" style={{ gap: 8 }}>
        <select className="input compact" style={{ width: 104, flexShrink: 0 }} aria-label="Tipo" value={item.kind} onChange={(e) => up({ kind: e.target.value })}>
          <option value="income">Entrada</option>
          <option value="expense">Saída</option>
        </select>
        <div style={{ flex: '1 1 0', minWidth: 0 }}><AutoField compact ariaLabel="Nome" value={item.name} onSave={(v) => up({ name: v.trim() || item.name })} /></div>
        <button type="button" className="icon-btn" aria-label={`Apagar ${item.name}`} style={{ border: 'none', color: 'var(--warn)' }} onClick={() => run(() => deleteRow('plan_items', item.id))}><Icon.trash /></button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.35fr 0.8fr', gap: 8 }}>
        <AutoField label="Valor/mês" compact type="number" value={item.amount} onSave={(v) => up({ amount: parseMoney(v) })} />
        <AutoField label="A partir de" compact type="month" value={toMonthInput(item.start_month)} onSave={(v) => { if (v) void up({ start_month: fromMonthInput(v) }) }} />
        <AutoField label="Meses" compact type="number" placeholder="todo mês" value={item.months} onSave={(v) => up({ months: v.trim() === '' ? null : Math.max(1, Math.round(parseMoney(v))) })} />
      </div>
      <AutoField compact ariaLabel="Observação" placeholder="observação (opcional)" value={item.note} onSave={(v) => up({ note: v })} />
    </div>
  )
}

function CardEditor({ card, bills, planStart, run }: { card: Card; bills: AppData['bills']; planStart: string; run: (fn: () => Promise<unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const months = Array.from(new Set([...bills.map((b) => b.month), ...Array.from({ length: 12 }, (_, i) => addMonths(planStart, i))])).sort()
  const total = bills.reduce((s, b) => s + b.amount, 0)
  return (
    <section className="card" aria-label={card.name}>
      <div className="row" style={{ gap: 8 }}>
        <div style={{ flex: '1 1 0', minWidth: 0 }}><AutoField compact ariaLabel="Nome do cartão" value={card.name} onSave={(v) => run(() => updateRow('cards', card.id, { name: v.trim() || card.name }))} /></div>
        <div style={{ width: 92 }}><AutoField compact type="number" ariaLabel="Dia de fechamento" placeholder="fecha dia" value={card.closing_day} onSave={(v) => run(() => updateRow('cards', card.id, { closing_day: v.trim() === '' ? null : Math.max(1, Math.min(31, Math.round(parseMoney(v)))) }))} /></div>
        <button type="button" className="icon-btn" aria-label={`Apagar cartão ${card.name}`} style={{ border: 'none', color: 'var(--warn)' }} onClick={() => run(() => deleteRow('cards', card.id))}><Icon.trash /></button>
      </div>
      <button type="button" className="btn ghost" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {open ? 'Fechar faturas' : `Editar faturas · ${bills.filter((b) => b.amount > 0).length} meses · ${brl(total)}`}
      </button>
      {open && (
        <div className="grid3">
          {months.map((m) => (
            <AutoField key={m} label={monthLabel(m)} compact type="number" placeholder="0" value={bills.find((b) => b.month === m)?.amount ?? ''} onSave={(v) => run(() => upsertBill(card.id, m, parseMoney(v)))} />
          ))}
        </div>
      )}
    </section>
  )
}
