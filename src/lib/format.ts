const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

/** R$ 1.234 (sem centavos). sign=true mostra + ou −. */
export function brl(value: number, opts: { sign?: boolean; cents?: boolean } = {}): string {
  const abs = Math.abs(value)
  const body = abs.toLocaleString('pt-BR', {
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0,
  })
  const neg = value < -0.004
  const prefix = neg ? '−' : opts.sign && value > 0.004 ? '+' : ''
  return `${prefix}R$ ${body}`
}

/** '2026-12-01' -> 'dez/26' */
export function monthLabel(iso: string): string {
  const [y, m] = iso.split('-').map(Number)
  return `${MONTHS[m - 1]}/${String(y).slice(2)}`
}

export function monthName(iso: string): string {
  const [, m] = iso.split('-').map(Number)
  return MONTHS[m - 1]
}

/** '2026-11-06' -> '6/11' */
export function dayLabel(iso: string): string {
  const [, m, d] = iso.split('-').map(Number)
  return `${d}/${m}`
}

export function longToday(d = new Date()): string {
  const s = d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return s.charAt(0).toUpperCase() + s.slice(1)
}
