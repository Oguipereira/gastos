import { supabase } from './supabase'
import type { AppData, Card, CardBill, Category, Expense, PlanItem, Settings } from './types'

function fail(error: { message: string } | null) {
  if (error) throw new Error(error.message)
}

const num = (v: unknown) => Number(v ?? 0)

/** Carrega tudo do usuário logado. Retorna null se ainda não tem configurações (primeiro acesso). */
export async function loadAll(): Promise<AppData | null> {
  const [s, it, c, b, cat, ex] = await Promise.all([
    supabase.from('settings').select('*').maybeSingle(),
    supabase.from('plan_items').select('*').order('start_month').order('id'),
    supabase.from('cards').select('*').order('sort').order('id'),
    supabase.from('card_bills').select('*').order('month'),
    supabase.from('categories').select('*').order('sort').order('id'),
    supabase.from('expenses').select('*').order('spent_on', { ascending: false }).order('id', { ascending: false }).limit(1000),
  ])
  for (const r of [s, it, c, b, cat, ex]) fail(r.error)
  if (!s.data) return null

  const settings: Settings = {
    ...s.data,
    saved_balance: num(s.data.saved_balance),
    weekly_limit: num(s.data.weekly_limit),
    goal_amount: num(s.data.goal_amount),
  }
  return {
    settings,
    items: (it.data ?? []).map((x) => ({ ...x, amount: num(x.amount) }) as PlanItem),
    cards: (c.data ?? []) as Card[],
    bills: (b.data ?? []).map((x) => ({ ...x, amount: num(x.amount) }) as CardBill),
    categories: (cat.data ?? []).map((x) => ({ ...x, weekly_cap: num(x.weekly_cap) }) as Category),
    expenses: (ex.data ?? []).map((x) => ({ ...x, amount: num(x.amount) }) as Expense),
  }
}

type Table = 'settings' | 'plan_items' | 'cards' | 'card_bills' | 'categories' | 'expenses'

export async function insertRow(table: Table, row: Record<string, unknown>) {
  const { data, error } = await supabase.from(table).insert(row).select().single()
  fail(error)
  return data
}

export async function updateRow(table: Table, id: number, patch: Record<string, unknown>) {
  fail((await supabase.from(table).update(patch).eq('id', id)).error)
}

export async function deleteRow(table: Table, id: number) {
  fail((await supabase.from(table).delete().eq('id', id)).error)
}

export async function updateSettings(userId: string, patch: Partial<Settings>) {
  fail((await supabase.from('settings').update(patch).eq('user_id', userId)).error)
}

export async function upsertBill(cardId: number, month: string, amount: number) {
  fail(
    (await supabase.from('card_bills').upsert({ card_id: cardId, month, amount }, { onConflict: 'card_id,month' }))
      .error,
  )
}
