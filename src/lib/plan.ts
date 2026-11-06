import type { Card, CardBill, Category, Expense, PlanItem, Settings } from './types'

// ---------- datas ----------

/** Data local em YYYY-MM-DD (sem fuso UTC). */
export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d || 1)
}

export function monthStart(iso: string): string {
  return iso.slice(0, 7) + '-01'
}

export function addMonths(iso: string, n: number): string {
  const d = parseIso(monthStart(iso))
  d.setMonth(d.getMonth() + n)
  return isoDate(d)
}

/** Diferença em meses entre dois inícios de mês (b - a). */
export function monthDiff(a: string, b: string): number {
  const [ya, ma] = a.split('-').map(Number)
  const [yb, mb] = b.split('-').map(Number)
  return (yb - ya) * 12 + (mb - ma)
}

/** Semana de segunda a domingo que contém a data. */
export function weekBounds(d: Date): { start: string; end: string } {
  const day = (d.getDay() + 6) % 7 // segunda = 0
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
  return { start: isoDate(start), end: isoDate(end) }
}

// ---------- plano mês a mês ----------

/** Valor de um item num mês (0 se não cai naquele mês). */
export function itemAmountFor(item: PlanItem, month: string): number {
  const k = monthDiff(monthStart(item.start_month), month)
  if (k < 0) return 0
  if (item.months !== null && k >= item.months) return 0
  return Number(item.amount)
}

/** Custo de vida mensal estimado a partir do limite semanal (4 semanas). */
export function livingPerMonth(settings: Settings): number {
  return Number(settings.weekly_limit) * 4
}

export type PlanRow = {
  month: string
  income: number
  bills: number
  billsByCard: Record<number, number>
  itemExpenses: number
  living: number
  net: number
  balance: number
}

export type PlanResult = {
  rows: PlanRow[]
  worst: { value: number; month: string | null }
  outOfRedMonth: string | null // primeiro mês com saldo >= 0 depois do pior ponto negativo
  goalMonth: string | null
}

export function computePlan(
  settings: Settings,
  items: PlanItem[],
  cards: Card[],
  bills: CardBill[],
): PlanResult {
  const start = monthStart(settings.plan_start)
  const living = livingPerMonth(settings)
  const rows: PlanRow[] = []
  let balance = Number(settings.saved_balance)

  for (let i = 0; i < settings.plan_months; i++) {
    const month = addMonths(start, i)
    let income = 0
    let itemExpenses = 0
    for (const it of items) {
      const v = itemAmountFor(it, month)
      if (it.kind === 'income') income += v
      else itemExpenses += v
    }
    const billsByCard: Record<number, number> = {}
    let billTotal = 0
    for (const c of cards) {
      const b = bills.find((x) => x.card_id === c.id && monthStart(x.month) === month)
      const v = b ? Number(b.amount) : 0
      billsByCard[c.id] = v
      billTotal += v
    }
    const net = income - billTotal - itemExpenses - living
    balance += net
    rows.push({ month, income, bills: billTotal, billsByCard, itemExpenses, living, net, balance })
  }

  let worst = { value: 0, month: null as string | null }
  rows.forEach((r) => {
    if (r.balance < worst.value) worst = { value: r.balance, month: r.month }
  })

  let outOfRedMonth: string | null = null
  if (worst.month) {
    const wi = rows.findIndex((r) => r.month === worst.month)
    const hit = rows.slice(wi + 1).find((r) => r.balance >= 0)
    outOfRedMonth = hit ? hit.month : null
  }

  const goal = Number(settings.goal_amount)
  const goalRow = goal > 0 ? rows.find((r) => r.balance >= goal) : undefined

  return { rows, worst, outOfRedMonth, goalMonth: goalRow ? goalRow.month : null }
}

// ---------- semana ----------

export type WeekSummary = {
  start: string
  end: string
  limit: number
  spent: number
  left: number
  byCategory: { category: Category; spent: number }[]
}

export function weekSummary(
  settings: Settings,
  categories: Category[],
  expenses: Expense[],
  today: Date,
): WeekSummary {
  const { start, end } = weekBounds(today)
  const inWeek = expenses.filter((e) => e.spent_on >= start && e.spent_on <= end)
  const counted = new Set(categories.filter((c) => c.in_weekly_limit).map((c) => c.id))
  let spent = 0
  for (const e of inWeek) {
    // gasto sem categoria conta no limite; categoria fora do limite (ex.: viagem) não
    if (e.category_id === null || counted.has(e.category_id)) spent += Number(e.amount)
  }
  const byCategory = categories
    .filter((c) => c.in_weekly_limit)
    .map((c) => ({
      category: c,
      spent: inWeek.filter((e) => e.category_id === c.id).reduce((s, e) => s + Number(e.amount), 0),
    }))
  const limit = Number(settings.weekly_limit)
  return { start, end, limit, spent, left: limit - spent, byCategory }
}

/** Total gasto numa categoria fora do limite semanal (ex.: viagem). */
export function categoryTotal(categoryId: number, expenses: Expense[]): number {
  return expenses.filter((e) => e.category_id === categoryId).reduce((s, e) => s + Number(e.amount), 0)
}

// ---------- parcelamento ----------

/** Parcela fixa (Price). rate em fração ao mês (0.08 = 8%). */
export function installment(principal: number, rate: number, n: number): number {
  if (principal <= 0 || n <= 0) return 0
  if (rate === 0) return principal / n
  return (principal * rate) / (1 - Math.pow(1 + rate, -n))
}
