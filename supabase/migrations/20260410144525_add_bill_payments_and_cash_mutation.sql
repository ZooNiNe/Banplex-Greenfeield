alter table public.bills
  add column if not exists paid_amount numeric not null default 0,
  add column if not exists paid_at timestamp with time zone;

create table if not exists public.loans (
  id uuid primary key default gen_random_uuid(),
  team_id uuid,
  amount numeric not null default 0,
  description text,
  disbursed_date date not null default current_date,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  loan_id uuid not null references public.loans(id) on delete cascade,
  team_id uuid,
  amount numeric not null,
  payment_date date not null,
  notes text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.project_incomes (
  id uuid primary key default gen_random_uuid(),
  team_id uuid,
  project_id uuid references public.projects(id),
  amount numeric not null,
  income_date date not null,
  description text,
  created_at timestamp with time zone not null default now()
);

create table if not exists public.bill_payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  telegram_user_id text,
  team_id uuid,
  amount numeric not null,
  payment_date date not null,
  notes text,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_bill_payments_bill_id on public.bill_payments(bill_id);
create index if not exists idx_loan_payments_loan_id on public.loan_payments(loan_id);
create index if not exists idx_project_incomes_project_id on public.project_incomes(project_id);

create or replace function public.fn_update_bill_status_on_payment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.bills
  set
    paid_amount = coalesce(public.bills.paid_amount, 0) + coalesce(new.amount, 0),
    status = case
      when coalesce(public.bills.paid_amount, 0) + coalesce(new.amount, 0) >= coalesce(public.bills.amount, 0)
        and coalesce(public.bills.amount, 0) > 0
        then 'paid'
      when coalesce(public.bills.paid_amount, 0) + coalesce(new.amount, 0) > 0
        then 'partial'
      else 'unpaid'
    end,
    paid_at = case
      when coalesce(public.bills.paid_amount, 0) + coalesce(new.amount, 0) >= coalesce(public.bills.amount, 0)
        and coalesce(public.bills.amount, 0) > 0
        then coalesce(public.bills.paid_at, now())
      else null
    end
  where public.bills.id = new.bill_id;

  return new;
end;
$$;

revoke all on function public.fn_update_bill_status_on_payment() from public, anon, authenticated;

drop trigger if exists trg_after_payment_insert on public.bill_payments;
create trigger trg_after_payment_insert
after insert on public.bill_payments
for each row
execute function public.fn_update_bill_status_on_payment();

create or replace view public.vw_cash_mutation
with (security_invoker = true)
as
  select
    bp.payment_date as transaction_date,
    'out'::text as type,
    bp.amount,
    coalesce(bp.notes, b.description, 'Pembayaran tagihan') as description,
    'bill_payments'::text as source_table,
    coalesce(bp.team_id, b.team_id) as team_id
  from public.bill_payments bp
  left join public.bills b on b.id = bp.bill_id

  union all

  select
    lp.payment_date as transaction_date,
    'out'::text as type,
    lp.amount,
    coalesce(lp.notes, l.description, 'Pembayaran pinjaman') as description,
    'loan_payments'::text as source_table,
    coalesce(lp.team_id, l.team_id) as team_id
  from public.loan_payments lp
  left join public.loans l on l.id = lp.loan_id

  union all

  select
    pi.income_date as transaction_date,
    'in'::text as type,
    pi.amount,
    coalesce(pi.description, 'Pemasukan proyek') as description,
    'project_incomes'::text as source_table,
    pi.team_id
  from public.project_incomes pi

  union all

  select
    l.disbursed_date as transaction_date,
    'in'::text as type,
    l.amount,
    coalesce(l.description, 'Pencairan pinjaman') as description,
    'loans'::text as source_table,
    l.team_id
  from public.loans l;

grant select, insert on table public.bill_payments to anon, authenticated;
grant select, insert on table public.loan_payments to anon, authenticated;
grant select, insert on table public.project_incomes to anon, authenticated;
grant select, insert on table public.loans to anon, authenticated;
grant select on table public.vw_cash_mutation to anon, authenticated;
