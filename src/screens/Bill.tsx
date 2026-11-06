import { useState } from 'react'
import { nextClosing } from '../lib/cards'
import { monthCashflow } from '../lib/cashflow'
import { insertRow } from '../lib/data'
import { brl, monthLabel, monthName } from '../lib/format'
import { parseMoney } from '../lib/input'
import { addMonths, installment, itemAmountFor, monthStart } from '../lib/plan'
import type { AppData } from '../lib/types'

const N_OPTS = [3, 6, 9, 12, 18, 24]

export function Bill({ data, today, reload, notify }: { data: AppData; today: Date; reload: () => Promise<void>; notify: (m: string) => void }) {
  const { settings, cards, bills, items } = data

  // mês padrão: o da próxima fatura a fechar
  const upcoming = cards
    .map((c) => nextClosing(c, today))
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0]
  const [month, setMonth] = useState<string>(upcoming?.billMonth ?? monthStart(settings.plan_start))
  const [recurringBefore, setRecurringBefore] = useState(false)
  const [pickedCard, setPickedCard] = useState<number | null>(null)
  const [entradaOverride, setEntradaOverride] = useState<number | null>(null)
  const [n, setN] = useState(6)
  const [rate, setRate] = useState('8')
  const [busy, setBusy] = useState(false)

  const flow = monthCashflow(settings, items, cards, bills, month, recurringBefore)
  const recurring = items.filter((i) => i.kind === 'income' && i.months === null && itemAmountFor(i, month) > 0)
  const billSteps = flow.steps.filter((s) => s.kind === 'bill')
  const shortfall = Math.max(0, -flow.final)
  const breaking = billSteps.find((s) => s.balance < 0)

  // cartão a parcelar: o escolhido, senão o primeiro que deixa o saldo negativo, senão o maior
  const defaultCard = breaking?.cardId ?? [...billSteps].sort((a, b) => a.value - b.value)[0]?.cardId ?? null
  const cardId = pickedCard ?? defaultCard
  const card = cards.find((c) => c.id === cardId)
  const fatura = card ? bills.find((b) => b.card_id === card.id && monthStart(b.month) === month)?.amount ?? 0 : 0

  const defaultFinanced = Math.min(fatura, shortfall)
  const entrada = entradaOverride === null ? fatura - defaultFinanced : Math.max(0, Math.min(fatura, entradaOverride))
  const financed = Math.max(0, fatura - entrada)
  const r = Math.max(0, parseMoney(rate)) / 100
  const pmt = installment(financed, r, n)
  const interest = pmt * n - financed
  const firstMonth = addMonths(month, 1)
  const lastMonth = addMonths(month, n)

  const resetSim = () => setEntradaOverride(null)

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

  if (cards.length === 0) {
    return (
      <>
        <h1 className="display page-title">Faturas</h1>
        <div className="card"><p className="muted">Cadastre um cartão em <a href="#ajustes">Ajustes</a> para ver as faturas.</p></div>
      </>
    )
  }

  const monthOpts = Array.from({ length: 7 }, (_, i) => addMonths(upcoming?.billMonth ?? settings.plan_start, i - 1))

  return (
    <>
      <header className="col">
        <h1 className="display page-title">Faturas de {monthName(month)}</h1>
        <span className="subtitle">
          {upcoming ? `Próximo fechamento: ${upcoming.date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}` : 'Vai dar para pagar tudo?'}
        </span>
      </header>

      <label className="field">
        Mês das faturas
        <select className="input compact" value={month} onChange={(e) => { setMonth(e.target.value); setPickedCard(null); resetSim() }}>
          {monthOpts.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </label>

      {recurring.length > 0 && (
        <div className="stack" style={{ gap: 6 }}>
          <span className="muted" style={{ fontSize: 13 }}>{recurring.map((i) => i.name).join(' e ')} de {monthName(month)} cai antes de pagar as faturas?</span>
          <div className="segmented" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <button type="button" aria-pressed={!recurringBefore} onClick={() => { setRecurringBefore(false); resetSim() }}>Não / não sei</button>
            <button type="button" aria-pressed={recurringBefore} onClick={() => { setRecurringBefore(true); resetSim() }}>Sim</button>
          </div>
        </div>
      )}

      <section className="card" aria-label="Seu dinheiro no mês">
        <div className="between">
          <span style={{ fontSize: 15, fontWeight: 700 }}>Seu dinheiro em {monthName(month)}</span>
          <span className="small muted">saldo depois</span>
        </div>
        <div className="stack" style={{ gap: 0 }}>
          <div className="list-item" style={{ padding: '10px 0' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{flow.startLabel}</span>
            <span style={{ fontSize: 14, fontWeight: 700 }}>{brl(flow.start)}</span>
          </div>
          {flow.steps.map((s, i) => {
            const isBill = s.kind === 'bill'
            const neg = s.balance < 0
            return (
              <div className="list-item" key={i} style={{ padding: '10px 0', alignItems: 'flex-start' }}>
                <div className="col" style={{ gap: 2, minWidth: 0 }}>
                  <span style={{ fontSize: 14, fontWeight: isBill ? 700 : 500 }}>{s.label}</span>
                  <span className="small muted">
                    <span style={{ color: s.value >= 0 ? 'var(--accent)' : undefined }}>{s.value >= 0 ? '+' : '−'} {brl(Math.abs(s.value))}</span>
                    {s.detail ? ` · ${s.detail}` : ''}
                  </span>
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: neg ? 'var(--warn)' : 'var(--ink)', whiteSpace: 'nowrap' }}>{brl(s.balance)}</span>
              </div>
            )
          })}
        </div>
        {flow.later.length > 0 && (
          <p className="small muted" style={{ lineHeight: 1.5 }}>
            Depois das faturas entra: {flow.later.map((l) => `${l.label} (+${brl(l.value)})`).join(', ')}.
          </p>
        )}

        {shortfall > 0 ? (
          <div className="card warn" style={{ padding: 14, gap: 4 }}>
            <span className="display mid">Faltam {brl(shortfall)}</span>
            <span style={{ fontSize: 13 }}>
              {breaking ? `O dinheiro acaba na fatura ${cards.find((c) => c.id === breaking.cardId)?.name}. ` : ''}Dá para cobrir parcelando só essa parte. Simule abaixo.
            </span>
          </div>
        ) : (
          <div className="card info" style={{ padding: 14, gap: 4 }}>
            <span className="display mid">Dá para pagar tudo</span>
            <span style={{ fontSize: 13 }}>Sobram {brl(flow.final)} depois de todas as faturas de {monthName(month)}.</span>
          </div>
        )}
      </section>

      {billSteps.length > 0 && (
        <section className="card" aria-label="Simular parcelamento">
          <span style={{ fontSize: 15, fontWeight: 700 }}>Simular parcelamento</span>
          {billSteps.length > 1 && (
            <div className="chips">
              {billSteps.map((s) => {
                const c = cards.find((x) => x.id === s.cardId)!
                return <button key={c.id} type="button" className="chip" aria-pressed={c.id === cardId} onClick={() => { setPickedCard(c.id); resetSim() }}>{c.name}</button>
              })}
            </div>
          )}
          <div className="between small muted"><span>Fatura {card?.name}</span><span style={{ fontWeight: 700, color: 'var(--ink)', fontSize: 14 }}>{brl(fatura)}</span></div>

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
            <div className="tile" style={{ background: 'var(--bg)' }}><span className="k muted">Parcelado</span><span className="v">{brl(financed)}</span></div>
            <div className="tile" style={{ background: 'var(--bg)' }}><span className="k muted">Parcela</span><span className="v">{financed > 0 ? `${n}x ${brl(pmt)}` : '—'}</span></div>
            <div className="tile" style={{ background: 'var(--bg)' }}><span className="k muted">Juros no total</span><span className="v" style={{ color: 'var(--warn)' }}>{brl(interest)}</span></div>
            <div className="tile" style={{ background: 'var(--bg)' }}><span className="k muted">Nas faturas de</span><span className="v">{financed > 0 ? `${monthName(firstMonth)} a ${monthLabel(lastMonth)}` : '—'}</span></div>
          </div>
          <button type="button" className="btn" disabled={financed <= 0 || busy} onClick={apply}>{busy ? 'Salvando…' : 'Colocar no meu plano'}</button>
          <span className="small muted" style={{ lineHeight: 1.5 }}>Menos parcelas = menos juros. Pagar só o mínimo é a pior opção.</span>
        </section>
      )}
    </>
  )
}
