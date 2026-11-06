-- Esquema do app "Gastos": tudo por usuário, protegido por RLS.

-- Configurações gerais (uma linha por usuário)
create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name text not null default '',
  saved_balance numeric(12,2) not null default 0,
  weekly_limit numeric(12,2) not null default 175,
  goal_name text not null default 'Meta',
  goal_amount numeric(12,2) not null default 0,
  plan_start date not null default date_trunc('month', now())::date,
  plan_months int not null default 14 check (plan_months between 1 and 60),
  updated_at timestamptz not null default now()
);

-- Entradas e saídas do plano: salário, renda extra, parcelas, gastos únicos
create table public.plan_items (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  name text not null,
  note text not null default '',
  amount numeric(12,2) not null check (amount >= 0),
  start_month date not null,
  months int check (months is null or months > 0), -- null = todo mês
  created_at timestamptz not null default now()
);
create index plan_items_user_id_idx on public.plan_items (user_id);

-- Cartões e faturas por mês
create table public.cards (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  closing_day int check (closing_day between 1 and 31),
  sort int not null default 0,
  created_at timestamptz not null default now(),
  constraint cards_id_user_unique unique (id, user_id)
);
create index cards_user_id_idx on public.cards (user_id);

create table public.card_bills (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id bigint not null,
  month date not null,
  amount numeric(12,2) not null check (amount >= 0),
  unique (card_id, month),
  -- a fatura só pode apontar para um cartão do mesmo usuário
  constraint card_bills_card_owner_fkey foreign key (card_id, user_id)
    references public.cards (id, user_id) on delete cascade
);
create index card_bills_user_id_idx on public.card_bills (user_id);
create index card_bills_card_user_idx on public.card_bills (card_id, user_id);

-- Categorias com teto semanal
create table public.categories (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  weekly_cap numeric(12,2) not null default 0 check (weekly_cap >= 0),
  in_weekly_limit boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  constraint categories_id_user_unique unique (id, user_id)
);
create index categories_user_id_idx on public.categories (user_id);

-- Gastos do dia a dia
create table public.expenses (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  spent_on date not null default current_date,
  description text not null default '',
  category_id bigint,
  amount numeric(12,2) not null check (amount > 0),
  payment_method text not null default 'Débito' check (payment_method in ('Débito', 'Pix', 'Dinheiro', 'Crédito')),
  created_at timestamptz not null default now(),
  -- o gasto só pode usar categoria do mesmo usuário; apagar a categoria não apaga o gasto
  constraint expenses_category_owner_fkey foreign key (category_id, user_id)
    references public.categories (id, user_id) on delete set null (category_id)
);
create index expenses_user_spent_idx on public.expenses (user_id, spent_on desc);
create index expenses_category_user_idx on public.expenses (category_id, user_id);

-- RLS: cada usuário só lê e altera as próprias linhas
do $$
declare t text;
begin
  foreach t in array array['settings','plan_items','cards','card_bills','categories','expenses'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('create policy "own_select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "own_insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own_update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own_delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;
