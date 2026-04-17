create index if not exists idx_project_incomes_project_team
  on public.project_incomes (project_id, team_id);

create index if not exists idx_expenses_project_team_type
  on public.expenses (project_id, team_id, expense_type);

create index if not exists idx_attendance_records_project_team_billing
  on public.attendance_records (project_id, team_id, billing_status);

create index if not exists idx_bills_project_type
  on public.bills (project_id, bill_type);

create or replace view public.vw_project_financial_summary
with (security_invoker = true)
as
with income_totals as (
  select
    pi.project_id,
    pi.team_id,
    coalesce(sum(coalesce(pi.amount, 0)), 0)::numeric as total_income
  from public.project_incomes pi
  where pi.project_id is not null
  group by pi.project_id, pi.team_id
),
material_expense_totals as (
  select
    e.project_id,
    e.team_id,
    coalesce(sum(coalesce(e.total_amount, e.amount, 0)), 0)::numeric as material_expense
  from public.expenses e
  where e.project_id is not null
    and lower(coalesce(e.expense_type, '')) in ('material', 'material_invoice')
  group by e.project_id, e.team_id
),
operating_expense_totals as (
  select
    e.project_id,
    e.team_id,
    coalesce(sum(coalesce(e.total_amount, e.amount, 0)), 0)::numeric as operating_expense
  from public.expenses e
  where e.project_id is not null
    and lower(coalesce(e.expense_type, '')) in ('operasional', 'lainnya')
  group by e.project_id, e.team_id
),
salary_expense_totals as (
  select
    ar.project_id,
    coalesce(ar.team_id, b.team_id) as team_id,
    coalesce(sum(coalesce(ar.total_pay, 0)), 0)::numeric as salary_expense
  from public.attendance_records ar
  join public.bills b
    on b.id = ar.salary_bill_id
   and b.bill_type = 'gaji'
  where ar.project_id is not null
    and ar.billing_status = 'billed'
  group by ar.project_id, coalesce(ar.team_id, b.team_id)
),
summary_keys as (
  select project_id, team_id from income_totals
  union
  select project_id, team_id from material_expense_totals
  union
  select project_id, team_id from operating_expense_totals
  union
  select project_id, team_id from salary_expense_totals
)
select
  k.project_id,
  k.team_id,
  p.name as project_name,
  case when p.is_active then 'active' else 'inactive' end as project_status,
  coalesce(i.total_income, 0)::numeric as total_income,
  coalesce(m.material_expense, 0)::numeric as material_expense,
  coalesce(o.operating_expense, 0)::numeric as operating_expense,
  coalesce(s.salary_expense, 0)::numeric as salary_expense,
  (
    coalesce(i.total_income, 0)
    - coalesce(m.material_expense, 0)
    - coalesce(s.salary_expense, 0)
  )::numeric as gross_profit,
  (
    coalesce(i.total_income, 0)
    - coalesce(m.material_expense, 0)
    - coalesce(s.salary_expense, 0)
    - coalesce(o.operating_expense, 0)
  )::numeric as net_profit
from summary_keys k
left join public.projects p
  on p.id = k.project_id
left join income_totals i
  on i.project_id = k.project_id
 and i.team_id is not distinct from k.team_id
left join material_expense_totals m
  on m.project_id = k.project_id
 and m.team_id is not distinct from k.team_id
left join operating_expense_totals o
  on o.project_id = k.project_id
 and o.team_id is not distinct from k.team_id
left join salary_expense_totals s
  on s.project_id = k.project_id
 and s.team_id is not distinct from k.team_id;

grant select on table public.vw_project_financial_summary to anon, authenticated;
