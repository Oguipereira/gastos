import { brl, monthLabel, monthName } from '../lib/format'
import { buildInsights, type Strategy } from '../lib/insights'
import type { AppData } from '../lib/types'

function Delta({ s }: { s: Strategy }) {
  const gain = s.worstAfter - s.worstBefore
  const redChanged = s.outOfRedAfter !== s.outOfRedBefore
  return (
    <div className="chips" style={{ gap: 6 }}>
      <span className="chip-date" style={{ background: 'var(--accent-soft)' }}>
        Pior ponto {brl(s.worstBefore)} → {brl(s.worstAfter)} ({brl(gain, { sign: true })})
      </span>
      {redChanged && s.outOfRedAfter && (
        <span className="chip-date">Sai do vermelho em {monthLabel(s.outOfRedAfter)}{s.outOfRedBefore ? ` (antes ${monthLabel(s.outOfRedBefore)})` : ''}</span>
      )}
      {s.goalAfter !== s.goalBefore && s.goalAfter && <span className="chip-date">Meta em {monthLabel(s.goalAfter)}</span>}
    </div>
  )
}

export function Explain({ data }: { data: AppData }) {
  const { settings } = data
  const ins = buildInsights(data)
  const { plan } = ins
  const goal = settings.goal_amount
  const deficits = ins.flows.filter((f) => f.diff < 0)
  const avgOut = deficits.length ? deficits.reduce((s, f) => s + f.out, 0) / deficits.length : 0
  const avgIn = deficits.length ? deficits.reduce((s, f) => s + f.income, 0) / deficits.length : 0
  const worstName = plan.worst.month ? monthName(plan.worst.month) : ''

  return (
    <>
      <header className="col">
        <h1 className="display page-title">Entenda seu plano</h1>
        <span className="subtitle">O que os números querem dizer, em português claro.</span>
      </header>

      {ins.status === 'temporary' && (
        <section className="card hero" aria-label="Resumo">
          <span className="display" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.2 }}>Calma: o aperto tem data para acabar.</span>
          <p style={{ fontSize: 15, lineHeight: 1.55, opacity: 0.95 }}>
            O pior momento é <strong>{monthLabel(plan.worst.month!)}</strong>, com {brl(plan.worst.value)} no aperto.
            {ins.firstSurplusMonth && <> A partir de <strong>{monthLabel(ins.firstSurplusMonth)}</strong> o seu salário passa a cobrir tudo, e o buraco começa a fechar.</>}
            {' '}Você sai do vermelho em <strong>{monthLabel(plan.outOfRedMonth!)}</strong>
            {goal > 0 && plan.goalMonth && <> e, mantendo o plano, chega em {settings.goal_name.toLowerCase()} ({brl(goal)}) em <strong>{monthLabel(plan.goalMonth)}</strong></>}.
          </p>
        </section>
      )}
      {ins.status === 'not_closing' && (
        <section className="card warn" aria-label="Resumo">
          <span className="display" style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.2 }}>Do jeito que está, o plano ainda não fecha.</span>
          <p style={{ fontSize: 15, lineHeight: 1.55 }}>
            Até {monthLabel(plan.rows[plan.rows.length - 1].month)} o saldo no aperto continua negativo. Não é motivo para pânico: é sinal de que alguma coisa precisa mudar. As estratégias abaixo mostram o efeito de cada mudança.
          </p>
        </section>
      )}
      {ins.status === 'ok' && (
        <section className="card info" aria-label="Resumo">
          <span className="display" style={{ fontSize: 22, fontWeight: 700 }}>Seu plano está saudável.</span>
          <p style={{ fontSize: 15, lineHeight: 1.55 }}>
            Em nenhum mês o dinheiro acaba antes do salário.{goal > 0 && plan.goalMonth ? ` Você chega em ${settings.goal_name.toLowerCase()} em ${monthLabel(plan.goalMonth)}.` : ''}
          </p>
        </section>
      )}

      {ins.status !== 'ok' && (
        <>
          <h2 className="section-title">O que está acontecendo</h2>
          <section className="card">
            <p style={{ fontSize: 15, lineHeight: 1.6 }}>
              Você começa com <strong>{brl(ins.cushion)}</strong> (o que tem guardado mais as entradas extras do primeiro mês). Esse colchão segura o começo.
              {deficits.length > 0 && (
                <> Mas em {deficits.length === 1 ? monthName(deficits[0].month) : `${deficits.map((f) => monthName(f.month)).slice(0, -1).join(', ')} e ${monthName(deficits[deficits.length - 1].month)}`} sai mais do que entra: em média <strong>{brl(avgOut)}</strong> saindo para <strong>{brl(avgIn)}</strong> entrando.</>
              )}
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.6 }}>
              O que falta num mês passa para o seguinte. É como um balde furado: enquanto sai mais água do que entra, ele vai esvaziando, mesmo que o furo não aumente.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr className="muted" style={{ textAlign: 'right' }}>
                    <th style={{ textAlign: 'left', fontWeight: 500, padding: '6px 0' }}>Mês</th>
                    <th style={{ fontWeight: 500 }}>Sai</th>
                    <th style={{ fontWeight: 500 }}>Entra</th>
                    <th style={{ fontWeight: 500 }}>No aperto</th>
                  </tr>
                </thead>
                <tbody>
                  {ins.flows.map((f) => (
                    <tr key={f.month} style={{ borderTop: '1px solid var(--line-soft)', textAlign: 'right' }}>
                      <td style={{ textAlign: 'left', padding: '8px 0', fontWeight: 600 }}>{monthLabel(f.month)}</td>
                      <td>{brl(f.out)}</td>
                      <td>{brl(f.income)}</td>
                      <td style={{ fontWeight: 700, color: f.low < 0 ? 'var(--warn)' : 'var(--accent)' }}>{brl(f.low)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="small muted" style={{ lineHeight: 1.5 }}>
              "No aperto" é quanto sobra (ou falta) depois de pagar as faturas e os gastos do mês, antes de o salário cair no fim do mês.
            </p>
          </section>

          {plan.worst.month && (
            <>
              <h2 className="section-title">Por que {worstName} é o pior mês?</h2>
              <section className="card">
                <p style={{ fontSize: 15, lineHeight: 1.6 }}>
                  {ins.heaviest && ins.heaviest.month !== plan.worst.month
                    ? <>Não é o mês com mais contas: o mais pesado é {monthName(ins.heaviest.month)} ({brl(ins.heaviest.out)}). </>
                    : <>Não é que {worstName} tenha uma conta nova enorme. </>}
                  {worstName.charAt(0).toUpperCase() + worstName.slice(1)} é o pior porque é o <strong>último mês em que sai mais do que entra</strong>, então ele carrega tudo que faltou nos meses anteriores.
                  {ins.firstSurplusMonth && ins.firstSurplusOut !== null && (
                    <> Em {monthName(ins.firstSurplusMonth)} as saídas caem para {brl(ins.firstSurplusOut)} e o salário volta a cobrir o mês. Daí em diante o buraco só diminui.</>
                  )}
                </p>
              </section>
            </>
          )}

          <h2 className="section-title">Estratégias</h2>
          <section className="card">
            <span style={{ fontSize: 16, fontWeight: 700 }}>Parcelar para atravessar o aperto</span>
            <p style={{ fontSize: 14, lineHeight: 1.6 }}>
              Somando tudo, você precisa cobrir uns <strong>{brl(ins.needToFinance)}</strong> até {worstName}. O jeito mais barato costuma ser parcelar a fatura no próprio app do cartão, com poucas parcelas, assim que ela fechar. Cada estratégia abaixo diminui esse valor, e com ele os juros.
            </p>
            <div className="grid2">
              {ins.financeExample.map((f) => (
                <div className="tile" key={f.n} style={{ background: 'var(--bg)' }}>
                  <span className="k muted">{f.n}x a {Math.round(f.rate * 100)}% ao mês</span>
                  <span className="v">{f.n}x {brl(f.pmt)}</span>
                  <span className="k" style={{ color: 'var(--warn)' }}>{brl(f.interest)} de juros</span>
                </div>
              ))}
            </div>
            <p className="small muted" style={{ lineHeight: 1.5 }}>8% é só um exemplo; use os juros que o app do banco mostrar. As parcelas entram nos meses seguintes, então o plano precisa ser recalculado: use a aba <a href="#fatura">Fatura</a> e toque em "Colocar no meu plano".</p>
          </section>
          {ins.strategies.map((s) => (
            <section className="card" key={s.id}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>{s.title}</span>
              <p style={{ fontSize: 14, lineHeight: 1.6 }}>{s.how}</p>
              <Delta s={s} />
            </section>
          ))}
        </>
      )}

      <h2 className="section-title">Regras que protegem você</h2>
      <section className="card tight">
        {[
          ['Nunca pague só o mínimo', 'O resto vai para o rotativo, o juro mais caro do Brasil. Parcelar a fatura sai bem mais barato.'],
          ['Fuja do cheque especial', 'O "limite" da conta também cobra juros altíssimos. Ele não é seu dinheiro.'],
          ['Nada novo no crédito até sair do vermelho', 'Cada compra nova empurra o fim do aperto para frente.'],
          ['Registre todo gasto na hora', 'Leva 10 segundos e é o que faz o limite da semana funcionar.'],
        ].map(([t, d]) => (
          <div className="list-item" key={t} style={{ alignItems: 'flex-start' }}>
            <div className="col" style={{ gap: 2 }}>
              <span className="title" style={{ fontWeight: 600 }}>{t}</span>
              <span className="small muted" style={{ lineHeight: 1.5 }}>{d}</span>
            </div>
          </div>
        ))}
      </section>

      <h2 className="section-title">Glossário</h2>
      <section className="card tight">
        {[
          ['No aperto', 'Quanto sobra depois de pagar as faturas e os gastos do mês, antes de o salário cair.'],
          ['Fim do mês', 'O saldo já com o salário. Esse dinheiro vai pagar as faturas do mês seguinte.'],
          ['Pior ponto', 'O mês em que o saldo no aperto fica mais negativo. É o quanto você precisa cobrir.'],
          ['Sair do vermelho', 'O primeiro mês, depois do pior ponto, em que nem no aperto o saldo fica negativo.'],
        ].map(([t, d]) => (
          <div className="list-item" key={t} style={{ alignItems: 'flex-start' }}>
            <div className="col" style={{ gap: 2 }}>
              <span className="title" style={{ fontWeight: 600 }}>{t}</span>
              <span className="small muted" style={{ lineHeight: 1.5 }}>{d}</span>
            </div>
          </div>
        ))}
      </section>
    </>
  )
}
