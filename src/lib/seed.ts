import type { SupabaseClient } from '@supabase/supabase-js'
import { addMonths, isoDate, monthStart } from './plan'

/**
 * Dados de EXEMPLO (fictícios) para explorar o app no primeiro acesso.
 * Os meses são relativos ao mês atual, para o exemplo sempre parecer "de agora".
 * Tudo é editável depois em Ajustes.
 */
export function demoSeed(start: string) {
  const m = (i: number) => addMonths(start, i)
  return {
    settings: {
      display_name: '',
      saved_balance: 500,
      weekly_limit: 200,
      goal_name: 'Reserva de emergência',
      goal_amount: 8000,
      plan_start: start,
      plan_months: 12,
    },
    items: [
      { kind: 'income', name: 'Salário', note: 'todo mês', amount: 2800, start_month: m(0), months: null },
      { kind: 'income', name: 'Freela', note: 'pagamento único', amount: 600, start_month: m(1), months: 1 },
      { kind: 'expense', name: 'Curso online', note: '6x no boleto', amount: 150, start_month: m(0), months: 6 },
      { kind: 'expense', name: 'Viagem de fim de semana', note: 'débito', amount: 500, start_month: m(2), months: 1 },
    ],
    cards: [
      { name: 'Cartão principal', closing_day: 5, bills: [2400, 1900, 1200, 800, 400] },
      { name: 'Cartão reserva', closing_day: 20, bills: [500, 300, 300, 150] },
    ].map((c) => ({ ...c, bills: Object.fromEntries(c.bills.map((v, i) => [m(i), v])) as Record<string, number> })),
    categories: [
      { name: 'Comida', weekly_cap: 70, in_weekly_limit: true },
      { name: 'Transporte', weekly_cap: 50, in_weekly_limit: true },
      { name: 'Lazer', weekly_cap: 60, in_weekly_limit: true },
      { name: 'Outros', weekly_cap: 20, in_weekly_limit: true },
      { name: 'Viagem', weekly_cap: 500, in_weekly_limit: false },
    ],
  }
}

const DEFAULT_CATEGORIES = [
  { name: 'Comida', weekly_cap: 60, in_weekly_limit: true },
  { name: 'Transporte', weekly_cap: 50, in_weekly_limit: true },
  { name: 'Lazer', weekly_cap: 50, in_weekly_limit: true },
  { name: 'Outros', weekly_cap: 15, in_weekly_limit: true },
]

function check(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

const currentMonth = () => monthStart(isoDate(new Date()))

export async function seedDemo(sb: SupabaseClient) {
  const s = demoSeed(currentMonth())
  check((await sb.from('settings').upsert(s.settings)).error)
  check((await sb.from('plan_items').insert(s.items)).error)
  for (const [idx, c] of s.cards.entries()) {
    const { data, error } = await sb
      .from('cards')
      .insert({ name: c.name, closing_day: c.closing_day, sort: idx })
      .select('id')
      .single()
    check(error)
    const rows = Object.entries(c.bills).map(([month, amount]) => ({ card_id: data!.id, month, amount }))
    check((await sb.from('card_bills').insert(rows)).error)
  }
  check((await sb.from('categories').insert(s.categories.map((c, i) => ({ ...c, sort: i })))).error)
}

export async function seedEmpty(sb: SupabaseClient) {
  check(
    (
      await sb.from('settings').upsert({
        display_name: '',
        saved_balance: 0,
        weekly_limit: 175,
        goal_name: 'Minha meta',
        goal_amount: 0,
        plan_start: currentMonth(),
        plan_months: 12,
      })
    ).error,
  )
  check((await sb.from('categories').insert(DEFAULT_CATEGORIES.map((c, i) => ({ ...c, sort: i })))).error)
}
