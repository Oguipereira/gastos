import { brl, monthLabel, monthName } from '../lib/format'
import { computePlan, itemAmountFor } from '../lib/plan'
import type { AppData } from '../lib/types'

export function Plan({ data }: { data: AppData }) {
  const { settings, items, cards, bills } = data
  const plan = computePlan(settings, items, cards, bills)
  const goal = settings.goal_amount
  const balances = plan.rows.map((r) => r.low)
  const max = Math.max(0, goal, ...balances)
  const min = Math.min(0, ...balances)
  const H = 200
  const k = max - min > 0 ? H / (max - min) : 0
  const posH = Math.round(max * k)
  const negH = H - posH

  const desc = plan.worst.month
    ? `Saldo no aperto, antes do salário: pior ponto ${brl(plan.worst.value)} em ${monthLabel(plan.worst.month)}${plan.outOfRedMonth ? `, volta ao positivo em ${monthLabel(plan.outOfRedMonth)}` : ''}${plan.goalMonth ? `, meta em ${monthLabel(plan.goalMonth)}` : ''}.`
    : `Saldo no aperto sempre positivo${plan.goalMonth ? `, meta em ${monthLabel(plan.goalMonth)}` : ''}.`

  return (
    <>
      <header className="col">
        <h1 className="display page-title">Plano</h1>
        <span className="subtitle">Quanto sobra ou falta, mês a mês{goal > 0 ? ', até a meta' : ''}</span>
      </header>
      <a href="#entenda" className="notice" style={{ textDecoration: 'none', display: 'block' }}>Não entendeu algum número? Veja a explicação e as estratégias na aba <strong>Entenda</strong> →</a>

      <div className="grid3">
        <div className="tile" style={{ background: plan.worst.month ? 'var(--warn-soft)' : 'var(--card)', color: plan.worst.month ? 'var(--warn-ink)' : undefined }}>
          <span className="k">Pior ponto</span>
          <span className="v">{plan.worst.month ? brl(plan.worst.value) : 'nenhum'}</span>
          <span className="k">{plan.worst.month ? monthLabel(plan.worst.month) : 'sempre positivo'}</span>
        </div>
        <div className="tile">
          <span className="k muted">Sai do vermelho</span>
          <span className="v">{plan.worst.month ? (plan.outOfRedMonth ? monthLabel(plan.outOfRedMonth) : 'depois') : '—'}</span>
          <span className="k muted">{plan.outOfRedMonth ? `${brl(plan.rows.find((r) => r.month === plan.outOfRedMonth)!.low, { sign: true })} no aperto` : ' '}</span>
        </div>
        <div className="tile" style={{ background: 'var(--accent-soft)', color: 'var(--accent-ink)' }}>
          <span className="k">{goal > 0 ? `Meta ${brl(goal)}` : 'Sem meta'}</span>
          <span className="v">{goal > 0 ? (plan.goalMonth ? monthLabel(plan.goalMonth) : 'depois') : '—'}</span>
          <span className="k">{settings.goal_name}</span>
        </div>
      </div>

      <section className="card" aria-label="Gráfico do saldo acumulado" style={{ padding: '16px 14px 12px', gap: 10 }}>
        <div className="between" style={{ fontSize: 13 }}>
          <span style={{ fontWeight: 600 }}>Saldo no aperto</span>
          {goal > 0 && <span className="muted">linha = meta</span>}
        </div>
        <div className="chart" role="img" aria-label={desc} style={{ height: H + 1 }}>
          {goal > 0 && <div className="goal" style={{ top: posH - Math.round(goal * k) }} />}
          <div className="area pos" style={{ height: posH }}>
            {plan.rows.map((r) => <span key={r.month} style={{ height: r.low > 0 ? Math.max(2, r.low * k) : 0 }} />)}
          </div>
          <div className="zero" />
          <div className="area neg" style={{ height: negH }}>
            {plan.rows.map((r) => <span key={r.month} style={{ height: r.low < 0 ? Math.max(2, -r.low * k) : 0 }} />)}
          </div>
        </div>
        <div className="chart-labels" aria-hidden="true">
          {plan.rows.map((r) => <span key={r.month}>{monthName(r.month).charAt(0).toUpperCase()}</span>)}
        </div>
      </section>

      <p className="small muted" style={{ lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--ink)' }}>No aperto</strong> = depois de pagar as faturas e os gastos do mês, antes de o salário cair (ele entra no fim do mês).
        <strong style={{ color: 'var(--ink)' }}> Fim do mês</strong> = já com o salário. Começa com {brl(settings.saved_balance)} guardados; custo de vida = {brl(settings.weekly_limit)}/semana × 4 = {brl(settings.weekly_limit * 4)}/mês.
        Toque num mês para ver o detalhe. Tudo muda em <a href="#ajustes">Ajustes</a>.
      </p>

      <section className="card tight" aria-label="Mês a mês">
        <div className="grid3 small muted" style={{ minHeight: 36, alignItems: 'center', borderBottom: '1px solid var(--line-soft)' }}>
          <span>Mês</span>
          <span className="right">No aperto</span>
          <span className="right">Fim do mês</span>
        </div>
        {plan.rows.map((r, idx) => (
          <details className="month" key={r.month}>
            <summary>
              <span style={{ fontWeight: 600 }}>{monthLabel(r.month)}</span>
              <span className={'right ' + (r.low < 0 ? 'neg-text' : 'pos-text')} style={{ fontWeight: 600 }}>{brl(r.low, { sign: true })}</span>
              <span className={'right ' + (r.balance < 0 ? 'neg-text' : '')}>{brl(r.balance, { sign: true })}</span>
            </summary>
            <div className="detail">
              <div className="between"><span>{idx === 0 ? 'Guardado' : 'Fim do mês anterior'}</span><span>{brl(idx === 0 ? settings.saved_balance : plan.rows[idx - 1].balance, { sign: true })}</span></div>
              {items.filter((i) => i.kind === 'income' && i.months !== null && itemAmountFor(i, r.month) > 0).map((i) => (
                <div className="between" key={i.id}><span>{i.name}</span><span>+{brl(i.amount)}</span></div>
              ))}
              {cards.filter((c) => r.billsByCard[c.id] > 0).map((c) => (
                <div className="between" key={c.id}><span>Fatura {c.name}</span><span>−{brl(r.billsByCard[c.id])}</span></div>
              ))}
              {items.filter((i) => i.kind === 'expense' && itemAmountFor(i, r.month) > 0).map((i) => (
                <div className="between" key={i.id}><span>{i.name}</span><span>−{brl(i.amount)}</span></div>
              ))}
              <div className="between"><span>Custo de vida</span><span>−{brl(r.living)}</span></div>
              <div className="between" style={{ color: 'var(--ink)', fontWeight: 600 }}><span>No aperto</span><span>{brl(r.low, { sign: true })}</span></div>
              {items.filter((i) => i.kind === 'income' && i.months === null && itemAmountFor(i, r.month) > 0).map((i) => (
                <div className="between" key={i.id}><span>{i.name} (fim do mês)</span><span>+{brl(i.amount)}</span></div>
              ))}
              <div className="between" style={{ color: 'var(--ink)', fontWeight: 600 }}><span>Fim do mês</span><span>{brl(r.balance, { sign: true })}</span></div>
            </div>
          </details>
        ))}
      </section>
    </>
  )
}
