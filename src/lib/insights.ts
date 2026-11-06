import { computePlan, installment, itemAmountFor, type PlanResult } from './plan'
import type { Card, CardBill, PlanItem, Settings } from './types'

type Inputs = { settings: Settings; items: PlanItem[]; cards: Card[]; bills: CardBill[] }

export type MonthFlow = {
  month: string
  out: number // faturas + compromissos + custo de vida
  income: number // tudo que entra no mês (inclusive salário do fim do mês)
  diff: number
  low: number
}

export type Strategy = {
  id: string
  title: string
  how: string
  worstBefore: number
  worstAfter: number
  outOfRedBefore: string | null
  outOfRedAfter: string | null
  goalBefore: string | null
  goalAfter: string | null
}

export type Insights = {
  status: 'ok' | 'temporary' | 'not_closing'
  plan: PlanResult
  /** Meses do começo do plano até sair do vermelho (ou até o pior ponto, se não sair). */
  flows: MonthFlow[]
  /** Último mês em que saiu mais do que entrou antes de o buraco começar a fechar. */
  lastDeficitMonth: string | null
  /** Primeiro mês em que entra mais do que sai, depois do pior ponto. */
  firstSurplusMonth: string | null
  /** Quanto sai no primeiro mês com sobra (para explicar por que o buraco começa a fechar). */
  firstSurplusOut: number | null
  heaviest: MonthFlow | null
  /** Reserva inicial (guardado + entradas únicas do primeiro mês) que amortece o começo. */
  cushion: number
  strategies: Strategy[]
  /** Quanto precisa ser financiado (parcelado) para atravessar o pior ponto. */
  needToFinance: number
  financeExample: { n: number; rate: number; pmt: number; interest: number }[]
}

function withPlan(i: Inputs) {
  return computePlan(i.settings, i.items, i.cards, i.bills)
}

function strategy(base: PlanResult, id: string, title: string, how: string, alt: Inputs): Strategy {
  const p = withPlan(alt)
  return {
    id, title, how,
    worstBefore: base.worst.value, worstAfter: p.worst.value,
    outOfRedBefore: base.outOfRedMonth, outOfRedAfter: p.outOfRedMonth,
    goalBefore: base.goalMonth, goalAfter: p.goalMonth,
  }
}

export function buildInsights(input: Inputs): Insights {
  const plan = withPlan(input)
  const { settings, items } = input

  const flowsAll: MonthFlow[] = plan.rows.map((r) => ({
    month: r.month,
    out: r.bills + r.itemExpenses + r.living,
    income: r.income,
    diff: r.income - (r.bills + r.itemExpenses + r.living),
    low: r.low,
  }))

  const status: Insights['status'] = !plan.worst.month ? 'ok' : plan.outOfRedMonth ? 'temporary' : 'not_closing'

  const endIdx = plan.outOfRedMonth
    ? plan.rows.findIndex((r) => r.month === plan.outOfRedMonth)
    : plan.rows.findIndex((r) => r.month === plan.worst.month)
  const flows = status === 'ok' ? flowsAll.slice(0, Math.min(4, flowsAll.length)) : flowsAll.slice(0, Math.max(1, endIdx + 1))

  const worstIdx = plan.worst.month ? plan.rows.findIndex((r) => r.month === plan.worst.month) : -1
  const firstSurplus = worstIdx >= 0 ? flowsAll.slice(worstIdx + 1).find((f) => f.diff > 0) : undefined
  const lastDeficit = worstIdx >= 0 ? [...flowsAll.slice(0, worstIdx + 1)].reverse().find((f) => f.diff < 0) : undefined
  const crunch = worstIdx >= 0 ? flowsAll.slice(0, worstIdx + 1) : []
  const heaviest = crunch.length ? crunch.reduce((a, b) => (b.out > a.out ? b : a)) : null

  const first = settings.plan_start
  const cushion =
    Number(settings.saved_balance) +
    items.filter((i) => i.kind === 'income' && i.months !== null).reduce((s, i) => s + itemAmountFor(i, first), 0)

  // ---- estratégias, cada uma recalculando o plano ----
  const strategies: Strategy[] = []
  if (status !== 'ok') {
    const weekly = Number(settings.weekly_limit)
    if (weekly >= 50) {
      strategies.push(
        strategy(plan, 'weekly', 'Gastar R$ 25 a menos por semana',
          `Baixar o limite de R$ ${weekly} para R$ ${weekly - 25} por semana (R$ 100 a menos por mês): marmita, ônibus no lugar de um Uber, um programa mais barato.`,
          { ...input, settings: { ...settings, weekly_limit: weekly - 25 } }),
      )
    }
    const crunchMonths = new Set(crunch.map((f) => f.month))
    const oneOffs = items
      .filter((i) => i.kind === 'expense' && i.months === 1 && crunchMonths.has(i.start_month.slice(0, 10)))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 2)
    for (const it of oneOffs) {
      const half = Math.round(it.amount / 2)
      strategies.push(
        strategy(plan, `cut-${it.id}`, `Gastar metade em "${it.name}"`,
          `Levar R$ ${half} em vez de R$ ${Math.round(it.amount)}. Cada real a menos aqui é um real a menos no buraco.`,
          { ...input, items: input.items.map((x) => (x.id === it.id ? { ...x, amount: it.amount - half } : x)) }),
      )
    }
    const firstNeg = plan.rows.find((r) => r.low < 0)
    if (firstNeg) {
      strategies.push(
        strategy(plan, 'extra', 'Conseguir R$ 500 de renda extra',
          'Um freela, vender algo parado, horas extras. Quanto antes entrar, mais alivia (aqui considerei no primeiro mês apertado).',
          { ...input, items: [...input.items, { id: -1, kind: 'income', name: 'extra', note: '', amount: 500, start_month: firstNeg.month, months: 1 }] }),
      )
    }
  }

  const needToFinance = Math.max(0, -plan.worst.value)
  const financeExample = [6, 12].map((n) => {
    const rate = 0.08
    const pmt = installment(needToFinance, rate, n)
    return { n, rate, pmt, interest: pmt * n - needToFinance }
  })

  return {
    status, plan, flows,
    lastDeficitMonth: lastDeficit?.month ?? null,
    firstSurplusMonth: firstSurplus?.month ?? null,
    firstSurplusOut: firstSurplus?.out ?? null,
    heaviest, cushion, strategies, needToFinance, financeExample,
  }
}

