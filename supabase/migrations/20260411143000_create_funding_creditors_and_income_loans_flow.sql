create table if not exists public.funding_creditors (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now()
);

alter table public.project_incomes
  add column if not exists telegram_user_id text,
  add column if not exists transaction_date date;

update public.project_incomes
set transaction_date = coalesce(transaction_date, income_date)
where transaction_date is null;

alter table public.project_incomes
  alter column transaction_date set default current_date;

alter table public.project_incomes
  alter column transaction_date set not null;

alter table public.loans
  add column if not exists telegram_user_id text,
  add column if not exists creditor_id uuid references public.funding_creditors(id),
  add column if not exists transaction_date date,
  add column if not exists principal_amount numeric,
  add column if not exists repayment_amount numeric,
  add column if not exists interest_type text,
  add column if not exists status text;

alter table public.loan_payments
  add column if not exists telegram_user_id text;

update public.loans
set
  transaction_date = coalesce(transaction_date, disbursed_date, current_date),
  principal_amount = coalesce(principal_amount, amount, 0),
  repayment_amount = coalesce(repayment_amount, principal_amount, amount, 0),
  interest_type = coalesce(nullif(btrim(interest_type), ''), 'no_interest'),
  status = coalesce(nullif(btrim(status), ''), 'unpaid'),
  amount = coalesce(amount, principal_amount, 0),
  disbursed_date = coalesce(disbursed_date, transaction_date)
where transaction_date is null
   or principal_amount is null
   or repayment_amount is null
   or interest_type is null
   or status is null;

alter table public.loans
  alter column transaction_date set default current_date;

alter table public.loans
  alter column transaction_date set not null;

alter table public.loans
  alter column principal_amount set default 0;

alter table public.loans
  alter column principal_amount set not null;

alter table public.loans
  alter column repayment_amount set default 0;

alter table public.loans
  alter column repayment_amount set not null;

alter table public.loans
  alter column interest_type set default 'no_interest';

alter table public.loans
  alter column interest_type set not null;

alter table public.loans
  alter column status set default 'unpaid';

alter table public.loans
  alter column status set not null;

alter table public.loans
  alter column amount set default 0;

create or replace view public.vw_cash_mutation
with (security_invoker = true)
as
  select
    bp.payment_date as transaction_date,
    'out'::text as type,
    bp.amount,
    coalesce(bp.notes, b.description, 'Pembayaran tagihan') as description,
    'bill_payments'::text as source_table,
    coalesce(bp.team_id, b.team_id) as team_id,
    coalesce(bp.telegram_user_id, b.telegram_user_id) as telegram_user_id
  from public.bill_payments bp
  left join public.bills b on b.id = bp.bill_id

  union all

  select
    lp.payment_date as transaction_date,
    'out'::text as type,
    lp.amount,
    coalesce(lp.notes, l.description, 'Pembayaran pinjaman') as description,
    'loan_payments'::text as source_table,
    coalesce(lp.team_id, l.team_id) as team_id,
    coalesce(lp.telegram_user_id, l.telegram_user_id) as telegram_user_id
  from public.loan_payments lp
  left join public.loans l on l.id = lp.loan_id

  union all

  select
    coalesce(pi.transaction_date, pi.income_date) as transaction_date,
    'in'::text as type,
    pi.amount,
    coalesce(pi.description, 'Pemasukan proyek') as description,
    'project_incomes'::text as source_table,
    pi.team_id,
    pi.telegram_user_id
  from public.project_incomes pi

  union all

  select
    coalesce(l.transaction_date, l.disbursed_date) as transaction_date,
    'in'::text as type,
    coalesce(l.principal_amount, l.amount, 0) as amount,
    coalesce(l.description, 'Pencairan pinjaman') as description,
    'loans'::text as source_table,
    l.team_id,
    l.telegram_user_id
  from public.loans l;

create or replace view public.vw_transaction_summary
with (security_invoker = true)
as
with all_cash_flows as (
  select telegram_user_id, type, amount
  from public.transactions

  union all

  select telegram_user_id, type, amount
  from public.vw_cash_mutation
)
select
  telegram_user_id,
  coalesce(sum(case when type = 'income' then amount else 0 end), 0)::numeric as total_income,
  coalesce(sum(case when type = 'expense' then amount else 0 end), 0)::numeric as total_expense,
  coalesce(sum(case when type = 'income' then amount else -amount end), 0)::numeric as ending_balance
from all_cash_flows
where telegram_user_id is not null
group by telegram_user_id;

grant select on table public.funding_creditors to anon, authenticated;
grant select, insert, update on table public.project_incomes to anon, authenticated;
grant select, insert, update on table public.loans to anon, authenticated;
grant select on table public.vw_cash_mutation to anon, authenticated;
grant select on table public.vw_transaction_summary to anon, authenticated;
