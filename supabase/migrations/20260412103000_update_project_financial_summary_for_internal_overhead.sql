drop view if exists public.vw_project_financial_summary;

create view public.vw_project_financial_summary
with (security_invoker = true) as
with project_base as (
  select
    p.id as project_id,
    p.team_id,
    coalesce(p.project_name, p.name) as project_name,
    case
      when lower(coalesce(p.project_type, '')) = 'internal' then 'Internal'
      else 'Utama'
    end as project_type,
    coalesce(
      p.status,
      case
        when coalesce(p.is_active, true) then 'active'
        else 'inactive'
      end
    ) as project_status
  from public.projects p
  where p.deleted_at is null
),
income_totals as (
  select
    pi.project_id,
    pi.team_id,
    coalesce(sum(coalesce(pi.amount, 0)), 0) as total_income
  from public.project_incomes pi
  where pi.deleted_at is null
    and pi.project_id is not null
  group by pi.project_id, pi.team_id
),
material_expense_totals as (
  select
    e.project_id,
    e.team_id,
    coalesce(sum(coalesce(e.total_amount, e.amount, 0)), 0) as material_expense
  from public.expenses e
  where e.deleted_at is null
    and e.project_id is not null
    and lower(coalesce(e.expense_type, '')) = any (array['material', 'material_invoice'])
  group by e.project_id, e.team_id
),
operating_expense_totals as (
  select
    e.project_id,
    e.team_id,
    coalesce(sum(coalesce(e.total_amount, e.amount, 0)), 0) as operating_expense
  from public.expenses e
  where e.deleted_at is null
    and e.project_id is not null
    and lower(coalesce(e.expense_type, '')) = any (array['operasional', 'operational', 'lainnya', 'other'])
  group by e.project_id, e.team_id
),
salary_breakdown as (
  select
    ar.project_id,
    coalesce(ar.team_id, b.team_id) as team_id,
    coalesce(sum(coalesce(ar.total_pay, 0)), 0) as salary_expense,
    coalesce(
      sum(
        case
          when b.status = 'paid' then coalesce(ar.total_pay, 0)
          else 0
        end
      ),
      0
    ) as salary_paid,
    coalesce(
      sum(
        case
          when b.status = any (array['unpaid', 'partial']) or b.id is null then coalesce(ar.total_pay, 0)
          else 0
        end
      ),
      0
    ) as salary_outstanding
  from public.attendance_records ar
  left join public.bills b
    on b.id = ar.salary_bill_id
    and b.deleted_at is null
    and b.bill_type = 'gaji'
  where ar.deleted_at is null
    and ar.project_id is not null
    and ar.billing_status = any (array['billed', 'paid'])
  group by ar.project_id, coalesce(ar.team_id, b.team_id)
),
project_financials as (
  select
    pb.project_id,
    pb.team_id,
    pb.project_name,
    pb.project_type,
    pb.project_status,
    coalesce(it.total_income, 0) as total_income,
    coalesce(me.material_expense, 0) as material_expense,
    coalesce(oe.operating_expense, 0) as operating_expense,
    coalesce(sb.salary_expense, 0) as salary_expense,
    coalesce(sb.salary_paid, 0) as salary_paid_expense,
    coalesce(sb.salary_outstanding, 0) as salary_outstanding_expense
  from project_base pb
  left join income_totals it
    on it.project_id = pb.project_id
    and it.team_id = pb.team_id
  left join material_expense_totals me
    on me.project_id = pb.project_id
    and me.team_id = pb.team_id
  left join operating_expense_totals oe
    on oe.project_id = pb.project_id
    and oe.team_id = pb.team_id
  left join salary_breakdown sb
    on sb.project_id = pb.project_id
    and sb.team_id = pb.team_id
)
select
  pf.project_id,
  pf.team_id,
  pf.project_name,
  pf.project_type,
  pf.project_status,
  pf.total_income,
  pf.material_expense,
  pf.operating_expense,
  pf.salary_expense,
  case
    when pf.project_type = 'Utama' then pf.total_income - pf.material_expense - pf.operating_expense
    else 0
  end as gross_profit,
  case
    when pf.project_type = 'Utama' then pf.total_income - pf.material_expense - pf.operating_expense - pf.salary_expense
    else 0
  end as net_profit,
  case
    when pf.project_type = 'Utama' then pf.total_income - pf.material_expense - pf.operating_expense - pf.salary_expense
    else 0
  end as net_profit_project,
  case
    when pf.project_type = 'Internal' then pf.material_expense + pf.operating_expense + pf.salary_expense
    else 0
  end as company_overhead,
  pf.salary_paid_expense,
  pf.salary_outstanding_expense
from project_financials pf;
