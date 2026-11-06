import { describe, expect, it } from 'vitest'
import { computePlan, installment, itemAmountFor, weekBounds, weekSummary } from './plan'
import { demoSeed } from './seed'
import type { Card, CardBill, Category, Expense, PlanItem, Settings } from './types'

/** Cenário pequeno com contas fáceis de conferir à mão. */
function fixture() {
  const settings: Settings = {
    user_id: 'u',
    display_name: '',
    saved_balance: 1000,
    weekly_limit: 100, // custo de vida = 400/mês
    goal_name: 'Meta',
    goal_amount: 5000,
    plan_start: '2027-01-01',
    plan_months: 6,
  }
  const items: PlanItem[] = [
    { id: 1, kind: 'income', name: 'Salário', note: '', amount: 2000, start_month: '2027-01-01', months: null },
    { id: 2, kind: 'income', name: 'Extra', note: '', amount: 500, start_month: '2027-01-01', months: 1 },
    { id: 3, kind: 'expense', name: 'Parcela', note: '', amount: 100, start_month: '2027-01-01', months: 3 },
  ]
  const cards: Card[] = [
    { id: 1, name: 'A', closing_day: 5, sort: 0 },
    { id: 2, name: 'B', closing_day: 25, sort: 1 },
  ]
  const bills: CardBill[] = [
    { id: 1, card_id: 1, month: '2027-01-01', amount: 1800 },
    { id: 2, card_id: 1, month: '2027-02-01', amount: 2500 },
    { id: 3, card_id: 1, month: '2027-03-01', amount: 600 },
    { id: 4, card_id: 2, month: '2027-01-01', amount: 300 },
    { id: 5, card_id: 2, month: '2027-02-01', amount: 200 },
  ]
  return { settings, items, cards, bills }
}

describe('computePlan', () => {
  const { settings, items, cards, bills } = fixture()
  const plan = computePlan(settings, items, cards, bills)

  it('calcula a sobra e o acumulado mês a mês', () => {
    expect(plan.rows.map((r) => r.net)).toEqual([-100, -1200, 900, 1600, 1600, 1600])
    expect(plan.rows.map((r) => r.balance)).toEqual([900, -300, 600, 2200, 3800, 5400])
  })

  it('encontra o pior ponto, a saída do vermelho e a meta', () => {
    expect(plan.worst).toEqual({ value: -300, month: '2027-02-01' })
    expect(plan.outOfRedMonth).toBe('2027-03-01')
    expect(plan.goalMonth).toBe('2027-06-01')
  })

  it('separa as faturas por cartão', () => {
    expect(plan.rows[1].billsByCard).toEqual({ 1: 2500, 2: 200 })
  })

  it('sem buraco, não há pior ponto', () => {
    const p = computePlan({ ...settings, saved_balance: 10000 }, items, cards, bills)
    expect(p.worst.month).toBeNull()
    expect(p.outOfRedMonth).toBeNull()
  })
})

describe('dados de exemplo', () => {
  it('geram um plano válido a partir de qualquer mês', () => {
    const s = demoSeed('2027-03-01')
    expect(s.settings.plan_start).toBe('2027-03-01')
    expect(Object.keys(s.cards[0].bills)[0]).toBe('2027-03-01')
    expect(s.items.find((i) => i.name === 'Freela')?.start_month).toBe('2027-04-01')
  })
})

describe('itens do plano', () => {
  const base: PlanItem = { id: 1, kind: 'expense', name: 'x', note: '', amount: 100, start_month: '2026-12-01', months: 3 }
  it('respeita início e duração', () => {
    expect(itemAmountFor(base, '2026-11-01')).toBe(0)
    expect(itemAmountFor(base, '2026-12-01')).toBe(100)
    expect(itemAmountFor(base, '2027-02-01')).toBe(100)
    expect(itemAmountFor(base, '2027-03-01')).toBe(0)
  })
  it('months null = sem fim', () => {
    expect(itemAmountFor({ ...base, months: null }, '2030-01-01')).toBe(100)
  })
})

describe('semana', () => {
  it('vai de segunda a domingo', () => {
    expect(weekBounds(new Date(2026, 10, 6))).toEqual({ start: '2026-11-02', end: '2026-11-08' })
    expect(weekBounds(new Date(2026, 10, 8))).toEqual({ start: '2026-11-02', end: '2026-11-08' })
    expect(weekBounds(new Date(2026, 10, 9))).toEqual({ start: '2026-11-09', end: '2026-11-15' })
  })
  it('não conta categoria fora do limite semanal', () => {
    const { settings } = fixture()
    const cats: Category[] = [
      { id: 1, name: 'Comida', weekly_cap: 60, in_weekly_limit: true, sort: 0 },
      { id: 2, name: 'Viagem', weekly_cap: 400, in_weekly_limit: false, sort: 1 },
    ]
    const ex: Expense[] = [
      { id: 1, spent_on: '2026-11-03', description: '', category_id: 1, amount: 18, payment_method: 'Débito', created_at: '' },
      { id: 2, spent_on: '2026-11-04', description: '', category_id: 2, amount: 90, payment_method: 'Débito', created_at: '' },
      { id: 3, spent_on: '2026-11-01', description: '', category_id: 1, amount: 50, payment_method: 'Débito', created_at: '' },
    ]
    const w = weekSummary(settings, cats, ex, new Date(2026, 10, 6))
    expect(w.spent).toBe(18)
    expect(w.left).toBe(82)
  })
})

describe('parcela (tabela Price)', () => {
  it('1.200 em 6x a 8% ≈ 259,58', () => {
    expect(installment(1200, 0.08, 6)).toBeCloseTo(259.58, 2)
  })
  it('sem juros divide igual', () => {
    expect(installment(1200, 0, 6)).toBe(200)
  })
})
