import { useMemo, useState } from 'react'
import { parseMoney } from '../lib/input'
import { insertRow } from '../lib/data'
import { brl, monthLabel, monthName } from '../lib/format'
import { addMonths, installment, itemAmountFor } from '../lib/plan'
import type { AppData } from '../lib/types'
import { nextClosing } from '../lib/cards'

const N_OPTS = [3, 6, 9, 12, 18, 24]

/** Data de fechamento da fatura que vence no mês `billMonth` (fecha ~10 dias antes do vencimento). */
function closingFor(card: { closing_day: number | null } | undefined, billMonth: string): string | null {
  if (!card?.closing_day) return null
  const m = card.closing_day >= 21 ? addMonths(billMonth, -1) : billMonth
  return `${m.slice(0, 8)}${String(card.closing_day).padStart(2, '0')}`
}

export function Bill({ data, today, reload, notify }: { data: AppData; today: Date; reload: () => Promise<void>; notify: (m: string) => void }) {
  const { settings, cards, bills, items } = data
  const withClosing = cards.filter((c) => c.closing_day)
  const defaultCard = withClosing.map((c) => ({ c, nc: nextClosing(c, today)! })).sort((a, b) => a.nc.date.getTime() - b.nc.date.getTime())[0]?.c ?? cards[0]

  const [cardId, setCardId] = useState<number | null>(defaultCard?.id ?? null)
  const card = cards.find((c) => c.id === cardId)
  const nc = card ? nextClosing(card, today) : null
  const [month, setMonth] = useState<string>(nc?.billMonth ?? settings.plan_start)
  const [salaryFirst, setSalaryFirst] = useState(false)
  const [haveOverride, setHaveOverride] = useState<string>('')
  const [entradaOverride, setEntradaOverride] = useState<number | null>(null)
  const [n, setN] = useState(6)
  const [rate, setRate] = useState('8')
  const [busy, setBusy] = useState(false)

  const fatura = card ? bills.find((b) => b.card_id === card.id && b.month === month)?.amount ?? 0 : 0

  // Estimativa do dinheiro disponível no dia: guardado + entradas pontuais do mês − outras faturas do mês − gastos pontuais do mês − meio mês de vida
  const estimate = useMemo(() => {
    const parts: { label: string; value: number }[] = []
    const isFirst = month === settings.plan_start
    if (isFirst) parts.push({ label: 'Guardado', value: settings.saved_balance })
    for (const it of items) {
      const v = itemAmountFor(it, month)
      if (!v) continue
      if (it.kind === 'income' && it.months !== null) parts.push({ label: it.name, value: v })
      if (it.kind === 'expense') parts.push({ label: it.name, value: -v })
    }
    const mine = closingFor(cards.find((c) => c.id === cardId), month)
    for (const c of cards) {
      if (c.id === cardId) continue
      // só desconta faturas de outros cartões que vencem antes desta
      const theirs = closingFor(c, month)
      if (mine && theirs && theirs >= mine) continue
      const b = bills.find((x) => x.card_id === c.id && x.month === month)?.amount ?? 0
      if (b) parts.push({ label: `Fatura ${c.name}`, value: -b })
    }
    parts.push({ label: 'Pra viver até o salário', value: -settings.weekly_limit * 2 })
    const recurring = items.filter((it) => it.kind === 'income' && it.months === null).reduce((s, it) => s + itemAmountFor(it, month), 0)
    return { parts, base: parts.reduce((s, p) => s + p.value, 0), recurring }
  }, [items, cards, bills, month, cardId, settings])

  const have = haveOverride !== '' ? parseMoney(haveOverride) : estimate.base + (salaryFirst ? estimate.recurring : 0)
  const gap = have - fatura
  const defEntrada = Math.max(0, Math.min(have, fatura))
  const entrada = entradaOverride === null ? defEntrada : Math.min(entradaOverride, fatura)
  const financed = Math.max(0, fatura - entrada)
  const r = Math.max(0, parseMoney(rate)) / 100
  const pmt = installment(financed, r, n)
  const interest = pmt * n - financed
  const firstMonth = addMonths(month, 1)
  const lastMonth = addMonths(month, n)

  const reset = () => { setEntradaOverride(null); setHaveOverride('') }

  const apply = async () => {
    if (!card || financed <= 0) return
    setBusy(true)
    try {
      await insertRow('plan_items', {
        kind: 'income', name: `Parcelado da fatura ${card.name}`, note: `fatura de ${monthLabel(month)}`,
        amount: Math.round(financed * 100) / 100, start_month: month, months: 1,
      })
      await insertRow('plan_items', {
        kind: 'expense', name: `Parcelas ${card.name}`, note: `${n}x a ${rate}% a.m.`,
        amount: Math.round(pmt * 100) / 100, start_month: firstMonth, months: n,
      })
      await reload()
      notify('Parcelamento colocado no plano. Se tinha uma estimativa de juros em Ajustes, pode apagar.')
    } catch (e) {
      notify((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (!card) {
    return (
      <>
        <h1 className="display page-title">Fatura</h1>
        <div className="card"><p className="muted">Cadastre um cartão em <a href="#ajustes">Ajustes</a> para simular a fatura.</p></div>
      </>
    )
  }

  const monthOpts = Array.from({ length: 6 }, (_, i) => addMonths(nc?.billMonth ?? settings.plan_start, i - 1))

  return (
    <>
      <header className="col">
        <h1 className="display page-title">{card.closing_day ? `Dia ${card.closing_day} · ${card.name}` : card.name}</h1>
        <span className="subtitle">{nc ? `Próximo fechamento: ${nc.date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}` : 'Sem dia de fechamento cadastrado'}</span>
      </header>

      {cards.length > 1 && (
        <div className="chips">
          {cards.map((c) => (
            <button key={c.id} type="button" className="chip" aria-pressed={c.id === cardId} onClick={() => { setCardId(c.id); const x = nextClosing(c, today); if (x) setMonth(x.billMonth); reset() }}>{c.name}</button>
          ))}
        </div>
      )}

      <label className="field">
        Fatura de
        <select className="input compact" value={month} onChange={(e) => { setMonth(e.target.value); reset() }}>
          {monthOpts.map((m) => <option key={m} value={m}>{monthLabel(m)} · {brl(bills.find((b) => b.card_id === card.id && b.month === m)?.amount ?? 0)}</option>)}
        </select>
      </label>

      <section className="card" aria-label="Vai dar para pagar?">
        <span style={{ fontSize: 15, fontWeight: 700 }}>Vai dar para pagar?</span>
        <div className="stack" style={{ gap: 8, fontSize: 14 }}>
          {estimate.parts.map((p) => (
            <div className="between" key={p.label}><span className="muted">{p.label}</span><span>{p.value >= 0 ? '+ ' : '− '}{brl(Math.abs(p.value))}</span></div>
          ))}
          {salaryFirst && estimate.recurring > 0 && (
            <div className="between"><span className="muted">Salário de {monthName(month)}</span><span>+ {brl(estimate.recurring)}</span></div>
          )}
          <div className="between" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 8, fontWeight: 700 }}>
            <span>Você terá</span>
            <input className="input compact" style={{ width: 130, textAlign: 'right', fontWeight: 700 }} inputMode="decimal" aria-label="Quanto você terá no dia (editável)" value={haveOverride !== '' ? haveOverride : String(Math.round(have))} onChange={(e) => { setHaveOverride(e.target.value); setEntradaOverride(null) }} />
          </div>
          <div className="between" style={{ fontWeight: 700 }}><span>Fatura {card.name}</span><span>{brl(fatura)}</span></div>
        </div>

        {estimate.recurring > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            <span className="muted" style={{ fontSize: 13 }}>O salário de {monthName(month)} cai antes do vencimento?</span>
            <div className="segmented" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
              <button type="button" aria-pressed={!salaryFirst} onClick={() => { setSalaryFirst(false); reset() }}>Não / não sei</button>
              <button type="button" aria-pressed={salaryFirst} onClick={() => { setSalaryFirst(true); reset() }}>Sim</button>
            </div>
          </div>
        )}

        {gap < 0 ? (
          <div className="card warn" style={{ padding: 14, gap: 4 }}>
            <span className="display mid">Faltam {brl(-gap)}</span>
            <span style={{ fontSize: 13 }}>Dá para cobrir parcelando só essa parte. Simule abaixo.</span>
          </div>
        ) : (
          <div className="card info" style={{ padding: 14, gap: 4 }}>
            <span className="display mid">Dá para pagar tudo</span>
            <span style={{ fontSize: 13 }}>Sobram {brl(gap)}. Confira no Plano se os próximos meses aguentam.</span>
          </div>
        )}
      </section>

      <section className="card" aria-label="Simular parcelamento">
        <span style={{ fontSize: 15, fontWeight: 700 }}>Simular parcelamento</span>
        <div className="between">
          <div className="col" style={{ gap: 2 }}>
            <span className="muted" style={{ fontSize: 13 }}>Entrada (paga agora)</span>
            <span className="display mid">{brl(entrada)}</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="icon-btn" aria-label="Diminuir entrada em 100 reais" onClick={() => setEntradaOverride(Math.max(0, entrada - 100))}>−</button>
            <button type="button" className="icon-btn" aria-label="Aumentar entrada em 100 reais" onClick={() => setEntradaOverride(Math.min(fatura, entrada + 100))}>+</button>
          </div>
        </div>

        <div className="stack" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>Parcelas</span>
          <div className="chips">
            {N_OPTS.map((x) => <button key={x} type="button" className="chip" aria-pressed={n === x} onClick={() => setN(x)}>{x}x</button>)}
          </div>
        </div>

        <label className="field">
          Juros ao mês (%) — use o que o app do banco mostrar
          <input className="input compact" inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>

        <div className="grid2">
          <div className="tile" style={{ background: 'var(--bg)' }}><span className="k muted">Parcelado</span><span className="v" style={{ fontSize: 16 }}>{brl(financed)}</span></div>
          <div className="tile" style={{ background: 'var(--bg)' }}><span className="k muted">Parcela</span><span className="v" style={{ fontSize: 16 }}>{financed > 0 ? `${n}x ${brl(pmt)}` : '—'}</span></div>
          <div className="tile" style={{ background: 'var(--bg)' }}><span className="k muted">Juros no total</span><span className="v" style={{ fontSize: 16, color: 'var(--warn)' }}>{brl(interest)}</span></div>
          <div className="tile" style={{ background: 'var(--bg)' }}><span className="k muted">Nas faturas de</span><span className="v" style={{ fontSize: 16 }}>{financed > 0 ? `${monthName(firstMonth)} a ${monthLabel(lastMonth)}` : '—'}</span></div>
        </div>
        <button type="button" className="btn" disabled={financed <= 0 || busy} onClick={apply}>{busy ? 'Salvando…' : 'Colocar no meu plano'}</button>
        <span className="small muted" style={{ lineHeight: 1.5 }}>Menos parcelas = menos juros. Pagar só o mínimo é a pior opção.</span>
      </section>
    </>
  )
}
