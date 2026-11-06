import { addMonths, isoDate, monthStart, parseIso } from './plan'
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

/**
 * Data de fechamento da fatura que vence no mês `billMonth`.
 * Regra: a fatura vence ~10 dias depois de fechar, então quem fecha do dia 21 em diante
 * fecha no mês anterior ao do vencimento.
 */
export function closingFor(card: Pick<Card, 'closing_day'> | undefined, billMonth: string): string | null {
  if (!card?.closing_day) return null
  const base = card.closing_day >= 21 ? addMonths(billMonth, -1) : monthStart(billMonth)
  const [y, m] = base.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${base.slice(0, 8)}${String(Math.min(card.closing_day, last)).padStart(2, '0')}`
}

/** Vencimento aproximado (fechamento + 10 dias) da fatura do mês `billMonth`. */
export function dueFor(card: Pick<Card, 'closing_day'> | undefined, billMonth: string): string | null {
  const c = closingFor(card, billMonth)
  if (!c) return null
  const d = parseIso(c)
  d.setDate(d.getDate() + 10)
  return isoDate(d)
}
