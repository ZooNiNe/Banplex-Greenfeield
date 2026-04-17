create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

alter table public.materials
  add column if not exists current_stock numeric;

update public.materials
set current_stock = 0
where current_stock is null;

alter table public.materials
  alter column current_stock set default 0;

alter table public.materials
  alter column current_stock set not null;

alter table public.expenses
  add column if not exists team_id uuid,
  add column if not exists supplier_id uuid references public.suppliers(id),
  add column if not exists expense_type text,
  add column if not exists amount numeric;

update public.expenses
set amount = coalesce(amount, total_amount, 0)
where amount is null;

update public.expenses
set expense_type = coalesce(expense_type, 'expense')
where expense_type is null;

alter table public.expenses
  alter column amount set default 0;

alter table public.expenses
  alter column amount set not null;

alter table public.expenses
  alter column expense_type set default 'expense';

create table if not exists public.bills (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null unique references public.expenses(id) on delete cascade,
  telegram_user_id text,
  team_id uuid,
  project_id uuid references public.projects(id),
  supplier_id uuid references public.suppliers(id),
  bill_type text,
  description text,
  amount numeric not null default 0,
  due_date date not null,
  status text not null default 'unpaid',
  created_at timestamp with time zone not null default now()
);

create table if not exists public.stock_transactions (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id),
  expense_id uuid references public.expenses(id) on delete cascade,
  expense_line_item_id uuid not null unique references public.expense_line_items(id) on delete cascade,
  quantity numeric not null,
  direction text not null,
  source_type text not null,
  transaction_date date not null,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_expenses_supplier_id on public.expenses(supplier_id);
create index if not exists idx_bills_status_due_date on public.bills(status, due_date);
create index if not exists idx_bills_telegram_user_id on public.bills(telegram_user_id);
create index if not exists idx_stock_transactions_material_date on public.stock_transactions(material_id, transaction_date);

create or replace function public.fn_auto_create_bill_from_expense()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.bills (
    expense_id,
    telegram_user_id,
    team_id,
    project_id,
    supplier_id,
    bill_type,
    description,
    amount,
    due_date,
    status
  )
  values (
    new.id,
    new.telegram_user_id,
    new.team_id,
    new.project_id,
    new.supplier_id,
    new.expense_type,
    new.description,
    coalesce(new.amount, new.total_amount, 0),
    new.expense_date,
    'unpaid'
  )
  on conflict (expense_id) do nothing;

  return new;
end;
$$;

create or replace function public.fn_auto_update_stock_from_line_item()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expense_type text;
  v_transaction_date date;
  v_inserted_rows integer := 0;
begin
  select e.expense_type, e.expense_date
  into v_expense_type, v_transaction_date
  from public.expenses e
  where e.id = new.expense_id;

  if coalesce(v_expense_type, '') <> 'material_invoice' then
    return new;
  end if;

  insert into public.stock_transactions (
    material_id,
    expense_id,
    expense_line_item_id,
    quantity,
    direction,
    source_type,
    transaction_date
  )
  values (
    new.material_id,
    new.expense_id,
    new.id,
    new.qty,
    'in',
    'invoice',
    coalesce(v_transaction_date, current_date)
  )
  on conflict (expense_line_item_id) do nothing;

  get diagnostics v_inserted_rows = row_count;

  if v_inserted_rows > 0 then
    update public.materials
    set current_stock = coalesce(current_stock, 0) + coalesce(new.qty, 0)
    where id = new.material_id;
  end if;

  return new;
end;
$$;

revoke all on function public.fn_auto_create_bill_from_expense() from public, anon, authenticated;
revoke all on function public.fn_auto_update_stock_from_line_item() from public, anon, authenticated;

drop trigger if exists trg_after_expense_insert on public.expenses;
create trigger trg_after_expense_insert
after insert on public.expenses
for each row
execute function public.fn_auto_create_bill_from_expense();

drop trigger if exists trg_after_line_item_insert on public.expense_line_items;
create trigger trg_after_line_item_insert
after insert on public.expense_line_items
for each row
execute function public.fn_auto_update_stock_from_line_item();

grant select, insert, update on table public.suppliers to anon, authenticated;
grant select on table public.bills to anon, authenticated;
grant select on table public.stock_transactions to anon, authenticated;
