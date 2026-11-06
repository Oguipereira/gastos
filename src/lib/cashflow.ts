import { closingFor, dueFor } from './cards'
import { computePlan, addMonths, itemAmountFor, monthStart } from './plan'
import type { Card, CardBill, PlanItem, Settings } from './types'

export type CashStep = {
  label: string
  detail: string
  value: number
  balance: number
  kind: 'income' | 'expense' | 'living' | 'bill'
  cardId?: number
}

export type MonthCashflow = {
  startLabel: string
  start: number
  steps: CashStep[]
  /** Entradas fixas (ex.: salário) que só chegam depois das faturas. */
  later: { label: string; value: number }[]
  final: number
}

/**
 * Fluxo de caixa de um mês, na ordem em que o dinheiro entra e sai:
 * saldo de partida → entradas → gastos do mês → reserva pra viver → faturas por data de vencimento.
 * `recurringBefore` diz se as entradas fixas (salário) caem antes das faturas.
 */
export function monthCashflow(
  settings: Settings,
  items: PlanItem[],
  cards: Card[],
  bills: CardBill[],
  month: string,
  recurringBefore: boolean,
): MonthCashflow {
  const m = monthStart(month)
  const start = monthStart(settings.plan_start)
  let startValue = Number(settings.saved_balance)
  let startLabel = 'Na conta hoje'
  if (m > start) {
    const plan = computePlan(settings, items, cards, bills)
    const prev = plan.rows.find((r) => r.month === addMonths(m, -1))
    if (prev) {
      startValue = prev.balance
      startLabel = 'Saldo previsto do mês anterior'
    }
  }

  const steps: CashStep[] = []
  const later: MonthCashflow['later'] = []
  let bal = startValue
  const push = (s: Omit<CashStep, 'balance'>) => {
    bal += s.value
    steps.push({ ...s, balance: bal })
  }

  for (const it of items.filter((i) => i.kind === 'income')) {
    const v = itemAmountFor(it, m)
    if (!v) continue
    if (it.months === null && !recurringBefore) later.push({ label: it.name, value: v })
    else push({ label: it.name, detail: it.note, value: v, kind: 'income' })
  }
  for (const it of items.filter((i) => i.kind === 'expense')) {
    const v = itemAmountFor(it, m)
    if (v) push({ label: it.name, detail: it.note, value: -v, kind: 'expense' })
  }
  push({ label: 'Reserva pra viver', detail: '2 semanas do limite', value: -Number(settings.weekly_limit) * 2, kind: 'living' })

  const monthBills = cards
    .map((c) => ({ c, amount: bills.find((b) => b.card_id === c.id && monthStart(b.month) === m)?.amount ?? 0, due: dueFor(c, m) }))
    .filter((x) => x.amount > 0)
    .sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'))
  for (const { c, amount, due } of monthBills) {
    const closing = closingFor(c, m)
    push({
      label: `Fatura ${c.name}`,
      detail: closing && due ? `fecha ${fmtDay(closing)} · vence ~${fmtDay(due)}` : '',
      value: -amount,
      kind: 'bill',
      cardId: c.id,
    })
  }

  return { startLabel, start: startValue, steps, later, final: bal }
}

function fmtDay(iso: string) {
  const [, mm, dd] = iso.split('-').map(Number)
  return `${dd}/${mm}`
}
