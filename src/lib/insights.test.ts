import { describe, expect, it } from 'vitest'
import { buildInsights } from './insights'
import type { Card, CardBill, PlanItem, Settings } from './types'

const settings: Settings = {
  user_id: 'u', display_name: '', saved_balance: 1000, weekly_limit: 100,
  goal_name: 'Meta', goal_amount: 5000, plan_start: '2027-01-01', plan_months: 6,
}
const items: PlanItem[] = [
  { id: 1, kind: 'income', name: 'Salário', note: '', amount: 2000, start_month: '2027-01-01', months: null },
  { id: 2, kind: 'income', name: 'Extra', note: '', amount: 500, start_month: '2027-01-01', months: 1 },
  { id: 3, kind: 'expense', name: 'Viagem', note: '', amount: 300, start_month: '2027-01-01', months: 1 },
]
const cards: Card[] = [{ id: 1, name: 'A', closing_day: 5, sort: 0 }]
const bills: CardBill[] = [
  { id: 1, card_id: 1, month: '2027-01-01', amount: 1800 },
  { id: 2, card_id: 1, month: '2027-02-01', amount: 2500 },
  { id: 3, card_id: 1, month: '2027-03-01', amount: 600 },
]

describe('buildInsights', () => {
  const ins = buildInsights({ settings, items, cards, bills })

  it('classifica como aperto temporário', () => {
    expect(ins.status).toBe('temporary')
    expect(ins.plan.worst.month).toBe('2027-02-01')
  })

  it('explica o acúmulo: último mês no negativo e primeiro com sobra', () => {
    expect(ins.lastDeficitMonth).toBe('2027-02-01')
    expect(ins.firstSurplusMonth).toBe('2027-03-01')
    expect(ins.heaviest?.month).toBe('2027-02-01')
    expect(ins.cushion).toBe(1500)
  })

  it('calcula o efeito de cada estratégia', () => {
    const weekly = ins.strategies.find((s) => s.id === 'weekly')!
    // R$ 100/mês a menos em 2 meses de aperto = pior ponto R$ 200 melhor
    expect(weekly.worstAfter - weekly.worstBefore).toBe(200)
    const cut = ins.strategies.find((s) => s.id === 'cut-3')!
    expect(cut.worstAfter - cut.worstBefore).toBe(150)
    const extra = ins.strategies.find((s) => s.id === 'extra')!
    expect(extra.worstAfter - extra.worstBefore).toBe(500)
  })

  it('diz quanto precisa financiar', () => {
    expect(ins.needToFinance).toBe(-ins.plan.worst.value)
    expect(ins.financeExample[0].n).toBe(6)
  })

  it('sem buraco, não sugere estratégias', () => {
    const ok = buildInsights({ settings: { ...settings, saved_balance: 20000 }, items, cards, bills })
    expect(ok.status).toBe('ok')
    expect(ok.strategies).toEqual([])
  })
})
