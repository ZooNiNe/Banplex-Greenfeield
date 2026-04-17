create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  unit text,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  telegram_user_id text not null,
  project_id uuid not null references public.projects(id),
  supplier_name text not null,
  expense_date date not null,
  total_amount numeric not null default 0,
  description text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.expense_line_items (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  material_id uuid not null references public.materials(id),
  item_name text not null,
  qty numeric not null,
  unit_price numeric not null,
  line_total numeric not null,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_expenses_telegram_user_id
  on public.expenses(telegram_user_id);

create index if not exists idx_expenses_project_id
  on public.expenses(project_id);

create index if not exists idx_expense_line_items_expense_id
  on public.expense_line_items(expense_id);

create index if not exists idx_expense_line_items_material_id
  on public.expense_line_items(material_id);

grant select on table public.materials to anon, authenticated;
grant select, insert, update, delete on table public.expenses to anon, authenticated;
grant select, insert, update, delete on table public.expense_line_items to anon, authenticated;
