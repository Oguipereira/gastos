import { describe, expect, it } from 'vitest'
import { closingFor, dueFor } from './cards'
import { monthCashflow } from './cashflow'
import type { Card, CardBill, PlanItem, Settings } from './types'

const settings: Settings = {
  user_id: 'u', display_name: '', saved_balance: 1800, weekly_limit: 175,
  goal_name: 'Meta', goal_amount: 0, plan_start: '2026-12-01', plan_months: 6,
}
const items: PlanItem[] = [
  { id: 1, kind: 'income', name: 'Salário', note: '', amount: 2600, start_month: '2026-12-01', months: null },
  { id: 2, kind: 'income', name: 'Extra', note: '', amount: 1300, start_month: '2026-12-01', months: 1 },
  { id: 3, kind: 'expense', name: 'Viagem', note: '', amount: 400, start_month: '2026-12-01', months: 1 },
]
const cards: Card[] = [
  { id: 1, name: 'Fecha dia 2', closing_day: 2, sort: 0 },
  { id: 2, name: 'Fecha dia 25', closing_day: 25, sort: 1 },
]
const bills: CardBill[] = [
  { id: 1, card_id: 1, month: '2026-12-01', amount: 2600 },
  { id: 2, card_id: 2, month: '2026-12-01', amount: 870 },
]

describe('datas da fatura', () => {
  it('cartão que fecha cedo fecha no próprio mês do vencimento', () => {
    expect(closingFor(cards[0], '2026-12-01')).toBe('2026-12-02')
    expect(dueFor(cards[0], '2026-12-01')).toBe('2026-12-12')
  })
  it('cartão que fecha tarde fecha no mês anterior', () => {
    expect(closingFor(cards[1], '2026-12-01')).toBe('2026-11-25')
    expect(dueFor(cards[1], '2026-12-01')).toBe('2026-12-05')
  })
})

describe('monthCashflow', () => {
  it('desconta as faturas na ordem de vencimento e mostra o que falta', () => {
    const f = monthCashflow(settings, items, cards, bills, '2026-12-01', false)
    expect(f.start).toBe(1800)
    expect(f.steps.map((s) => [s.label, s.balance])).toEqual([
      ['Extra', 3100],
      ['Viagem', 2700],
      ['Reserva pra viver', 2350],
      ['Fatura Fecha dia 25', 1480],
      ['Fatura Fecha dia 2', -1120],
    ])
    expect(f.later).toEqual([{ label: 'Salário', value: 2600 }])
    expect(f.final).toBe(-1120)
  })
  it('com o salário antes, ele entra no começo', () => {
    const f = monthCashflow(settings, items, cards, bills, '2026-12-01', true)
    expect(f.steps[0].label).toBe('Salário')
    expect(f.final).toBe(1480)
    expect(f.later).toEqual([])
  })
})
