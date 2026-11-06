export type Settings = {
  user_id: string
  display_name: string
  saved_balance: number
  weekly_limit: number
  goal_name: string
  goal_amount: number
  plan_start: string // YYYY-MM-01
  plan_months: number
}

export type PlanItem = {
  id: number
  kind: 'income' | 'expense'
  name: string
  note: string
  amount: number
  start_month: string // YYYY-MM-01
  months: number | null // null = todo mês
}

export type Card = {
  id: number
  name: string
  closing_day: number | null
  sort: number
}

export type CardBill = {
  id: number
  card_id: number
  month: string // YYYY-MM-01
  amount: number
}

export type Category = {
  id: number
  name: string
  weekly_cap: number
  in_weekly_limit: boolean
  sort: number
}

export type PaymentMethod = 'Débito' | 'Pix' | 'Dinheiro' | 'Crédito'

export type Expense = {
  id: number
  spent_on: string // YYYY-MM-DD
  description: string
  category_id: number | null
  amount: number
  payment_method: PaymentMethod
  created_at: string
}

export type AppData = {
  settings: Settings
  items: PlanItem[]
  cards: Card[]
  bills: CardBill[]
  categories: Category[]
  expenses: Expense[]
}
