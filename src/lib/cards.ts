import { isoDate, monthStart } from './plan'
import type { Card } from './types'

/** Próximo fechamento de um cartão e o mês da fatura correspondente (vence ~10 dias depois). */
export function nextClosing(card: Card, today: Date): { date: Date; billMonth: string } | null {
  if (!card.closing_day) return null
  const mk = (y: number, m: number) => {
    const last = new Date(y, m + 1, 0).getDate()
    return new Date(y, m, Math.min(card.closing_day!, last))
  }
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let d = mk(t0.getFullYear(), t0.getMonth())
  if (d < t0) d = mk(t0.getFullYear(), t0.getMonth() + 1)
  const due = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 10)
  return { date: d, billMonth: monthStart(isoDate(due)) }
}
